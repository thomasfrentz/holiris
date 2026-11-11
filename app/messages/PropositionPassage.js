'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// Sous le message de Holiris : ajouter à l'agenda, en un clic, les passages réguliers qu'il propose
export default function PropositionPassage({ id }) {
  const [etat, setEtat] = useState(null) // { statut, passagesCrees } ou { erreur }
  const [envoi, setEnvoi] = useState(false)

  useEffect(() => {
    let annule = false
    fetch('/api/propositions-passage?id=' + id)
      .then(async r => { const d = await r.json(); if (!annule) setEtat(r.ok ? d : { erreur: d.error }) })
      .catch(() => { if (!annule) setEtat({ erreur: 'Erreur réseau' }) })
    return () => { annule = true }
  }, [id])

  async function repondre(accepter) {
    setEnvoi(true)
    try {
      const r = await (await fetch('/api/propositions-passage', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, accepter }) })).json()
      setEtat(r.success ? r : { ...etat, erreurEnvoi: r.error || 'Erreur, réessayez.' })
    } catch {
      setEtat({ ...etat, erreurEnvoi: 'Erreur réseau, réessayez.' })
    }
    setEnvoi(false)
  }

  const cadre = { maxWidth: '82%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid #CFE3D8', background: '#fff', fontSize: 13 }
  if (!etat || etat.erreur) return null
  if (etat.statut === 'acceptee') return (
    <div style={{ ...cadre, color: '#4A8870' }}>
      ✓ {etat.passagesCrees ?? 0} passage{etat.passagesCrees > 1 ? 's' : ''} ajouté{etat.passagesCrees > 1 ? 's' : ''} à l&apos;agenda, pour les 3 prochains mois.{' '}
      <Link href="/agenda" style={{ color: '#4A8870', fontWeight: 500 }}>Voir l&apos;agenda</Link>
    </div>
  )
  if (etat.statut === 'refusee') return <div style={{ ...cadre, color: '#9BB5AA' }}>Vous avez choisi de ne pas ajouter ces passages.</div>
  return (
    <div style={cadre}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => repondre(true)} disabled={envoi}
          style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: envoi ? 0.6 : 1 }}>
          {envoi ? '…' : 'Ajouter à l\'agenda'}
        </button>
        <button onClick={() => repondre(false)} disabled={envoi}
          style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
          Non merci
        </button>
      </div>
      {etat.erreurEnvoi && <div style={{ color: '#C4606A', marginTop: 6 }}>{etat.erreurEnvoi}</div>}
      <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 6 }}>Un passage chaque semaine à ces jours et à cette heure, pendant 3 mois.</div>
    </div>
  )
}
