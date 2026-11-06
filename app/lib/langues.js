// « Traduit du portugais », « Traduit de l'arabe » : mention affichée sous une note traduite en français
export function traduitDe(langue) {
  if (!langue) return ''
  return 'Traduit ' + (/^[aeiouyhéèêâî]/i.test(langue) ? 'de l’' : 'du ') + langue
}
