'use client'
import { useState, useEffect } from 'react'
import PropositionRdv from './PropositionRdv'

// Tableau de bord : rendez-vous relevés par Holiris dans les notes et messages du dossier, pas encore à l'agenda.
// derniereNote : relu quelques secondes après chaque nouvelle note (le temps que Holiris l'analyse)
export default function RdvAAjouter({ seniorId, derniereNote }) {
  const [propositions, setPropositions] = useState([])

  useEffect(() => {
    if (!seniorId) return
    let actif = true
    const minuterie = setTimeout(() => {
      fetch('/api/propositions-rdv?seniorId=' + seniorId).then(r => r.json())
        .then(d => { if (actif && d.propositions) setPropositions(d.propositions.filter(p => p.statut === 'proposee')) }).catch(() => {})
    }, derniereNote ? 4000 : 0)
    return () => { actif = false; clearTimeout(minuterie) }
  }, [seniorId, derniereNote])

  if (!propositions.length) return null
  return (
    <div style={{ marginBottom: 36 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Rendez-vous à ajouter</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {propositions.map(p => (
          <div key={p.id}>
            <div style={{ fontSize: 12, color: '#9BB5AA', marginBottom: 2 }}>D&apos;après {p.noteId ? 'la note' : 'le message'} de {p.auteur}</div>
            <PropositionRdv proposition={p} style={{ marginTop: 0, padding: '14px 18px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}
