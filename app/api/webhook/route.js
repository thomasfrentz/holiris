import { NextResponse } from 'next/server'
import OpenAI from 'openai'
import { createClient } from '@supabase/supabase-js'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

async function transcribeAudio(mediaUrl) {
  // Télécharger le fichier audio depuis Twilio
  const accountSid = process.env.TWILIO_ACCOUNT_SID
  const authToken = process.env.TWILIO_AUTH_TOKEN
  
  const response = await fetch(mediaUrl, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64')
    }
  })
  
  const audioBuffer = await response.arrayBuffer()
  const audioFile = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' })
  
  const transcription = await openai.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-1',
    language: 'fr'
  })
  
  return transcription.text
}

async function synthesizeNote(transcription, from) {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      {
        role: 'system',
        content: `Tu es l'assistant IA de Holiris. Un intervenant médical vient d'envoyer un message vocal sur l'état d'un patient. 
        Transforme cette transcription en note structurée et professionnelle en 2-3 phrases maximum.
        Mets en avant les points importants : état général, points d'attention, actions effectuées.`
      },
      {
        role: 'user',
        content: transcription
      }
    ]
  })
  
  return completion.choices[0].message.content
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    
    const from = formData.get('From')
    const body = formData.get('Body')
    const numMedia = parseInt(formData.get('NumMedia') || '0')
    const mediaUrl = formData.get('MediaUrl0')
    const mediaType = formData.get('MediaContentType0') || ''

    let noteContent = ''
    let source = 'whatsapp_text'

    if (numMedia > 0 && mediaType.includes('audio')) {
      // Message vocal → transcription Whisper + synthèse Claude
      console.log('Audio reçu, transcription en cours...')
      const transcription = await transcribeAudio(mediaUrl)
      console.log('Transcription:', transcription)
      noteContent = await synthesizeNote(transcription, from)
      source = 'whatsapp_audio'
    } else if (body) {
      // Message texte → synthèse directe
      noteContent = await synthesizeNote(body, from)
      source = 'whatsapp_text'
    }

    if (noteContent) {
      // Récupérer le premier senior (à améliorer plus tard avec matching par numéro)
      const { data: seniors } = await supabase.from('seniors').select('id').limit(1)
      const seniorId = seniors?.[0]?.id

      if (seniorId) {
        await supabase.from('notes').insert({
          senior_id: seniorId,
          content: noteContent,
          source: source,
          created_at: new Date().toISOString()
        })
        console.log('Note sauvegardée:', noteContent)
      }
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ Note reçue et ajoutée au dossier Holiris. Merci !</Message>
</Response>`

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Erreur webhook:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}