'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function Dashboard({ initialSenior, initialEvents, initialNotes, initialTotalNotes, initialAlertes, initialOrdonnances, supabaseUrl, supabaseKey }) {
  const [events] = useState(initialEvents || [])
  const [notes, setNotes] = useState(initialNotes || [])
  const [totalNotes, setTotalNotes] = useState(initialTotalNotes || 0)
  const [alertes, setAlertes] = useState(initialAlertes || [])
  const [ordonnances] = useState(initialOrdonnances || [])

  const silenceCount = events.filter(e => e.status === 'silence').length
  const relanceCount = events.filter(e => e.status === 'relance_envoyee').length

  const now = new Date()

  const prochainEvent = events
    .filter(e => new Date(e.scheduled_at) >= now)
    .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0]

  const dernierPassage = events
    .filter(e => e.status === 'note_received' && new Date(e.scheduled_at) < now)
    .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))[0]

  const derniereNote = notes[0]
  const derniereNoteTemps = derniereNote ? (() => {
    const diff = Math.floor((now - new Date(derniereNote.created_at)) / 60000)
    if (diff < 60) return `Il y a ${diff}min`
    if (diff < 1440) return `Il y a ${Math.floor(diff / 60)}h`
    return `Il y a ${Math.floor(diff / 1440)}j`
  })() : null

  const prochaineOrdonnance = ordonnances
    .filter(o => new Date(o.date_renouvellement) >= now)
    .sort((a, b) => new Date(a.date_renouvellement) - new Date(b.date_renouvellement))[0]

  const joursOrdonnance = prochaineOrdonnance
    ? Math.ceil((new Date(prochaineOrdonnance.date_renouvellement) - now) / (1000 * 60 * 60 * 24))
    : null

  const statusConfig = {
    note_received: { color: '#6B8F71', label: '✅ Note reçue' },
    silence: { color: '#C47A82', label: '🔴 Silence détecté' },
    relance_envoyee: { color: '#C4844A', label: '📨 Relance envoyée' },
    a_venir: { color: '#7A9FA8', label: '🕐 À venir' },
  }

  const typeIcon = { care: '🤝', kine: '🦵', medical: '🏥', pharmacy: '💊' }
  const typeLabel = { care: 'Aide à domicile', kine: 'Kinésithérapie', medical: 'Médical', pharmacy: 'Pharmacie' }

  const niveauConfig = {
    info: { color: '#7A9FA8', bg: 'rgba(122,159,168,0.1)', border: 'rgba(122,159,168,0.3)', icon: 'ℹ️' },
    warning: { color: '#C4844A', bg: 'rgba(196,132,74,0.1)', border: 'rgba(196,132,74,0.3)', icon: '⚠️' },
    danger: { color: '#C47A82', bg: 'rgba(196,122,130,0.1)', border: 'rgba(196,122,130,0.3)', icon: '🚨' },
    ordonnance: { color: '#C4844A', bg: 'rgba(196,132,74,0.1)', border: 'rgba(196,132,74,0.3)', icon: '💊' },
  }

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    const supabase = createClient(supabaseUrl, supabaseKey)

    const notesChannel = supabase
      .channel('db-notes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' },
        (payload) => {
          setNotes(prev => [payload.new, ...prev].slice(0, 3))
          setTotalNotes(prev => prev + 1)
        }
      ).subscribe()

    const alertesChannel = supabase
      .channel('db-alertes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertes' },
        (payload) => { setAlertes(prev => [payload.new, ...prev]) }
      ).subscribe()

    return () => { notesChannel.unsubscribe(); alertesChannel.unsubscribe() }
  }, [supabaseUrl, supabaseKey])

  async function marquerLu(id) {
    if (String(id).startsWith('ordonnance-')) {
      setAlertes(prev => prev.filter(a => a.id !== id))
      return
    }
    const supabase = createClient(supabaseUrl, supabaseKey)
    await supabase.from('alertes').update({ lu: true }).eq('id', id)
    setAlertes(prev => prev.filter(a => a.id !== id))
  }

  const alertesNonLues = alertes.filter(a => !a.lu)

  const cardStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(107,143,113,0.2)',
    borderRadius: 2,
    padding: 20,
  }

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 32, fontWeight: 300, color: '#FAFCFA', marginBottom: 4, letterSpacing: '0.04em' }}>
          Flux en temps réel
        </h1>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, letterSpacing: '0.05em' }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      {/* CARDS RÉSUMÉ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 24 }}>
        {[
          {
            label: 'Prochain RDV', icon: '📅',
            title: prochainEvent
              ? (new Date(prochainEvent.scheduled_at).toDateString() === now.toDateString() ? "Aujourd'hui" : new Date(prochainEvent.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long' }))
              : 'Aucun RDV',
            sub: prochainEvent
              ? new Date(prochainEvent.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + (prochainEvent.intervenants ? ' · ' + prochainEvent.intervenants.name : '')
              : null,
            color: '#9AB89F'
          },
          {
            label: 'Dernier passage', icon: '🤝',
            title: dernierPassage
              ? (() => { const d = Math.floor((now - new Date(dernierPassage.scheduled_at)) / 86400000); return d === 0 ? "Aujourd'hui" : d === 1 ? 'Hier' : `Il y a ${d}j` })()
              : 'Aucun passage',
            sub: dernierPassage ? (typeLabel[dernierPassage.type] || dernierPassage.label) : null,
            color: '#A89FCC'
          },
          {
            label: 'Médicaments', icon: '💊',
            title: prochaineOrdonnance ? (joursOrdonnance === 0 ? "Aujourd'hui" : `${joursOrdonnance}j`) : 'Aucune ordonnance',
            sub: prochaineOrdonnance ? prochaineOrdonnance.type_ordonnance : null,
            color: joursOrdonnance <= 3 ? '#C47A82' : joursOrdonnance <= 7 ? '#C4844A' : '#9AB89F'
          },
          {
            label: 'Dernière note', icon: '📝',
            title: derniereNote ? derniereNoteTemps : 'Aucune note',
            sub: derniereNote ? (derniereNote.intervenant_name || 'Famille') : null,
            color: '#9AB89F'
          },
        ].map((card) => (
          <div key={card.label} style={cardStyle}>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.35)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 12 }}>{card.label}</div>
            <div style={{ fontSize: 22, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 18, fontWeight: 400, color: card.color, marginBottom: 4 }}>{card.title}</div>
            {card.sub && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>{card.sub}</div>}
          </div>
        ))}
      </div>

      {/* ALERTES */}
      {alertesNonLues.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 500, color: '#C47A82', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 10 }}>
            Alertes en cours
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {alertesNonLues.map(a => {
              const cfg = niveauConfig[a.niveau] || niveauConfig.warning
              return (
                <div key={a.id} style={{
                  background: cfg.bg, border: '1px solid ' + cfg.border,
                  borderLeft: '3px solid ' + cfg.color,
                  borderRadius: 2, padding: '12px 16px',
                  display: 'flex', alignItems: 'center', gap: 12
                }}>
                  <span style={{ fontSize: 18 }}>{cfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#FAFCFA', fontWeight: 400 }}>{a.message}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                      {new Date(a.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button onClick={() => marquerLu(a.id)}
                    style={{ background: 'transparent', border: '1px solid ' + cfg.color, color: cfg.color, borderRadius: 2, padding: '4px 12px', fontSize: 11, cursor: 'pointer', letterSpacing: '0.05em' }}>
                    Vu ✓
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
        {[
          { icon: '✅', label: 'Notes reçues', value: totalNotes, color: '#6B8F71' },
          { icon: '🔴', label: 'Silences détectés', value: silenceCount, color: '#C47A82' },
          { icon: '📨', label: 'Relances envoyées', value: relanceCount, color: '#C4844A' },
        ].map((s) => (
          <div key={s.label} style={{ ...cardStyle, borderTop: '2px solid ' + s.color }}>
            <div style={{ fontSize: 22 }}>{s.icon}</div>
            <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 40, fontWeight: 300, color: s.color, margin: '8px 0 4px' }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* EVENTS */}
      {events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 24 }}>
          {events.map((e) => {
            const cfg = statusConfig[e.status] ?? { color: '#666', label: e.status }
            return (
              <div key={e.id} style={{
                ...cardStyle,
                borderLeft: '3px solid ' + cfg.color,
                display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px'
              }}>
                <div style={{ fontSize: 22 }}>{typeIcon[e.type] ?? '📋'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: '#FAFCFA', fontWeight: 400 }}>{e.label}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 2 }}>
                    {new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    {e.intervenants && ' · ' + e.intervenants.name}
                  </div>
                </div>
                <div style={{ fontSize: 11, padding: '3px 10px', borderRadius: 2, background: cfg.color + '22', color: cfg.color, fontWeight: 500, letterSpacing: '0.05em' }}>
                  {cfg.label}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* NOTES */}
      <div style={{ fontSize: 10, fontWeight: 500, color: '#9AB89F', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 12 }}>
        Dernières notes <span style={{ color: '#6B8F71' }}>● temps réel</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {notes.map((n, index) => (
          <div key={n.id || index} style={{ ...cardStyle, padding: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 500, color: '#9AB89F', letterSpacing: '0.05em' }}>
                {n.source === 'whatsapp_audio' ? '🎤 Note vocale' : n.source === 'whatsapp_text' ? '💬 WhatsApp' : '📝 Note'}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {new Date(n.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            {n.intervenant_name && (
              <div style={{ fontSize: 11, color: 'rgba(154,184,159,0.7)', marginBottom: 8, fontStyle: 'italic' }}>
                👤 {n.intervenant_name}
              </div>
            )}
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', lineHeight: 1.7, margin: 0, fontWeight: 300 }}>{n.content}</p>
          </div>
        ))}
      </div>
    </div>
  )
}