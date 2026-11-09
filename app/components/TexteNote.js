// Texte d'une note ; « Note enregistrée » quand son détail est réservé à un autre corps de métier (notes_dossier.lisible)
export default function TexteNote({ note, style }) {
  if (note.lisible === false) {
    return <p style={{ ...style, color: '#9BA8A1', fontStyle: 'italic', fontWeight: 400 }}>Note enregistrée</p>
  }
  return <p style={style}>{note.content}</p>
}
