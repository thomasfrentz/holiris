'use client'
import { useState } from 'react'
import Link from 'next/link'
import { heureEnClair } from '@/lib/horairesEnClair'

const TYPES = [['medical', '🏥 Médical'], ['kine', '🦵 Kinésithérapie'], ['pharmacy', '💊 Pharmacie'], ['care', '🤝 Autre']]
const jourEnClair = date => new Date(date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

// Rendez-vous relevé par Holiris dans une note ou un message : l'ajouter à l'agenda en un clic,
// le corriger avant (jour, heure, libellé, type) ou l'ignorer
export default function PropositionRdv({ proposition, onChange, style }) {
  const [p, setP] = useState(proposition)
  const [modif, setModif] = useState(null) // { libelle, date, heure, type } pendant la correction
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')

  async function repondre(ajouter, champs) {
    setEnvoi(true); setErreur('')
    try {
      const r = await (await fetch('/api/propositions-rdv', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: p.id, ajouter, ...(champs || {}) }),
      })).json()
      if (r.success) { setP(r.proposition); setModif(null); onChange?.(r.proposition) } else setErreur(r.error || 'Erreur, réessayez.')
    } catch {
      setErreur('Erreur réseau, réessayez.')
    }
    setEnvoi(false)
  }

  const cadre = { marginTop: 6, padding: '10px 12px', borderRadius: 12, border: '1px solid #CFE3D8', background: '#fff', fontSize: 13, ...style }
  const bouton = { border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }
  const principal = { ...bouton, background: '#7FAF9B', color: '#fff', fontWeight: 500, opacity: envoi ? 0.6 : 1 }
  const secondaire = { ...bouton, background: '#F4F5F5', color: '#6F7C75' }
  const champ = { padding: '6px 10px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', background: '#FAFCFC' }
  const quand = jourEnClair(p.date) + (p.heure ? ' à ' + heureEnClair(p.heure) : '')

  if (p.statut === 'ajoutee') return (
    <div style={{ ...cadre, color: '#4A8870' }}>
      ✓ {p.libelle} ajouté à l&apos;agenda, {quand}.{' '}
      <Link href="/agenda" style={{ color: '#4A8870', fontWeight: 500 }}>Voir l&apos;agenda</Link>
    </div>
  )
  if (p.statut === 'ignoree') return null

  if (modif) {
    const valide = modif.libelle.trim() && /^\d{4}-\d{2}-\d{2}$/.test(modif.date) && /^\d{2}:\d{2}$/.test(modif.heure)
    return (
      <div style={cadre}>
        <div style={{ color: '#1F2A24', fontWeight: 500, marginBottom: 8 }}>Rendez-vous à ajouter</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          <input value={modif.libelle} onChange={e => setModif({ ...modif, libelle: e.target.value })} placeholder="Ex. Dentiste" style={champ} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input type="date" value={modif.date} onChange={e => setModif({ ...modif, date: e.target.value })} style={champ} />
            <input type="time" value={modif.heure} onChange={e => setModif({ ...modif, heure: e.target.value })} style={champ} />
            <select value={modif.type} onChange={e => setModif({ ...modif, type: e.target.value })} style={champ}>
              {TYPES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={() => repondre(true, modif)} disabled={envoi || !valide} style={{ ...principal, opacity: envoi || !valide ? 0.5 : 1 }}>
            {envoi ? '…' : 'Ajouter à l\'agenda'}
          </button>
          <button onClick={() => { setModif(null); setErreur('') }} disabled={envoi} style={secondaire}>Annuler</button>
        </div>
        {erreur && <div style={{ color: '#C4606A', marginTop: 6 }}>{erreur}</div>}
      </div>
    )
  }

  const corriger = () => setModif({ libelle: p.libelle, date: p.date, heure: p.heure || '', type: p.type })
  return (
    <div style={cadre}>
      <div style={{ color: '#1F2A24', marginBottom: 8, lineHeight: 1.5 }}>
        📅 Rendez-vous mentionné : <strong style={{ fontWeight: 500 }}>{p.libelle}</strong>, {quand}.
        {!p.heure && <span style={{ color: '#9BB5AA' }}> Précisez l&apos;heure pour l&apos;ajouter.</span>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {p.heure
          ? <button onClick={() => repondre(true)} disabled={envoi} style={principal}>{envoi ? '…' : 'Ajouter à l\'agenda'}</button>
          : <button onClick={corriger} disabled={envoi} style={principal}>Indiquer l&apos;heure</button>}
        {p.heure && (
          <button onClick={corriger} disabled={envoi} style={{ ...bouton, background: '#fff', color: '#4A8870', border: '1px solid #7FAF9B' }}>Modifier</button>
        )}
        <button onClick={() => repondre(false)} disabled={envoi} style={secondaire}>Ignorer</button>
      </div>
      {erreur && <div style={{ color: '#C4606A', marginTop: 6 }}>{erreur}</div>}
    </div>
  )
}
