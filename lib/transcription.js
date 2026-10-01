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
