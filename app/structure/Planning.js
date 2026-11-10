'use client'
import { useState, useEffect } from 'react'

const JOUR = 24 * 3600 * 1000
const TYPES = { care: '🤝', medical: '🏥', kine: '🦵', pharmacy: '💊' }

// Lundi 0 h (heure locale) de la semaine d'une date
function lundiDe(date) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (d.getDay() + 6) % 7)
  return d
}
const plusJours = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }
const cleJour = d => new Date(d).toLocaleDateString('fr-CA') // AAAA-MM-JJ, heure locale

function statut(p) {
  if (new Date(p.scheduledAt) > new Date()) return { libelle: 'À venir', couleur: '#5B8DB8' }
  if (p.noteRecue === null) return { libelle: 'Sans intervenant', couleur: '#9BB5AA' }
  return p.noteRecue ? { libelle: '✓ Note reçue', couleur: '#4A8870' } : { libelle: 'Sans note', couleur: '#C4844A' }
}

// Planning global : les passages de tous les clients de la structure, semaine par semaine
export default function Planning({ clients, salaries, ouvrirDossier, onImporter }) {
  const [lundi, setLundi] = useState(() => lundiDe(new Date()))
  const [passages, setPassages] = useState(null)
  const [erreur, setErreur] = useState('')
  const [filtreClient, setFiltreClient] = useState('')
  const [filtreSalarie, setFiltreSalarie] = useState('')
  const [sansNoteSeulement, setSansNoteSeulement] = useState(false)

  useEffect(() => {
    let annule = false
    async function charger() {
      setPassages(null); setErreur('')
      try {
        const res = await fetch('/api/structure?debut=' + encodeURIComponent(lundi.toISOString()) + '&fin=' + encodeURIComponent(plusJours(lundi, 7).toISOString()))
        const r = await res.json()
        if (annule) return
        if (!res.ok) setErreur(r.error || 'Erreur de chargement')
        else setPassages(r.passages)
      } catch {
        if (!annule) setErreur('Erreur réseau, réessayez.')
      }
    }
    charger()
    return () => { annule = true }
  }, [lundi])

  const nomClient = id => clients.find(c => c.id === id)?.name || ''
  const visibles = (passages || []).filter(p => (!filtreClient || p.seniorId === filtreClient)
    && (!filtreSalarie || p.salarieIds.includes(filtreSalarie))
    && (!sansNoteSeulement || p.noteRecue === false))
  const sansNote = (passages || []).filter(p => p.noteRecue === false).length
  const jours = Array.from({ length: 7 }, (_, i) => plusJours(lundi, i))
    .map(d => ({ date: d, passages: visibles.filter(p => cleJour(p.scheduledAt) === cleJour(d)) }))
    .filter(j => j.passages.length)
  const cetteSemaine = lundi.getTime() === lundiDe(new Date()).getTime()
  const aujourdhui = cleJour(new Date())

  const select = { padding: '8px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', color: '#1F2A24', minWidth: 0 }
  const fleche = { background: '#fff', border: '1px solid #E8EFEB', borderRadius: 8, padding: '6px 12px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', color: '#4A8870' }
  const carte = { background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 20px' }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button onClick={() => setLundi(plusJours(lundi, -7))} style={fleche} aria-label="Semaine précédente">←</button>
        <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24', minWidth: 190, textAlign: 'center' }}>
          Semaine du {lundi.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })} au {plusJours(lundi, 6).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}
        </div>
        <button onClick={() => setLundi(plusJours(lundi, 7))} style={fleche} aria-label="Semaine suivante">→</button>
        {!cetteSemaine && <button onClick={() => setLundi(lundiDe(new Date()))} style={{ ...fleche, fontSize: 13 }}>Cette semaine</button>}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={filtreClient} onChange={e => setFiltreClient(e.target.value)} style={select} aria-label="Client">
          <option value="">Tous les clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filtreSalarie} onChange={e => setFiltreSalarie(e.target.value)} style={select} aria-label="Salarié">
          <option value="">Tous les salariés</option>
          {salaries.map(s => <option key={s.id} value={s.id}>{s.prenom} {s.nom}</option>)}
        </select>
        {sansNote > 0 && (
          <button onClick={() => setSansNoteSeulement(!sansNoteSeulement)} style={{
            fontSize: 13, padding: '7px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
            border: '1px solid ' + (sansNoteSeulement ? '#C4844A' : '#F0D9B5'), background: sansNoteSeulement ? '#FDF3E7' : '#fff', color: '#C4844A',
          }}>{sansNoteSeulement ? '✓ ' : ''}{sansNote} passage{sansNote > 1 ? 's' : ''} sans note</button>
        )}
      </div>

      {erreur && <div style={{ ...carte, color: '#C4606A', fontSize: 13 }}>{erreur}</div>}
      {!erreur && !passages && <div style={{ ...carte, textAlign: 'center', color: '#9BB5AA', fontSize: 14 }}>Chargement…</div>}
      {passages && (
        <div style={{ fontSize: 12, color: '#9BB5AA', marginBottom: 12 }}>
          {visibles.length} passage{visibles.length > 1 ? 's' : ''}
          {visibles.length !== passages.length && ' sur ' + passages.length}
          {' · « Sans note » : aucun intervenant du passage n\'a laissé de note sur ce client dans les 24 h'}
        </div>
      )}
      {passages && !jours.length && (
        <div style={{ ...carte, textAlign: 'center', padding: '36px 20px', color: '#9BB5AA', fontSize: 14 }}>
          {passages.length ? 'Aucun passage ne correspond à ces filtres.' : 'Aucun passage cette semaine.'}
          {!passages.length && (
            <div style={{ marginTop: 12 }}>
              <button onClick={onImporter} style={{ background: '#fff', color: '#4A8870', border: '1.5px solid #7FAF9B', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>Importer votre planning</button>
            </div>
          )}
        </div>
      )}

      {jours.map(j => (
        <div key={j.date.toISOString()} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8, color: cleJour(j.date) === aujourdhui ? '#4A8870' : '#9BB5AA' }}>
            {j.date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
            {cleJour(j.date) === aujourdhui && ' · aujourd\'hui'}
            <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: 'none' }}> · {j.passages.length} passage{j.passages.length > 1 ? 's' : ''}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {j.passages.map(p => {
              const s = statut(p)
              return (
                <div key={p.id} style={{ background: '#fff', border: '1px solid #E8EFEB', borderLeft: '3px solid ' + s.couleur, borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1F2A24', width: 46 }}>
                    {new Date(p.scheduledAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ flex: 1, minWidth: 160 }}>
                    <button onClick={() => ouvrirDossier(p.seniorId)} style={{ background: 'none', border: 'none', padding: 0, fontSize: 14, fontWeight: 500, color: '#1F2A24', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                      {nomClient(p.seniorId)}
                    </button>
                    <div style={{ fontSize: 12, color: '#6F7C75', marginTop: 2 }}>
                      {TYPES[p.type] || '📋'} {p.label}{p.intervenants.length ? ' · ' + p.intervenants.join(', ') : ''}
                    </div>
                  </div>
                  <div style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: s.couleur + '1A', color: s.couleur, fontWeight: 500, whiteSpace: 'nowrap' }}>{s.libelle}</div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
