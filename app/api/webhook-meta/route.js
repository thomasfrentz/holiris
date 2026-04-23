import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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

export async function POST(request) {
  try {
    const body = await request.json()
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const message = changes?.value?.messages?.[0]

    if (!message) return NextResponse.json({ status: 'no message' })

    const from = message.from
    const messageType = message.type

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
    let rawText = ''

    if (messageType === 'text') {
      rawText = message.text.body
      noteContent = await synthesizeNote(rawText)
      source = 'whatsapp_text'
    } else if (messageType === 'audio') {
      rawText = await transcribeMetaAudio(message.audio.id)
      noteContent = await synthesizeNote(rawText)
      source = 'whatsapp_audio'
    }

    if (noteContent) {
      const finalSeniorId = await findSeniorByName(rawText, seniorId)

      await supabase.from('notes').insert({
        senior_id: finalSeniorId,
        content: noteContent,
        source,
        intervenant_name: intervenantName + (intervenantRole ? ' · ' + intervenantRole : ''),
        created_at: new Date().toISOString()
      })

      await analyzeForAlerts(rawText, finalSeniorId)
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Erreur webhook Meta:', error.message)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}

async function transcribeMetaAudio(audioId) {
  const urlResponse = await fetch(
    'https://graph.facebook.com/v18.0/' + audioId,
    { headers: { 'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN } }
  )
  const urlData = await urlResponse.json()
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
          content: 'Tu es l\'assistant de Holiris. Transforme ce message en note courte et naturelle en 1-2 phrases maximum. Sois direct et factuel. Commence directement par l\'information, sans formule de politesse, sans objet, sans signature.'
        },
        { role: 'user', content: text }
      ],
      max_tokens: 150
    })
    return completion.choices[0]?.message?.content || text
  } catch {
    return text
  }
}

async function findSeniorByName(text, fallbackSeniorId) {
  const { data: seniors } = await supabase.from('seniors').select('id, name')
  if (!seniors?.length) return fallbackSeniorId

  const textLower = text.toLowerCase()

  for (const senior of seniors) {
    const parts = senior.name.toLowerCase().split(' ')
    for (const part of parts) {
      if (part.length > 2 && textLower.includes(part)) {
        console.log('Senior trouvé par nom:', senior.name)
        return senior.id
      }
    }
  }

  return fallbackSeniorId
}

async function analyzeForAlerts(text, seniorId) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `Tu es l'assistant IA de Holiris. Analyse ce message et détecte les signaux faibles qui méritent une alerte pour la famille.

Signaux à surveiller :
- Douleurs (genou, dos, tête, abdomen...)
- Chute ou risque de chute
- Problèmes alimentaires (ne mange pas, perd du poids...)
- Troubles cognitifs (confusion, mémoire, désorienté...)
- Problèmes de mobilité
- Moral bas, tristesse, isolement
- Médicaments non pris
- Symptômes inhabituels

Réponds UNIQUEMENT en JSON :
{"alerte": true, "niveau": "warning", "message": "Description courte"}
ou
{"alerte": false}

Niveaux : "info", "warning", "danger".`
        },
        { role: 'user', content: text }
      ],
      max_tokens: 150
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const clean = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (parsed.alerte && parsed.message) {
      await supabase.from('alertes').insert({
        senior_id: seniorId,
        type: 'signal_faible',
        message: parsed.message,
        niveau: parsed.niveau || 'warning',
        created_at: new Date().toISOString()
      })
      console.log('Alerte créée:', parsed.message)
    }
  } catch (error) {
    console.error('Erreur analyse alertes:', error.message)
  }
}
