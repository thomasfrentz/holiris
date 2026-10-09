// Détection des signaux faibles dans les notes (côté serveur uniquement)
// Appelée à l'enregistrement de chaque note, quel que soit le canal (WhatsApp, borne, application, carnet)
import Groq from 'groq-sdk'
import { supabaseAdmin } from '@/lib/serveur'
import { SURNOMS, auteurAvecLien } from '@/lib/contexteIA'
import { envoyerPush, comptesDuSenior } from '@/lib/push'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const CONSIGNE = `Tu es l'assistant IA de Holiris. Analyse cette note sur une personne âgée suivie à domicile
et détecte les signaux faibles qui méritent une alerte pour la famille.

Signaux à surveiller :
- Douleurs (genou, dos, tête, abdomen...)
- Chute ou risque de chute
- Problèmes alimentaires (ne mange pas, perd du poids...)
- Troubles cognitifs (confusion, mémoire, désorientation...)
- Problèmes de mobilité
- Moral bas, tristesse, isolement
- Médicaments non pris
- Symptômes inhabituels

Niveaux :
- "danger" : situation à traiter rapidement (chute, détresse, confusion soudaine, refus de s'alimenter)
- "warning" : signal à surveiller dans les prochains jours

Réponds UNIQUEMENT en JSON :
{"alerte": true, "niveau": "warning", "message": "Description courte qui commence par le prénom de la personne suivie, sans diagnostic"}
ou
{"alerte": false}`

// auteur : libellé de l'auteur de la note (« Julien Frentz · Petit-fils / Petite-fille »)
export async function analyserAlertes(texte, seniorId, auteur = '') {
  try {
    const { data: senior } = await supabaseAdmin.from('seniors').select('name').eq('id', seniorId).maybeSingle()
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      max_completion_tokens: 450,
      messages: [
        { role: 'system', content: CONSIGNE + '\n\n' + SURNOMS },
        { role: 'user', content: `Personne suivie : ${senior?.name || 'inconnue'}.\nAuteur de la note : ${auteurAvecLien(auteur)}.\n\nNote : ${texte}` },
      ],
    })
    const parsed = JSON.parse((completion.choices[0]?.message?.content || '{}').replace(/```json|```/g, '').trim())
    if (!parsed.alerte || !parsed.message) return null

    const alerte = {
      senior_id: seniorId,
      type: 'signal_faible',
      message: String(parsed.message).slice(0, 300),
      niveau: parsed.niveau === 'danger' ? 'danger' : 'warning',
      created_at: new Date().toISOString(),
    }
    const { error } = await supabaseAdmin.from('alertes').insert(alerte)
    if (error) throw error
    // Notification sur le téléphone des proches et de la structure
    await envoyerPush({ userIds: await comptesDuSenior(seniorId, { intervenants: false }) }, {
      title: alerte.niveau === 'danger' ? '🚨 Alerte urgente' : '⚠️ À surveiller',
      body: alerte.message,
      url: '/app',
      tag: 'alerte-' + seniorId,
    })
    return alerte
  } catch (error) {
    // Une alerte manquée ne doit pas empêcher l'enregistrement de la note
    console.error('Erreur analyse alertes:', error.message)
    return null
  }
}
