// Filtre des informations médicales dans les notes (côté serveur uniquement)
//
// Une information médicale n'est jamais enregistrée sur Holiris. Seule la partie non médicale
// de la note est publiée, et un signalement (sans contenu médical) permet de demander à l'auteur
// si l'information est essentielle, puis à la personne de confiance de le recontacter.
import Groq from 'groq-sdk'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/serveur'
import { escapeHtml, emailContactMedical } from '@/lib/emails'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)

const CONSIGNE = `Tu protèges les données de santé de personnes âgées suivies à domicile.
Une note d'un intervenant ou d'un proche t'est transmise.

Est une INFORMATION MÉDICALE (à retirer) :
- un diagnostic ou une maladie nommée (ex : diabète, Alzheimer, infection urinaire, AVC)
- un traitement : nom de médicament, dosage, posologie, changement de traitement
- un résultat d'examen ou une mesure médicale (prise de sang, radio, tension, glycémie, saturation…)
- un acte ou une consultation médicale avec son motif
- une hospitalisation (le séjour lui-même, pas seulement sa raison)
- le contenu d'une ordonnance

N'est PAS une information médicale (à conserver) :
- le moral, l'humeur, la fatigue, l'appétit, le sommeil, la mobilité, une chute, une douleur exprimée
- les activités, les visites, la vie quotidienne
- le fait d'avoir pris ou non « ses médicaments », sans les nommer

Réponds UNIQUEMENT en JSON :
{"medical": true|false, "note": "la note réécrite sans aucune information médicale, ou chaîne vide s'il ne reste rien"}
Si medical est false, "note" reprend la note telle quelle.
Si medical est true, "note" doit rester en français correct et naturel : reformule les phrases concernées, sans mot manquant ni allusion à ce qui a été retiré.`

export async function analyserNote(texte) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      max_completion_tokens: 800,
      messages: [
        { role: 'system', content: CONSIGNE },
        { role: 'user', content: texte },
      ],
    })
    const parsed = JSON.parse(completion.choices[0]?.message?.content || '{}')
    if (typeof parsed.medical !== 'boolean') throw new Error('Réponse inattendue')
    return { medical: parsed.medical, note: (parsed.medical ? parsed.note : texte)?.trim() || '' }
  } catch (error) {
    // En cas d'échec de l'analyse, la note est enregistrée telle quelle (comportement antérieur)
    console.error('Erreur analyse médicale:', error.message)
    return { medical: false, note: texte }
  }
}

// auteur : { type: 'intervenant' | 'famille', id, nom, role, telephone, email }
// analyse : résultat d'analyserNote déjà obtenu (note WhatsApp relue par son auteur)
export async function enregistrerNote({ seniorId, texte, source, auteur, analyse }) {
  const { medical, note } = analyse || await analyserNote(texte)
  const label = auteur.nom + (auteur.role ? ' · ' + auteur.role : '')

  let noteEnregistree = null
  if (note) {
    const { data, error } = await supabaseAdmin.from('notes').insert({
      senior_id: seniorId,
      content: note,
      source,
      intervenant_name: label,
      created_at: new Date().toISOString(),
    }).select().single()
    if (error) throw error
    noteEnregistree = data
  }

  let signalementId = null
  if (medical) {
    const { data, error } = await supabaseAdmin.from('signalements_medicaux').insert({
      senior_id: seniorId,
      auteur_type: auteur.type,
      auteur_id: auteur.id || null,
      auteur_nom: auteur.nom,
      auteur_role: auteur.role || null,
      auteur_telephone: auteur.telephone || null,
      auteur_email: auteur.email || null,
      source: source.startsWith('whatsapp') ? 'whatsapp' : source,
    }).select('id').single()
    if (error) console.error('Erreur signalement médical:', error.message)
    else signalementId = data.id
  }

  return { medical, note, noteEnregistree, signalementId }
}

// Réponse de l'auteur : l'information est-elle essentielle ?
export async function repondreSignalement(id, essentiel) {
  const { data: sig } = await supabaseAdmin
    .from('signalements_medicaux')
    .select('*, seniors(id, name, personne_confiance_id)')
    .eq('id', id).single()
  if (!sig || sig.statut !== 'a_confirmer') return { ok: false, error: 'Signalement introuvable ou déjà traité' }

  if (!essentiel) {
    await supabaseAdmin.from('signalements_medicaux')
      .update({ statut: 'non_essentiel', repondu_at: new Date().toISOString() })
      .eq('id', id)
    return { ok: true }
  }

  // Destinataire : la personne de confiance, sinon l'admin
  let destinataires = []
  let destinataireFamilleId = null
  const pdcId = sig.seniors?.personne_confiance_id
  if (pdcId) {
    const { data: pdc } = await supabaseAdmin.from('famille')
      .select('id, name, email').eq('id', pdcId).is('archived_at', null).maybeSingle()
    if (pdc?.email) { destinataires = [pdc]; destinataireFamilleId = pdc.id }
  }
  if (!destinataires.length) {
    const { data: admins } = await supabaseAdmin.from('famille')
      .select('id, name, email').eq('is_admin', true).not('email', 'is', null)
    // Une seule adresse par admin
    destinataires = [...new Map((admins || []).map(a => [a.email.toLowerCase(), a])).values()]
  }

  await supabaseAdmin.from('signalements_medicaux')
    .update({ statut: 'a_contacter', repondu_at: new Date().toISOString(), destinataire_famille_id: destinataireFamilleId })
    .eq('id', id)

  // L'auteur est lui-même la personne de confiance : rien à envoyer
  const auteurEstDestinataire = sig.auteur_type === 'famille' && sig.auteur_id === destinataireFamilleId
  if (!auteurEstDestinataire && destinataires.length) {
    const { error } = await resend.batch.send(destinataires.map(d => ({
      from: 'Holiris <contact@holiris.fr>',
      to: d.email,
      subject: 'À contacter : ' + sig.auteur_nom + ' — suivi de ' + (sig.seniors?.name || ''),
      html: emailContactMedical({
        prenom: escapeHtml(d.name?.split(' ')[0]),
        seniorName: escapeHtml(sig.seniors?.name),
        auteurNom: escapeHtml(sig.auteur_nom),
        auteurRole: escapeHtml(sig.auteur_role),
        telephone: escapeHtml(sig.auteur_telephone),
        email: escapeHtml(sig.auteur_email),
        sansPersonneConfiance: !destinataireFamilleId,
      }),
    })))
    if (error) console.error('Erreur email personne de confiance:', error)
  }

  const nomDestinataire = destinataireFamilleId ? destinataires[0].name : null
  return { ok: true, destinataire: nomDestinataire, auteurEstDestinataire }
}
