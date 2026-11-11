'use client'
import { useState, useEffect } from 'react'
import { joursEnClair, heureEnClair } from '@/lib/horairesEnClair'

const STATUTS = {
  proposee: ['En attente de réponse', '#C4844A', '#FDF3E7'],
  acceptee: ['Acceptée', '#4A8870', '#EAF4EF'],
  refusee: ['Refusée', '#9BB5AA', '#F4F5F5'],
}
const quand = d => new Date(d).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + ' à ' + new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

// Onglet de l'administration : messages automatiques de Holiris et réponses des intervenants
export default function MessagesHoliris() {
  const [messages, setMessages] = useState(null)
  const [erreur, setErreur] = useState('')
  const [filtre, setFiltre] = useState('')

  useEffect(() => {
    fetch('/api/admin/messages-holiris')
      .then(async r => { const d = await r.json(); if (r.ok) setMessages(d.messages); else setErreur(d.error || 'Erreur de chargement') })
      .catch(() => setErreur('Erreur réseau'))
  }, [])

  const compte = statut => (messages || []).filter(m => m.proposition?.statut === statut).length
  const visibles = (messages || []).filter(m => !filtre || m.proposition?.statut === filtre)
  const carte = { background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 22px' }

  return (
    <>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Suivi</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>Messages Holiris</h1>
        <p style={{ color: '#9BB5AA', fontSize: 13, marginTop: 6 }}>Messages automatiques envoyés aux intervenants dans leur messagerie, et leurs réponses</p>
      </div>

      {erreur && <div style={{ ...carte, color: '#C4606A', fontSize: 13 }}>{erreur}</div>}
      {!erreur && !messages && <div style={{ ...carte, color: '#9BB5AA', fontSize: 14, textAlign: 'center' }}>Chargement…</div>}

      {messages && (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            {[['', 'Tous', messages.length], ['proposee', 'En attente', compte('proposee')], ['acceptee', 'Acceptées', compte('acceptee')], ['refusee', 'Refusées', compte('refusee')]].map(([cle, libelle, n]) => (
              <button key={cle} onClick={() => setFiltre(cle)} style={{
                fontSize: 13, padding: '6px 14px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit',
                border: '1px solid ' + (filtre === cle ? '#7FAF9B' : '#E8EFEB'), background: filtre === cle ? '#EAF4EF' : '#fff', color: filtre === cle ? '#4A8870' : '#6F7C75',
              }}>{libelle} ({n})</button>
            ))}
          </div>

          {!visibles.length ? (
            <div style={{ ...carte, padding: '40px 20px', textAlign: 'center', fontSize: 14, color: '#9BB5AA' }}>
              {messages.length ? 'Aucun message dans cette catégorie.' : 'Holiris n\'a encore envoyé aucun message. La détection des passages réguliers tourne chaque matin.'}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {visibles.map(m => {
                const p = m.proposition
                const [libelle, couleur, fond] = p ? STATUTS[p.statut] || [p.statut, '#9BB5AA', '#F4F5F5'] : []
                return (
                  <div key={m.id} style={carte}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24' }}>{m.destinataire} <span style={{ fontWeight: 400, color: '#9BB5AA' }}>· chez {m.senior}</span></div>
                        <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>
                          Envoyé le {quand(m.createdAt)} · {m.luAt ? <span style={{ color: '#4A8870' }}>lu le {quand(m.luAt)}</span> : 'pas encore lu'}
                        </div>
                      </div>
                      {p && <div style={{ background: fond, color: couleur, borderRadius: 999, padding: '3px 10px', fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{libelle}</div>}
                    </div>
                    <div style={{ fontSize: 13, color: '#6F7C75', marginTop: 10, lineHeight: 1.55, whiteSpace: 'pre-wrap', background: '#FAFCFC', borderRadius: 8, padding: '10px 12px' }}>{m.contenu}</div>
                    {p?.statut === 'acceptee' && (
                      <div style={{ fontSize: 12, color: '#4A8870', marginTop: 8 }}>
                        ✓ {p.passagesCrees ?? 0} passages créés, {joursEnClair(p.jours.split(','))} à {heureEnClair(p.heure)} — le {quand(p.reponduAt)}
                      </div>
                    )}
                    {p?.statut === 'refusee' && <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 8 }}>Refusée le {quand(p.reponduAt)}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </>
  )
}
