import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { messages, context } = await request.json()

    const response = await fetch('https://holiris.vercel.app/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: context,
        messages
      })
    })

    const data = await response.json()
    const text = data.content?.[0]?.text || 'Désolé je n\'ai pas pu répondre.'
    return NextResponse.json({ text })

  } catch (error) {
    return NextResponse.json({ text: 'Erreur de connexion.' }, { status: 500 })
  }
}