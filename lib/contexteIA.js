// Analyses de notes par l'IA : comprendre les surnoms familiaux (papa, papi, tonton…)
// Utilisable côté serveur et côté navigateur (aucune dépendance).

// Mots qui désignent la personne suivie, selon le lien de l'auteur avec elle
const LIENS = [
  { motif: /petit[- ]?(fils|fille|enfant)/i, mots: '« papi », « papy », « pépé », « mamie », « mamy », « mémé », « grand-père », « grand-mère »', autres: '« papa » et « maman » sont ses propres parents' },
  { motif: /\b(fils|fille|enfant)\b/i, mots: '« papa », « maman », « mon père », « ma mère »', autres: '« papi » et « mamie » sont ses grands-parents' },
  { motif: /neveu|ni[eè]ce/i, mots: '« tonton », « tata », « mon oncle », « ma tante »', autres: '« papa » et « maman » sont ses propres parents' },
  { motif: /fr[eè]re|s(œ|oe)ur/i, mots: '« mon frère », « ma sœur »', autres: '« papa » et « maman » sont leurs parents' },
  { motif: /conjoint|[ée]poux|[ée]pouse|mari\b|femme/i, mots: '« mon mari », « ma femme », « mon épouse », « mon époux »', autres: '' },
]

// Libellé de l'auteur complété, ex. « Julien · Petit-fils / Petite-fille (pour cet auteur, « papi »… = la personne suivie ; « papa » et « maman » sont ses propres parents) »
export function auteurAvecLien(libelle) {
  const lien = LIENS.find(l => l.motif.test(String(libelle || '').split('·').slice(1).join('·')))
  if (!lien) return libelle || 'Auteur inconnu'
  return `${libelle} (pour cet auteur, ${lien.mots} désignent la personne suivie${lien.autres ? ' ; ' + lien.autres : ''})`
}

export const SURNOMS = `Les proches désignent souvent la personne suivie par un nom affectif (papa, papi, mamie, tonton…). Pour chaque note, l'auteur est indiqué avec les mots qui, pour lui, désignent la personne suivie. Tout ce qui concerne quelqu'un d'autre (parents de l'auteur, voisins, autres membres de la famille) ne concerne pas la personne suivie : ignore-le. Quand tu écris, désigne la personne suivie par son prénom, jamais par un surnom.`
