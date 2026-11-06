import Groq from 'groq-sdk'
import { createHmac, timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/serveur'

// Détection des transcriptions « vides » : quand on n'a pas parlé (silence, bruit), le modèle de transcription
// invente souvent une phrase de sous-titres ou de politesse. On ne la propose pas comme note.

const RIEN_ENTENDU = "Nous n'avons rien entendu. Parlez près du micro et réessayez."

// Phrases inventées typiques, où qu'elles apparaissent dans le texte
const PARASITES = [
  /sous[- ]?titr/,
  /amara\.org/,
  /radio[- ]?canada/,
  /abonnez[- ]?vous/,
  /merci d.avoir regard/,
  /merci (a tous )?(de|pour) (votre|vos) (attention|regard|visionnage|ecoute)/,
]

// Textes entiers trop courts pour être une vraie note
const TEXTES_VIDES = new Set(['', 'merci', 'merci beaucoup', 'musique', 'au revoir', 'merci au revoir', 'bonjour', 'ok', 'euh', 'hum', 'bon', 'voila', 'a bientot', 'je vous remercie'])

const normaliser = texte => String(texte || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

// segments : réponse détaillée du modèle (probabilité d'absence de parole par passage)
export function transcriptionVide(texte, segments = []) {
  const t = normaliser(texte)
  const mots = t.replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim()
  if (TEXTES_VIDES.has(mots) || mots.length < 3) return true
  if (PARASITES.some(motif => motif.test(t))) return true
  return segments.length > 0 && segments.every(s => s.no_speech_prob > 0.6)
}

export { RIEN_ENTENDU }

// Contexte donné au modèle de transcription : les noms du dossier, pour qu'il les reconnaisse
// (« Jeanne va bien » et non « je vais à dire ça »). Ce texte n'est jamais renvoyé à l'appareil.
// contexte : phrase en français, pour la transcription en français et la mise au propre ;
// noms : les noms seuls, pour la transcription dans la langue détectée (une phrase en français la ferait basculer en français)
export async function contexteTranscription(seniorId) {
  if (!seniorId) return { contexte: '', noms: '' }
  const [{ data: senior }, { data: intervenants }, { data: famille }] = await Promise.all([
    supabaseAdmin.from('seniors').select('name').eq('id', seniorId).maybeSingle(),
    supabaseAdmin.from('intervenants').select('name').eq('senior_id', seniorId).is('archived_at', null),
    supabaseAdmin.from('famille').select('name').eq('senior_id', seniorId).is('archived_at', null),
  ])
  if (!senior?.name) return { contexte: '', noms: '' }
  const proches = [...new Set([...(intervenants || []), ...(famille || [])].map(p => p.name).filter(Boolean))].slice(0, 15)
  return {
    contexte: `Note de suivi pour ${senior.name}.` + (proches.length ? ` Proches et intervenants : ${proches.join(', ')}.` : ''),
    noms: [senior.name, ...proches].join(', ') + '.',
  }
}

// Sur un silence, le modèle recopie parfois son contexte : ce n'est pas une note
export function recopieContexte(texte, contexte) {
  const mots = normaliser(texte).replace(/[^\p{L}\p{N}' ]+/gu, ' ').trim()
  return !!contexte && mots.length > 0 && normaliser(contexte).replace(/[^\p{L}\p{N}' ]+/gu, ' ').includes(mots)
}

// Mise au propre fidèle d'un message (vocal transcrit ou écrit) : ni résumé ni interprétation
const MISE_AU_PROPRE = `Tu mets au propre le message laissé par un proche ou un intervenant qui accompagne une personne âgée à domicile.
Règles :
- Garde les mots, les tournures et le point de vue de la personne (je, nous, on). Ne résume pas.
- Garde tels quels les prénoms et les surnoms (papa, maman, papi, mamie, tonton, tata…).
- Retire seulement les hésitations (euh, hum, ben), les répétitions involontaires, les faux départs, les salutations ou formules de fin (bonjour, merci, au revoir, bonne journée, bisous) et la présentation de soi (« c'est Sylvie ») : l'auteur est déjà indiqué.
- Corrige la ponctuation, les majuscules et les erreurs évidentes de transcription.
- Si une phrase est confuse, mal construite ou n'a pas de sens tel quel (souvent un mot mal entendu par la transcription),
  réécris-la en français clair avec le sens le plus probable. Appuie-toi sur les noms du dossier quand ils sont fournis :
  un mot qui ressemble à l'oreille au prénom de la personne suivie ou d'un proche est probablement ce prénom.
  Ex. (dossier de Jeanne) : « jean elle a mangé » → « Jeanne a mangé » ; « je va bien ce soir » → « Jeanne va bien ce soir » ;
  « elle a le truc du machin qui marche plus la télécommande » → « Sa télécommande ne marche plus. »
- Une phrase déjà claire reste telle quelle. N'ajoute aucun fait, ne déduis rien, n'interprète pas.
  Si le sens d'un passage est impossible à retrouver, laisse-le tel quel plutôt que de deviner.
Réponds uniquement par le texte mis au propre.`

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Orthographe unique des surnoms qui se prononcent pareil : « papi », « mamie » (la transcription écrit souvent « papy », « mamy »)
const ORTHOGRAPHES = [[/\b([Pp])apy\b/g, '$1api'], [/\b([Mm])amy\b/g, '$1amie']]
export const harmoniserSurnoms = texte => ORTHOGRAPHES.reduce((t, [motif, rempl]) => t.replace(motif, rempl), String(texte || ''))

// contexte : noms du dossier (contexteTranscription), pour reconnaître un prénom mal entendu
export async function mettreAuPropre(texte, contexte = '') {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'medium',
      messages: [
        { role: 'system', content: MISE_AU_PROPRE },
        { role: 'user', content: (contexte ? `Dossier : ${contexte}\n\nMessage : ` : '') + texte },
      ],
      max_completion_tokens: 4000,
    })
    return harmoniserSurnoms(completion.choices[0]?.message?.content?.trim() || texte)
  } catch (error) {
    console.error('Erreur mise au propre:', error.message)
    return harmoniserSurnoms(texte)
  }
}

// ── Notes dans une autre langue ──
// Un message vocal est transcrit deux fois : en supposant du français (un fort accent fait sinon croire
// à une autre langue) et dans la langue détectée. L'IA garde la version qui a du sens et traduit en français.
// Le texte d'origine est conservé à part (table notes_traductions), consultable par les gestionnaires.

const TRADUCTION = `Tu mets au propre le message laissé par un proche ou un intervenant qui accompagne une personne âgée à domicile.
Le message peut être dans une autre langue que le français : la note publiée est toujours en français.

Pour un message vocal, tu reçois deux transcriptions du même enregistrement :
- la version A, transcrite en supposant que la personne parle français ;
- la version B, transcrite dans la langue que le modèle a détectée.
Si la personne parle français, même avec un fort accent étranger, pars de la version A (la B peut aider pour un mot mal entendu).
Si la personne parle une autre langue, la version A n'a pas de sens : pars de la version B et traduis-la.
Pour un message écrit, tu ne reçois qu'un texte.

Règles :
- Garde les mots, les tournures et le point de vue de la personne (je, nous, on). Ne résume pas.
- Garde tels quels les prénoms et les surnoms (papa, maman, papi, mamie, tonton, tata…).
- Retire seulement les hésitations (euh, hum, ben), les répétitions involontaires, les faux départs, les salutations ou formules de fin (bonjour, merci, au revoir, bonne journée, bisous) et la présentation de soi (« c'est Sylvie ») : l'auteur est déjà indiqué.
- Corrige la ponctuation, les majuscules et les erreurs évidentes de transcription.
- Si une phrase est confuse, mal construite ou n'a pas de sens tel quel (souvent un mot mal entendu par la transcription),
  réécris-la en français clair avec le sens le plus probable. Appuie-toi sur les noms du dossier quand ils sont fournis :
  un mot qui ressemble à l'oreille au prénom de la personne suivie ou d'un proche est probablement ce prénom,
  y compris dans une autre langue ou un autre alphabet (en arabe, « جان » ou « جاء » en tête de phrase peut être « Jeanne »).
  Ex. (dossier de Jeanne) : « jean elle a mangé » → « Jeanne a mangé » ; « je va bien ce soir » → « Jeanne va bien ce soir » ;
  « tout va bien au hourdoui » → « Tout va bien aujourd'hui » ; « et yetait de bon neumeur » → « et elle était de bonne humeur ».
- Une traduction est fidèle : même sens, même niveau de détail, rien d'ajouté ni d'interprété.
- Une phrase déjà claire reste telle quelle. N'ajoute aucun fait, ne déduis rien, n'interprète pas.
  Si le sens d'un passage est impossible à retrouver, laisse-le tel quel plutôt que de deviner.

Réponds UNIQUEMENT en JSON :
{"langue": "fr" si la personne parle ou écrit en français, sinon le nom en français de sa langue (« portugais », « arabe »…),
 "original": null en français, sinon le texte dans sa langue d'origine, mis au propre selon les mêmes règles,
 "note": "le texte final en français"}`

// francais / libre : les deux transcriptions d'un message vocal (langueDetectee : langue de la seconde) ;
// ecrit : un message écrit. Renvoie { note, langue, original } : langue et original sont null pour du français.
export async function preparerNote({ francais, libre, langueDetectee, ecrit }, contexte = '') {
  const message = ecrit != null
    ? `Message écrit : ${ecrit}`
    : `Version A (transcription en français) : ${francais || '(rien de compréhensible)'}\nVersion B (transcription dans la langue détectée${langueDetectee ? ', ' + langueDetectee : ''}) : ${libre}`
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'medium',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: TRADUCTION },
        { role: 'user', content: (contexte ? `Dossier : ${contexte}\n\n` : '') + message },
      ],
      max_completion_tokens: 4000,
    })
    const r = JSON.parse(completion.choices[0]?.message?.content || '{}')
    if (!r.note?.trim()) throw new Error('Réponse inattendue')
    const etrangere = r.langue && !/^(fr|français|francais)$/i.test(r.langue.trim()) && r.original?.trim()
    return {
      note: harmoniserSurnoms(r.note.trim()),
      langue: etrangere ? r.langue.trim().toLowerCase() : null,
      original: etrangere ? r.original.trim() : null,
    }
  } catch (error) {
    console.error('Erreur mise au propre / traduction:', error.message)
    const texte = ecrit ?? (francais || libre)
    return { note: harmoniserSurnoms(texte), langue: null, original: null }
  }
}

// Jeton signé renvoyé à l'appareil avec la note traduite : à l'enregistrement, le serveur retrouve
// la langue et le texte d'origine sans pouvoir se les voir imposer par l'appareil
const signerCharge = charge => createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update('traduction:' + charge).digest('base64url')

export function jetonTraduction({ langue, original }) {
  const charge = Buffer.from(JSON.stringify({ l: langue, o: original, e: Date.now() + 24 * 3600 * 1000 })).toString('base64url')
  return charge + '.' + signerCharge(charge)
}

// Renvoie { langue, original } si le jeton est authentique et encore valable, sinon null
export function lireTraduction(jeton) {
  const [charge, sig] = String(jeton || '').split('.')
  if (!charge || !sig) return null
  const attendu = Buffer.from(signerCharge(charge))
  const recu = Buffer.from(sig)
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null
  try {
    const { l, o, e } = JSON.parse(Buffer.from(charge, 'base64url').toString())
    if (!l || !o || Date.now() > e) return null
    return { langue: String(l).slice(0, 40), original: String(o).slice(0, 5000) }
  } catch { return null }
}
