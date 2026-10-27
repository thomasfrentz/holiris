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
  const jour = d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
  const aujourdhui = jour(Date.now())
  const hier = jour(Date.now() - 24 * 3600 * 1000)
  const quand = d => {
    const j = jour(d)
    const heure = new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    return (j === aujourdhui ? 'aujourd\'hui, ' : j === hier ? 'hier, ' : '') + j + ' à ' + heure
  }
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
          + 'Rédige un résumé court, en un seul paragraphe de 3 à 4 phrases, sans jamais détailler jour par jour ni citer de date ou d\'heure :\n'
          + `1. La semaine (2 phrases au plus) : regroupe l'essentiel par thème (douleurs, repas, moral, sommeil, activités), `
          + `ex. « ${prenom} a eu mal au ventre par moments et s'est parfois mal alimentée ; son moral a été fluctuant. » `
          + 'Ne garde que ce qui compte. Seul un événement important et isolé (une chute…) peut être situé (« jeudi »).\n'
          + `2. Aujourd'hui (1 phrase) : où en est ${prenom} d'après les notes les plus récentes, ex. « Aujourd'hui, elle n'a plus mal au ventre. » `
          + 'Si la note la plus récente n\'est pas d\'aujourd\'hui, dis de quand elle date (« Hier, … »).\n'
          + `3. À surveiller (1 phrase), ex. « Il faut surveiller que les douleurs ne reviennent pas et qu'elle s'alimente correctement. »\n`
          + 'Reprends les faits sans les exagérer : n\'ajoute rien qui ne soit pas dans les notes.',
      },
    ],
  })

  const valeur = { resume: completion.choices[0]?.message?.content?.trim() || '', nbNotes: notes.length }
  cache.set(seniorId, { valeur, derniere, le: Date.now() })
  return valeur
}
