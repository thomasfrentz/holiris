// Filtre des informations médicales dans les notes (côté serveur uniquement)
//
// Une information médicale n'est jamais enregistrée sur Holiris. Seule la partie non médicale
// de la note est publiée, et un signalement (sans contenu médical) permet de demander à l'auteur
// si l'information est essentielle, puis à la personne de confiance de le recontacter.
import Groq from 'groq-sdk'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/serveur'
import { escapeHtml, emailContactMedical } from '@/lib/emails'
import { analyserAlertes } from '@/lib/alertes'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)

const CONSIGNE = `Tu protèges les données de santé de personnes âgées suivies à domicile.
Une note d'un intervenant ou d'un proche t'est transmise. Retire SEULEMENT ces trois choses, et conserve tout le reste :
1. un diagnostic ou une maladie nommée (ex : diabète, Alzheimer, infection urinaire, bronchite, AVC)
2. le nom d'un médicament, un dosage, une posologie ou un changement de traitement
3. un résultat précis d'examen : une valeur chiffrée (tension 15/9, glycémie 1,8, 38,5 de fièvre, saturation 92 %) ou la conclusion médicale d'un examen (« la prise de sang montre une anémie »)

Tout le reste se conserve, notamment :
- les examens et contrôles eux-mêmes, faits ou prévus : « prise de sang faite ce matin », « tension contrôlée », « radio prévue jeudi », « bilan sanguin à faire »
- une appréciation générale sans chiffre ni diagnostic : « la tension est correcte », « les résultats sont rassurants »
- les symptômes décrits avec des mots de tous les jours : toux, mal de gorge, vomissements, diarrhée, fièvre ressentie, douleur, vertiges, essoufflement, constipation
- les soins courants, les rendez-vous médicaux (sans leur motif médical), les ordonnances et les médicaments sans les nommer (pris, oubliés, livrés, pilulier préparé)
- le poids, le moral, l'appétit, le sommeil, la fatigue, la mobilité, une chute, les activités et la vie quotidienne

Quand tu retires un résultat, garde la mention de l'examen : « Tension à 15/9 » → « Tension contrôlée. » ; « La prise de sang montre une anémie » → « Les résultats de la prise de sang sont arrivés. »
Dans le doute, conserve.
Ex : « Prise de sang faite ce matin, le médecin pense à une anémie. Tension contrôlée à 15/9, il tousse. » → « Prise de sang faite ce matin. Tension contrôlée, il tousse. »

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
    // Signaux faibles : calculés sur la partie publiée, sans information médicale
    await analyserAlertes(note, seniorId, label)
  }

  const signalementId = medical ? await creerSignalement({ seniorId, auteur, source }) : null

  return { medical, note, noteEnregistree, signalementId }
}

// Signalement d'une information médicale retirée (sans son contenu) : renvoie son identifiant
export async function creerSignalement({ seniorId, auteur, source }) {
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
  if (error) { console.error('Erreur signalement médical:', error.message); return null }
  return data.id
}

// Réponse de l'auteur : l'information est-elle essentielle ?
export async function repondreSignalement(id, essentiel) {
  const { data: sig } = await supabaseAdmin
    .from('signalements_medicaux')
    .select('*, seniors(id, name, personne_confiance_id, structure_id)')
    .eq('id', id).single()
  if (!sig || sig.statut !== 'a_confirmer') return { ok: false, error: 'Signalement introuvable ou déjà traité' }

  if (!essentiel) {
    await supabaseAdmin.from('signalements_medicaux')
      .update({ statut: 'non_essentiel', repondu_at: new Date().toISOString() })
      .eq('id', id)
    return { ok: true }
  }

  // Destinataire : la personne de confiance, sinon les gestionnaires de la structure, sinon l'admin
  let destinataires = []
  let destinataireFamilleId = null
  const pdcId = sig.seniors?.personne_confiance_id
  if (pdcId) {
    const { data: pdc } = await supabaseAdmin.from('famille')
      .select('id, name, email').eq('id', pdcId).is('archived_at', null).maybeSingle()
    if (pdc?.email) { destinataires = [pdc]; destinataireFamilleId = pdc.id }
  }
  if (!destinataires.length && sig.seniors?.structure_id) {
    const { data: gestionnaires } = await supabaseAdmin.from('structure_membres')
      .select('id, nom, email').eq('structure_id', sig.seniors.structure_id).not('user_id', 'is', null)
    destinataires = (gestionnaires || []).map(g => ({ id: g.id, name: g.nom || g.email.split('@')[0], email: g.email }))
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
