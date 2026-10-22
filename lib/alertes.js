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

Niveaux :
- "aucun" : rien à signaler, ou la note montre une amélioration d'un problème déjà relevé
- "surveiller" : petit signal isolé, sans gravité (fatigue, petite douleur, moins d'appétit un jour, moral un peu bas). C'est le cas le plus fréquent.
- "alerte" : un problème mineur qui revient sans amélioration, c'est-à-dire déjà relevé au moins deux jours différents dans l'historique ; ou un événement important sans urgence (perte de poids, médicaments non pris plusieurs fois, refus d'aide, isolement marqué)
- "urgent" : situation à traiter rapidement (chute, détresse, confusion soudaine, refus de s'alimenter)

Dans le doute entre "surveiller" et "alerte", choisis "surveiller".
Si le même point a déjà été relevé aujourd'hui, réponds "aucun" (sauf aggravation).
Si une alerte sur le même problème a déjà été donnée ces trois derniers jours, réponds "surveiller" (sauf aggravation).

Réponds UNIQUEMENT en JSON :
{"niveau": "surveiller", "message": "Description courte qui commence par le prénom de la personne suivie, sans diagnostic"}
Pour une alerte née d'un problème qui revient, le message le dit (« ... depuis plusieurs jours »).
ou
{"niveau": "aucun"}`

const NIVEAUX = { surveiller: 'surveiller', alerte: 'warning', urgent: 'danger' }
const LIBELLES = { surveiller: 'Point à surveiller', warning: 'Alerte', danger: 'Urgent' }

// auteur : libellé de l'auteur de la note (« Julien Frentz · Petit-fils / Petite-fille »)
export async function analyserAlertes(texte, seniorId, auteur = '') {
  try {
    const depuis = new Date(Date.now() - HISTORIQUE_JOURS * 24 * 60 * 60 * 1000).toISOString()
    const [{ data: senior }, { data: historique }] = await Promise.all([
      supabaseAdmin.from('seniors').select('name').eq('id', seniorId).maybeSingle(),
      supabaseAdmin.from('alertes').select('niveau, message, created_at')
        .eq('senior_id', seniorId).eq('type', 'signal_faible').gte('created_at', depuis)
        .order('created_at', { ascending: true }),
    ])
    const jour = d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })
    const historiqueTexte = historique?.length
      ? historique.map(a => `- ${jour(a.created_at)} · ${LIBELLES[a.niveau] || 'Alerte'} : ${a.message}`).join('\n')
      : 'Aucun.'

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
    const niveau = NIVEAUX[parsed.niveau]
    if (!niveau || !parsed.message) return null

    const alerte = {
      senior_id: seniorId,
      type: 'signal_faible',
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
