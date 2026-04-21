import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function twimlResponse(message) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

async function transcribeAudio(mediaUrl) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN

  const response = await fetch(mediaUrl, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    }
  })

  const audioBuffer = await response.arrayBuffer()
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
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        system: `Tu es l'assistant IA de Holiris, plateforme de suivi des personnes âgées dans les Pyrénées-Orientales. 
Transforme le message d'un intervenant en note professionnelle en 2-3 phrases.
Mets en avant l'état général, les points d'attention et les actions effectuées.`,
        messages: [{ role: 'user', content: text }]
      })
    })

    const data = await response.json()
    if (data.content?.[0]?.text) return data.content[0].text
    return `Note reçue : ${text}`
  } catch (error) {
    return `Note reçue : ${text}`
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') || ''
    const body = formData.get('Body') || ''
    const numMedia = parseInt(formData.get('NumMedia') || '0')
    const mediaUrl = formData.get('MediaUrl0') || ''
    const mediaType = formData.get('MediaContentType0') || ''

    const phoneNumber = from.replace('whatsapp:', '')
    console.log('Message de:', phoneNumber)

    // Chercher l'intervenant par son numéro
    const { data: intervenantData } = await supabase
      .from('intervenants')
      .select('*, seniors(*)')
      .or(`whatsapp.eq.${phoneNumber},phone.eq.${phoneNumber}`)
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

    if (!seniorId) return twimlResponse('Erreur : aucun senior trouvé.')

    let noteContent = ''
    let source = 'whatsapp_text'

    if (numMedia > 0 && mediaType.includes('audio')) {
      const transcription = await transcribeAudio(mediaUrl)
      noteContent = await synthesizeNote(transcription)
      source = 'whatsapp_audio'
    } else if (body) {
      noteContent = await synthesizeNote(body)
      source = 'whatsapp_text'
    } else {
      return twimlResponse('Message reçu.')
    }

    if (noteContent) {
      await supabase.from('notes').insert({
        senior_id: seniorId,
        content: noteContent,
        source: source,
        intervenant_name: `${intervenantName}${intervenantRole ? ' · ' + intervenantRole : ''}`,
        created_at: new Date().toISOString()
      })
    }

    return twimlResponse(`✅ Note reçue. Merci ${intervenantName} !`)

  } catch (error) {
    console.error('Erreur webhook:', error.message)
    return twimlResponse('Message reçu.')
  }
}
