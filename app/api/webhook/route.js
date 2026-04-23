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
    '<?xml version="1.0" encoding="UTF-8"?><Response><Message>' + message + '</Message></Response>',
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

async function transcribeAudio(mediaUrl) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const response = await fetch(mediaUrl, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(accountSid + ':' + authToken).toString('base64')
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

async function analyzeForAlerts(text, seniorId) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content: `Tu es l'assistant IA de Holiris. Analyse ce message d'un intervenant et détecte les signaux faibles qui méritent une alerte pour la famille.

Signaux à surveiller :
- Douleurs (genou, dos, tête, abdomen...)
- Chute ou risque de chute
- Problèmes alimentaires (ne mange pas, perd du poids...)
- Troubles cognitifs (confusion, mémoire, désorienté...)
- Problèmes de mobilité
- Moral bas, tristesse, isolement
- Médicaments non pris
- Symptômes inhabituels

Réponds UNIQUEMENT en JSON avec ce format exact :
{"alerte": true, "niveau": "warning", "message": "Description courte de l'alerte"}
ou
{"alerte": false}

Le niveau peut être "info", "warning" ou "danger".
"danger" uniquement pour chute, douleur intense, confusion grave.`
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

    const { data: intervenantData } = await supabase
      .from('intervenants')
      .select('*')
      .or('whatsapp.eq.' + phoneNumber + ',phone.eq.' + phoneNumber)
      .limit(1)

    let seniorId = null
    let intervenantName = 'Intervenant inconnu'
    let intervenantRole = ''

    if (intervenantData && intervenantData.length > 0) {
      seniorId = intervenantData[0].senior_id
      intervenantName = intervenantData[0].name
      intervenantRole = intervenantData[0].role
    } else {
      const { data: seniors } = await supabase.from('seniors').select('id').limit(1)
      seniorId = seniors && seniors[0] ? seniors[0].id : null
    }

    if (!seniorId) return twimlResponse('Erreur : aucun senior trouve.')

    let noteContent = ''
    let source = 'whatsapp_text'
    let rawText = body

    if (numMedia > 0 && mediaType.includes('audio')) {
      rawText = await transcribeAudio(mediaUrl)
      noteContent = await synthesizeNote(rawText)
      source = 'whatsapp_audio'
    } else if (body) {
      noteContent = await synthesizeNote(body)
      source = 'whatsapp_text'
    } else {
      return twimlResponse('Message recu.')
    }

    if (noteContent) {
      await supabase.from('notes').insert({
        senior_id: seniorId,
        content: noteContent,
        source: source,
        intervenant_name: intervenantName + (intervenantRole ? ' · ' + intervenantRole : ''),
        created_at: new Date().toISOString()
      })

      // Analyser le message brut pour détecter les signaux faibles
      await analyzeForAlerts(rawText, seniorId)
    }

    return twimlResponse('Note recue. Merci ' + intervenantName + ' !')

  } catch (error) {
    console.error('Erreur webhook:', error.message)
    return twimlResponse('Message recu.')
  }
}
