import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Vérification du webhook Meta
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === 'holiris2024') {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

// Réception des messages
export async function POST(request) {
  try {
    const body = await request.json()
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const message = changes?.value?.messages?.[0]

    if (!message) return NextResponse.json({ status: 'no message' })

    const from = message.from
    const messageType = message.type

    console.log('Message Meta reçu de:', from, 'type:', messageType)

    // Chercher l'intervenant par son numéro
    const { data: intervenantData } = await supabase
      .from('intervenants')
      .select('*')
      .or('whatsapp.eq.+' + from + ',phone.eq.+' + from)
      .limit(1)

    let seniorId = null
    let intervenantName = 'Intervenant inconnu'
    let intervenantRole = ''

    if (intervenantData?.length > 0) {
      seniorId = intervenantData[0].senior_id
      intervenantName = intervenantData[0].name
      intervenantRole = intervenantData[0].role
    } else {
      const { data: seniors } = await supabase.from('seniors').select('id').limit(1)
      seniorId = seniors?.[0]?.id
    }

    if (!seniorId) return NextResponse.json({ status: 'no senior' })

    let noteContent = ''
    let source = 'whatsapp_text'

    if (messageType === 'text') {
      noteContent = await synthesizeNote(message.text.body)
      source = 'whatsapp_text'
    } else if (messageType === 'audio') {
      const audioId = message.audio.id
      const transcription = await transcribeMetaAudio(audioId)
      noteContent = await synthesizeNote(transcription)
      source = 'whatsapp_audio'
    }

    if (noteContent) {
      await supabase.from('notes').insert({
        senior_id: seniorId,
        content: noteContent,
        source,
        intervenant_name: intervenantName + (intervenantRole ? ' · ' + intervenantRole : ''),
        created_at: new Date().toISOString()
      })
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Erreur webhook Meta:', error.message)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}

async function transcribeMetaAudio(audioId) {
  // Récupérer l'URL du fichier audio
  const urlResponse = await fetch(
    'https://graph.facebook.com/v18.0/' + audioId,
    { headers: { 'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN } }
  )
  const urlData = await urlResponse.json()

  // Télécharger le fichier audio
  const audioResponse = await fetch(urlData.url, {
    headers: { 'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN }
  })
  const audioBuffer = await audioResponse.arrayBuffer()
  const audioFile = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' })

  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3',
    language: 'fr'
  })

  return transcription.text
}

async function synthesizeNote(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: 'Tu es l\'assistant IA de Holiris. Transforme ce message en note professionnelle en 2-3 phrases. Mets en avant l\'état général, les points d\'attention et les actions effectuées.'
        },
        { role: 'user', content: text }
      ],
      max_tokens: 300
    })
    return completion.choices[0]?.message?.content || text
  } catch {
    return text
  }
}
