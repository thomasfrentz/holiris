// Détection des signaux faibles dans les notes (côté serveur uniquement)
// Appelée à l'enregistrement de chaque note, quel que soit le canal (WhatsApp, borne, application, carnet)
//
// Trois niveaux enregistrés dans la table alertes :
// - "surveiller" : point à surveiller, affiché sur la borne et le flux, sans notification
// - "warning"    : alerte (problème qui revient sur plusieurs jours, ou événement important), notifiée
// - "danger"     : alerte urgente, notifiée
import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/serveur'
import { SURNOMS, auteurAvecLien } from '@/lib/contexteIA'
import { envoyerPush, comptesDuSenior } from '@/lib/push'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Historique consulté pour repérer un problème qui revient
const HISTORIQUE_JOURS = 7

const CONSIGNE = `Tu es l'assistant IA de Holiris. Analyse cette note sur une personne âgée suivie à domicile
et détecte les signaux faibles qui méritent l'attention de la famille.

Signaux à surveiller :
- Douleurs (genou, dos, tête, abdomen...)
- Chute ou risque de chute
- Problèmes alimentaires (ne mange pas, perd du poids...)
- Troubles cognitifs (confusion, mémoire, désorientation...)
- Problèmes de mobilité
- Moral bas, tristesse, isolement, fatigue
- Médicaments non pris
- Symptômes inhabituels

La note est accompagnée des points et alertes déjà relevés ces derniers jours.

1. Le niveau de la note. Juge-la pour elle-même ; l'historique sert seulement à repérer un problème qui revient.
- "aucun" : rien à signaler, ou la note montre une amélioration d'un problème déjà relevé
- "surveiller" : petit signal isolé, sans gravité (fatigue, petite douleur, moins d'appétit un jour, moral un peu bas). C'est le cas le plus fréquent.
- "alerte" : un problème mineur qui revient sans amélioration, c'est-à-dire déjà relevé au moins deux jours différents dans l'historique ; ou un événement important sans urgence (perte de poids, médicaments non pris plusieurs fois, refus d'aide, isolement marqué)
- "urgent" : situation à traiter rapidement (chute, détresse, confusion soudaine, refus de s'alimenter)
Dans le doute entre "surveiller" et "alerte", choisis "surveiller".

2. La répétition. "repetition" vaut true seulement si tout ce que signale la note figure déjà dans les points et alertes
des « trois derniers jours » (pas les plus anciens), sans aggravation. Un fait nouveau (ex. : en plus du mal de ventre, elle ne s'alimente plus) ou une aggravation : false.

Réponds UNIQUEMENT en JSON :
{"niveau": "surveiller", "repetition": false, "message": "Description courte qui commence par le prénom de la personne suivie, sans diagnostic"}
Pour une alerte née d'un problème qui revient, le message le dit (« ... depuis plusieurs jours »).
ou
{"niveau": "aucun"}`

const NIVEAUX = { surveiller: 'surveiller', alerte: 'warning', urgent: 'danger' }
const LIBELLES = { surveiller: 'Point à surveiller', warning: 'Alerte', danger: 'Urgent' }
const RANG = { surveiller: 1, warning: 2, danger: 3 }

// Doublons, décidés ici plutôt que par l'IA : une note qui ne fait que répéter ce qui a déjà été relevé
// n'est pas enregistrée si elle n'est pas plus grave que ce qui a été signalé aujourd'hui,
// et ne redéclenche pas de notification si une alerte a déjà été donnée ces trois derniers jours.
export function niveauRetenu(niveau, repetition, historique = [], maintenant = Date.now()) {
  if (!niveau || !repetition) return niveau
  const jour = d => new Date(d).toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris' })
  const rangMax = liste => Math.max(0, ...liste.map(a => RANG[a.niveau] || 0))
  const aujourdhui = historique.filter(a => jour(a.created_at) === jour(maintenant))
  const recents = historique.filter(a => maintenant - new Date(a.created_at) < 3 * 24 * 3600 * 1000)
  if (RANG[niveau] <= rangMax(aujourdhui)) return null
  if (niveau === 'warning' && rangMax(recents) >= RANG.warning) return 'surveiller'
  return niveau
}

// auteur : libellé de l'auteur de la note (« Julien Frentz · Petit-fils / Petite-fille »)
// noteId : note analysée, dont la suppression supprime l'alerte
export async function analyserAlertes(texte, seniorId, auteur = '', noteId = null) {
  try {
    const depuis = new Date(Date.now() - HISTORIQUE_JOURS * 24 * 60 * 60 * 1000).toISOString()
    const [{ data: senior }, { data: historique }] = await Promise.all([
      supabaseAdmin.from('seniors').select('name').eq('id', seniorId).maybeSingle(),
      supabaseAdmin.from('alertes').select('niveau, message, created_at')
        .eq('senior_id', seniorId).eq('type', 'signal_faible').gte('created_at', depuis)
        .order('created_at', { ascending: true }),
    ])
    const jour = d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
    // Les trois derniers jours à part : c'est à eux que se compare une répétition
    const recent = a => Date.now() - new Date(a.created_at) < 3 * 24 * 3600 * 1000
    const liste = l => l.length ? l.map(a => `- ${jour(a.created_at)} · ${LIBELLES[a.niveau] || 'Alerte'} : ${a.message}`).join('\n') : 'Aucun.'
    const historiqueTexte = `Trois derniers jours :\n${liste((historique || []).filter(recent))}\n`
      + `Plus anciens :\n${liste((historique || []).filter(a => !recent(a)))}`

    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      max_completion_tokens: 600,
      messages: [
        { role: 'system', content: CONSIGNE + '\n\n' + SURNOMS },
        { role: 'user', content: `Personne suivie : ${senior?.name || 'inconnue'}.\nAujourd'hui : ${jour(new Date())}.\n\nPoints et alertes des ${HISTORIQUE_JOURS} derniers jours :\n${historiqueTexte}\n\nAuteur de la note : ${auteurAvecLien(auteur)}.\n\nNote : ${texte}` },
      ],
    })
    const parsed = JSON.parse((completion.choices[0]?.message?.content || '{}').replace(/```json|```/g, '').trim())
    const niveau = niveauRetenu(NIVEAUX[parsed.niveau], parsed.repetition === true, historique || [])
    if (!niveau || !parsed.message) return null

    const alerte = {
      senior_id: seniorId,
      type: 'signal_faible',
      note_id: noteId,
      message: String(parsed.message).slice(0, 300),
      niveau,
      created_at: new Date().toISOString(),
    }
    const { error } = await supabaseAdmin.from('alertes').insert(alerte)
    if (error) throw error
    // Seules les alertes sont notifiées sur le téléphone des proches et de la structure
    if (niveau !== 'surveiller') {
      await envoyerPush({ userIds: await comptesDuSenior(seniorId, { intervenants: false }) }, {
        title: niveau === 'danger' ? '🚨 Alerte urgente' : '⚠️ Alerte',
        body: alerte.message,
        url: '/app',
        tag: 'alerte-' + seniorId,
      })
    }
    return alerte
  } catch (error) {
    // Une alerte manquée ne doit pas empêcher l'enregistrement de la note
    console.error('Erreur analyse alertes:', error.message)
    return null
  }
}
