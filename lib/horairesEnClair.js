// Jours et heure d'un passage récurrent, en clair (serveur et navigateur)
export const NOMS_JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const deux = n => String(n).padStart(2, '0')

// « le mardi et le jeudi », « du lundi au vendredi », « tous les jours »
export function joursEnClair(jours) {
  const tries = [...new Set(jours.map(Number))].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7))
  if (tries.length === 7) return 'tous les jours'
  if (tries.join() === '1,2,3,4,5') return 'du lundi au vendredi'
  const noms = tries.map(j => 'le ' + NOMS_JOURS[j])
  return noms.length > 1 ? noms.slice(0, -1).join(', ') + ' et ' + noms[noms.length - 1] : noms[0]
}

export const heureEnClair = heure => { const [h, m] = heure.split(':').map(Number); return h + ' h' + (m ? ' ' + deux(m) : '') }
