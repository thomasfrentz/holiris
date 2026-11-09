import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { SURNOMS, auteurAvecLien } from '@/lib/contexteIA'
import { supabaseAdmin, seniorAccessible } from '@/lib/serveur'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request) {
  try {
    // Accès vérifié avec les droits de l'utilisateur ; le résumé porte sur toutes les notes du mois, quel que soit le métier de leur auteur
    const senior = await seniorAccessible((await request.json()).seniorId)
    if (!senior) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    const unMoisAvant = new Date(); unMoisAvant.setMonth(unMoisAvant.getMonth() - 1)
    const [{ data: notes }, { data: alertes }] = await Promise.all([
      supabaseAdmin.from('notes').select('content, intervenant_name, source, created_at').eq('senior_id', senior.id)
        .gte('created_at', unMoisAvant.toISOString()).order('created_at', { ascending: false }),
      supabaseAdmin.from('alertes').select('niveau, message').eq('senior_id', senior.id).eq('lu', false).order('created_at', { ascending: false }),
    ])

    const notesText = (notes || []).map(n =>
      `[${new Date(n.created_at).toLocaleDateString('fr-FR')}] ${auteurAvecLien(n.intervenant_name || n.source || 'Inconnu')} : ${n.content}`
    ).join('\n')

    const alertesText = alertes?.length > 0
      ? alertes.map(a => `- [${a.niveau?.toUpperCase() || 'INFO'}] ${a.message}`).join('\n')
      : 'Aucune alerte active.'

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      max_completion_tokens: 1300,
      messages: [
        {
          role: 'system',
          content: 'Tu es un assistant médico-social. Sois factuel, bienveillant et professionnel. Ne mentionne jamais de diagnostics médicaux.\n\n' + SURNOMS
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
