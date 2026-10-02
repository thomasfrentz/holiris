import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { transcriptionVide, RIEN_ENTENDU, mettreAuPropre } from '@/lib/transcription'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    const buffer = await audio.arrayBuffer()
    // Safari (iPhone) enregistre en mp4, Chrome et Android en webm
    const type = audio.type || 'audio/webm'
    const extension = type.includes('mp4') || type.includes('aac') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
    const audioFile = new File([buffer], 'note.' + extension, { type })

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      language: 'fr',
      response_format: 'verbose_json',
    })
    const rawText = transcription.text
    // Silence ou bruit : pas de note inventée
    if (transcriptionVide(rawText, transcription.segments)) {
      return NextResponse.json({ success: false, rienEntendu: true, error: RIEN_ENTENDU })
    }

    // Texte fidèle à ce qui a été dit (mis au propre, sans résumé ni interprétation)
    const note = await mettreAuPropre(rawText)
    return NextResponse.json({ success: true, note, rawText })
  } catch (err) {
    console.error('borne-transcribe error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
