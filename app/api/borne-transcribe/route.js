import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request) {
  try {
    const formData = await request.formData()
    const audio = formData.get('audio')
    const buffer = await audio.arrayBuffer()
    const audioFile = new File([buffer], 'note.webm', { type: 'audio/webm' })

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      language: 'fr'
    })
    const rawText = transcription.text

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Tu es l\'assistant de Holiris, un outil de coordination de soins à domicile. Transforme ce message vocal en note clinique courte et naturelle en 1-2 phrases maximum. Conserve les informations importantes (constantes, état, actions réalisées). Commence directement par la note sans introduction.' },
        { role: 'user', content: rawText }
      ],
      max_tokens: 150
    })

    const note = completion.choices[0]?.message?.content || rawText
    return NextResponse.json({ success: true, note, rawText })
  } catch (err) {
    console.error('borne-transcribe error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
