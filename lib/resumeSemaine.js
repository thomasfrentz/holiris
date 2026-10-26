// Résumé des 7 derniers jours d'un senior, pour la borne et la borne sur téléphone (côté serveur uniquement).
// Rédigé à partir des notes (déjà filtrées des informations médicales) et des alertes de la semaine.
import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/serveur'
import { SURNOMS, auteurAvecLien } from '@/lib/contexteIA'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Le même résumé resservi pendant 30 minutes, sauf si une nouvelle note arrive entre-temps
const cache = new Map()
const DUREE_CACHE = 30 * 60 * 1000

export async function resumeSemaine(seniorId) {
  const depuis = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()
  const [{ data: senior }, { data: notes }, { data: alertes }] = await Promise.all([
    supabaseAdmin.from('seniors').select('name').eq('id', seniorId).single(),
    supabaseAdmin.from('notes').select('content, intervenant_name, source, created_at')
      .eq('senior_id', seniorId).gte('created_at', depuis).order('created_at'),
    supabaseAdmin.from('alertes').select('niveau, message, created_at')
      .eq('senior_id', seniorId).gte('created_at', depuis).or('type.is.null,type.neq.sans_passage'),
  ])
  if (!notes?.length) return { resume: '', nbNotes: 0 }

  const derniere = notes[notes.length - 1].created_at
  const enCache = cache.get(seniorId)
  if (enCache && enCache.derniere === derniere && Date.now() - enCache.le < DUREE_CACHE) return enCache.valeur

  const prenom = senior?.name?.split(' ')[0] || 'la personne'
  // Jour et heure de chaque note et alerte, pour que le résumé situe chaque fait dans la semaine
  const quand = d => new Date(d).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
  const aujourdhui = new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
  const notesTexte = notes.map(n =>
    `[${quand(n.created_at)}] ${auteurAvecLien(n.intervenant_name || n.source || 'Inconnu')} : ${n.content}`
  ).join('\n')
  const alertesTexte = alertes?.length ? alertes.map(a => `- [${quand(a.created_at)}] ${a.message}`).join('\n') : 'Aucune.'

  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    reasoning_effort: 'low',
    max_completion_tokens: 900,
    messages: [
      {
        role: 'system',
        content: 'Tu résumes la semaine d\'une personne âgée suivie à domicile, pour l\'intervenant ou le proche qui arrive chez elle. '
          + 'Sois factuel, bienveillant et simple. Ne mentionne jamais de diagnostic, de traitement ni de mesure médicale. '
          + 'Écris en texte simple, sans titres ni mise en forme markdown.\n\n' + SURNOMS,
      },
      {
        role: 'user',
        content: `Nous sommes le ${aujourdhui}.\n\nNotes des 7 derniers jours sur ${senior?.name} :\n${notesTexte}\n\nAlertes de la semaine :\n${alertesTexte}\n\n`
          + `Rédige un résumé court (4 à 6 phrases) : comment va ${prenom} cette semaine (moral, repas, sommeil, activités), `
          + 'ce qui a changé, et ce à quoi être attentif aujourd\'hui. '
          + 'Situe chaque fait marquant (repas sauté, douleur, chute, fatigue…) dans le temps, d\'après la date et l\'heure des notes, sans jamais le présenter comme actuel s\'il est ancien. '
          + 'Un fait ponctuel : dis quand (« hier », « mardi midi »). Un fait qui revient : regroupe-le sans lister les jours '
          + '(« certains jours, elle ne s\'est pas alimentée correctement », « ces derniers jours, elle a par moments eu mal au ventre »). '
          + 'N\'invente rien qui ne soit pas dans les notes.',
      },
    ],
  })

  const valeur = { resume: completion.choices[0]?.message?.content?.trim() || '', nbNotes: notes.length }
  cache.set(seniorId, { valeur, derniere, le: Date.now() })
  return valeur
}
