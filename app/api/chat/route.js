import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request) {
  try {
    const { messages, context } = await request.json()

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: context },
        ...messages
      ],
      max_tokens: 500,
    })

    const text = completion.choices[0]?.message?.content || 'Désolé je n\'ai pas pu répondre.'
    return NextResponse.json({ text })

  } catch (error) {
    console.error('Erreur Groq:', error.message)
    return NextResponse.json({ text: 'Erreur de connexion.' }, { status: 500 })
  }
}
