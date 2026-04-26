import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request) {
  try {
    const { notes, alertes, senior } = await request.json()

    const notesText = notes.map(n =>
      `[${new Date(n.created_at).toLocaleDateString('fr-FR')}] ${n.intervenant_name || n.source || 'Inconnu'} : ${n.content}`
    ).join('\n')

    const alertesText = alertes.length > 0
      ? alertes.map(a => `- [${a.niveau?.toUpperCase() || 'INFO'}] ${a.message}`).join('\n')
      : 'Aucune alerte active.'

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      max_tokens: 1000,
      messages: [
        {
          role: 'system',
          content: 'Tu es un assistant médico-social. Sois factuel, bienveillant et professionnel. Ne mentionne jamais de diagnostics médicaux.'
        },
        {
          role: 'user',
          content: `Voici les notes de suivi de ${senior?.name} (${senior?.age} ans) sur le dernier mois.

NOTES DU MOIS :
${notesText || 'Aucune note ce mois-ci.'}

ALERTES ACTIVES :
${alertesText}

Rédige un résumé concis (5-8 lignes) de l'état général en mettant en évidence :
1. Les tendances générales (positives ou négatives)
2. Les signaux faibles à surveiller
3. Les points d'attention prioritaires pour l'intervenant`
        }
      ]
    })

    const text = completion.choices[0]?.message?.content || ''
    return NextResponse.json({ resume: text })

  } catch (error) {
    console.error('Erreur Groq résumé:', error.message)
    return NextResponse.json({ resume: '' }, { status: 500 })
  }
}
