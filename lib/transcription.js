import Groq from 'groq-sdk'

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
  const mots = t.replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()
  if (TEXTES_VIDES.has(mots) || mots.length < 3) return true
  if (PARASITES.some(motif => motif.test(t))) return true
  return segments.length > 0 && segments.every(s => s.no_speech_prob > 0.6)
}

export { RIEN_ENTENDU }

// Mise au propre fidèle d'un message (vocal transcrit ou écrit) : ni résumé ni interprétation
const MISE_AU_PROPRE = `Tu mets au propre le message laissé par un proche ou un intervenant qui accompagne une personne âgée à domicile.
Règles :
- Garde les mots, les tournures et le point de vue de la personne (je, nous, on). Ne reformule pas, ne résume pas.
- Garde tels quels les prénoms et les surnoms (papa, maman, papi, mamie, tonton, tata…).
- Retire seulement les hésitations (euh, hum, ben), les répétitions involontaires, les faux départs, les salutations ou formules de fin (bonjour, merci, au revoir, bonne journée, bisous) et la présentation de soi (« c'est Sylvie ») : l'auteur est déjà indiqué.
- Corrige la ponctuation, les majuscules et les erreurs évidentes de transcription.
- N'ajoute rien, ne déduis rien, n'interprète pas.
Réponds uniquement par le texte mis au propre.`

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Orthographe unique des surnoms qui se prononcent pareil : « papi », « mamie » (la transcription écrit souvent « papy », « mamy »)
const ORTHOGRAPHES = [[/\b([Pp])apy\b/g, '$1api'], [/\b([Mm])amy\b/g, '$1amie']]
export const harmoniserSurnoms = texte => ORTHOGRAPHES.reduce((t, [motif, rempl]) => t.replace(motif, rempl), String(texte || ''))

export async function mettreAuPropre(texte) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      reasoning_effort: 'low',
      messages: [
        { role: 'system', content: MISE_AU_PROPRE },
        { role: 'user', content: texte },
      ],
      max_completion_tokens: 1200,
    })
    return harmoniserSurnoms(completion.choices[0]?.message?.content?.trim() || texte)
  } catch (error) {
    console.error('Erreur mise au propre:', error.message)
    return harmoniserSurnoms(texte)
  }
}
