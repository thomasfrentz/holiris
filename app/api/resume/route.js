import { NextResponse } from 'next/server'

export async function POST(request) {
  const { notes, alertes, senior } = await request.json()

  const notesText = notes.map(n =>
    `[${new Date(n.created_at).toLocaleDateString('fr-FR')}] ${n.intervenant_name || n.source || 'Inconnu'} : ${n.content}`
  ).join('\n')

  const alertesText = alertes.length > 0
    ? alertes.map(a => `- [${a.niveau?.toUpperCase() || 'INFO'}] ${a.message}`).join('\n')
    : 'Aucune alerte active.'

  const prompt = `Tu es un assistant médico-social. Voici les notes de suivi de ${senior?.name} (${senior?.age} ans) sur le dernier mois, ainsi que les alertes actives.

NOTES DU MOIS :
${notesText}

ALERTES ACTIVES :
${alertesText}

Rédige un résumé concis (5-8 lignes maximum) de l'état général de la personne, en mettant en évidence :
1. Les tendances générales (positives ou négatives)
2. Les signaux faibles à surveiller
3. Les points d'attention prioritaires pour l'intervenant

Sois factuel, bienveillant et professionnel. Ne mentionne pas de diagnostics médicaux.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    })
  })

  const data = await response.json()
  const text = data.content?.map(b => b.text || '').join('') || ''
  return NextResponse.json({ resume: text })
}