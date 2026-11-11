'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { NOMS_JOURS, joursEnClair, heureEnClair } from '@/lib/horairesEnClair'

const SEMAINE = ['1', '2', '3', '4', '5', '6', '0'] // du lundi au dimanche

// Sous le message de Holiris : ajouter à l'agenda, en un clic, les passages réguliers qu'il propose,
// ou les ajouter à d'autres jours ou à une autre heure si la proposition ne convient pas
export default function PropositionPassage({ id }) {
  const [etat, setEtat] = useState(null) // { statut, jours, heure, passagesCrees } ou { erreur }
  const [envoi, setEnvoi] = useState(false)
  const [modif, setModif] = useState(null) // { jours: ['2', '4'], heure: '09:30' } pendant la modification
  const [erreurEnvoi, setErreurEnvoi] = useState('')

  useEffect(() => {
    let annule = false
    fetch('/api/propositions-passage?id=' + id)
      .then(async r => { const d = await r.json(); if (!annule) setEtat(r.ok ? d : { erreur: d.error }) })
      .catch(() => { if (!annule) setEtat({ erreur: 'Erreur réseau' }) })
    return () => { annule = true }
  }, [id])

  async function repondre(accepter, horaire) {
    setEnvoi(true); setErreurEnvoi('')
    try {
      const r = await (await fetch('/api/propositions-passage', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, accepter, ...(horaire || {}) }),
      })).json()
      if (r.success) { setEtat(r); setModif(null) } else setErreurEnvoi(r.error || 'Erreur, réessayez.')
    } catch {
      setErreurEnvoi('Erreur réseau, réessayez.')
    }
    setEnvoi(false)
  }

  const cadre = { maxWidth: '82%', marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid #CFE3D8', background: '#fff', fontSize: 13 }
  const bouton = { border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
  const principal = { ...bouton, background: '#7FAF9B', color: '#fff', fontWeight: 500, opacity: envoi ? 0.6 : 1 }
  const secondaire = { ...bouton, background: '#F4F5F5', color: '#6F7C75' }
  if (!etat || etat.erreur) return null
  const horaire = joursEnClair(etat.jours.split(',')) + ' à ' + heureEnClair(etat.heure)

  if (etat.statut === 'acceptee') return (
    <div style={{ ...cadre, color: '#4A8870' }}>
      ✓ {etat.passagesCrees ?? 0} passage{etat.passagesCrees > 1 ? 's' : ''} ajouté{etat.passagesCrees > 1 ? 's' : ''} à l&apos;agenda, {horaire}, pour les 3 prochains mois.{' '}
      <Link href="/agenda" style={{ color: '#4A8870', fontWeight: 500 }}>Voir l&apos;agenda</Link>
    </div>
  )
  if (etat.statut === 'refusee') return <div style={{ ...cadre, color: '#9BB5AA' }}>Vous avez choisi de ne pas ajouter ces passages.</div>

  if (modif) {
    const valide = modif.jours.length > 0 && /^\d{2}:\d{2}$/.test(modif.heure)
    return (
      <div style={cadre}>
        <div style={{ color: '#1F2A24', fontWeight: 500, marginBottom: 8 }}>Quand passez-vous ?</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {SEMAINE.map(j => {
            const coche = modif.jours.includes(j)
            return (
              <button key={j} type="button" onClick={() => setModif({ ...modif, jours: coche ? modif.jours.filter(x => x !== j) : [...modif.jours, j] })}
                style={{ ...bouton, padding: '6px 10px', fontSize: 12, border: '1px solid ' + (coche ? '#7FAF9B' : '#E8EFEB'), background: coche ? '#EAF4EF' : '#fff', color: coche ? '#4A8870' : '#6F7C75' }}>
                {NOMS_JOURS[j].slice(0, 3)}
              </button>
            )
          })}
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6F7C75', marginBottom: 10 }}>
          Heure d&apos;arrivée
          <input type="time" value={modif.heure} onChange={e => setModif({ ...modif, heure: e.target.value })}
            style={{ padding: '6px 10px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#FAFCFC' }} />
        </label>
        {valide && <div style={{ fontSize: 12, color: '#6F7C75', marginBottom: 8 }}>Un passage {joursEnClair(modif.jours)} à {heureEnClair(modif.heure)}, chaque semaine pendant 3 mois.</div>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => repondre(true, modif)} disabled={envoi || !valide} style={{ ...principal, opacity: envoi || !valide ? 0.5 : 1 }}>
            {envoi ? '…' : 'Ajouter à l\'agenda'}
          </button>
          <button onClick={() => { setModif(null); setErreurEnvoi('') }} disabled={envoi} style={secondaire}>Annuler</button>
        </div>
        {erreurEnvoi && <div style={{ color: '#C4606A', marginTop: 6 }}>{erreurEnvoi}</div>}
      </div>
    )
  }

  return (
    <div style={cadre}>
      <div style={{ color: '#1F2A24', marginBottom: 8 }}>Proposition : un passage <strong style={{ fontWeight: 500 }}>{horaire}</strong>, chaque semaine pendant 3 mois.</div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button onClick={() => repondre(true)} disabled={envoi} style={principal}>{envoi ? '…' : 'Ajouter à l\'agenda'}</button>
        <button onClick={() => setModif({ jours: etat.jours.split(','), heure: etat.heure })} disabled={envoi}
          style={{ ...bouton, background: '#fff', color: '#4A8870', border: '1px solid #7FAF9B' }}>
          Modifier l&apos;horaire
        </button>
        <button onClick={() => repondre(false)} disabled={envoi} style={secondaire}>Non merci</button>
      </div>
      {erreurEnvoi && <div style={{ color: '#C4606A', marginTop: 6 }}>{erreurEnvoi}</div>}
    </div>
  )
}
