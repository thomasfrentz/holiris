import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { SURNOMS, auteurAvecLien } from '@/lib/contexteIA'
import { supabaseAdmin, seniorAccessible } from '@/lib/serveur'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request) {
  try {
    const { messages, seniorId } = await request.json()
    // Accès vérifié avec les droits de l'utilisateur ; les notes sont ensuite toutes lues, quel que soit le métier de leur auteur
    const senior = await seniorAccessible(seniorId)
    if (!senior) return NextResponse.json({ text: 'Accès refusé.' }, { status: 403 })
    const [{ data: notes }, { data: events }] = await Promise.all([
      supabaseAdmin.from('notes').select('content, intervenant_name, created_at').eq('senior_id', senior.id)
        .order('created_at', { ascending: false }).limit(5),
      supabaseAdmin.from('events').select('label, scheduled_at').eq('senior_id', senior.id)
        .order('scheduled_at', { ascending: false }).limit(5),
    ])
    const context = 'Tu es l\'assistant IA de Holiris, plateforme de suivi des personnes âgées dans les Pyrénées-Orientales.\n\nPersonne suivie : ' + (senior.name || '') + ', ' + (senior.age || '') + ' ans, ' + (senior.city || '') + '\n\nDernières notes :\n' + (notes || []).map(n => '- ' + new Date(n.created_at).toLocaleDateString('fr-FR') + ' · ' + auteurAvecLien(n.intervenant_name || 'Proche') + ' : ' + n.content).join('\n') + '\n\nProchains événements :\n' + (events || []).map(e => '- ' + new Date(e.scheduled_at).toLocaleDateString('fr-FR') + ' : ' + e.label).join('\n') + '\n\nRéponds de façon bienveillante et concise (3-5 phrases max).'

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: context + '\n\n' + SURNOMS },
        ...messages
      ],
      max_completion_tokens: 800,
    })

    const text = completion.choices[0]?.message?.content || 'Désolé je n\'ai pas pu répondre.'
    return NextResponse.json({ text })

  } catch (error) {
    console.error('Erreur Groq:', error.message)
    return NextResponse.json({ text: 'Erreur de connexion.' }, { status: 500 })
  }
}
