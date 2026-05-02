'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const Card = ({ children, style = {} }) => (
  <div style={{
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(107,143,113,0.15)',
    borderRadius: 12,
    padding: 20,
    ...style
  }}>
    {children}
  </div>
)

const Label = ({ children }) => (
  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.2em', marginBottom: 12, fontWeight: 500 }}>
    {children}
  </div>
)

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
    if (diff < 60) return `${diff}min`
    if (diff < 1440) return `${Math.floor(diff / 60)}h`
    return `${Math.floor(diff / 1440)}j`
  })() : null

  const prochaineOrdonnance = ordonnances
    .filter(o => new Date(o.date_renouvellement) >= now)
    .sort((a, b) => new Date(a.date_renouvellement) - new Date(b.date_renouvellement))[0]

  const joursOrdonnance = prochaineOrdonnance
    ? Math.ceil((new Date(prochaineOrdonnance.date_renouvellement) - now) / 86400000)
    : null

  const typeLabel = { care: 'Aide à domicile', kine: 'Kiné', medical: 'Médical', pharmacy: 'Pharmacie' }

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    const supabase = createClient(supabaseUrl, supabaseKey)
    const notesChannel = supabase.channel('db-notes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' },
        (payload) => { setNotes(prev => [payload.new, ...prev].slice(0, 3)); setTotalNotes(prev => prev + 1) }
      ).subscribe()
    const alertesChannel = supabase.channel('db-alertes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertes' },
        (payload) => { setAlertes(prev => [payload.new, ...prev]) }
      ).subscribe()
    return () => { notesChannel.unsubscribe(); alertesChannel.unsubscribe() }
  }, [supabaseUrl, supabaseKey])

  async function marquerLu(id) {
    if (String(id).startsWith('ordonnance-')) { setAlertes(prev => prev.filter(a => a.id !== id)); return }
    const supabase = createClient(supabaseUrl, supabaseKey)
    await supabase.from('alertes').update({ lu: true }).eq('id', id)
    setAlertes(prev => prev.filter(a => a.id !== id))
  }

  const alertesNonLues = alertes.filter(a => !a.lu)

  const statusColors = {
    note_received: '#6B8F71',
    silence: '#C47A82',
    relance_envoyee: '#C4844A',
    a_venir: '#7A9FA8',
  }

  const statusLabels = {
    note_received: 'Note reçue',
    silence: 'Silence',
    relance_envoyee: 'Relancé',
    a_venir: 'À venir',
  }

  const sourceLabel = (source) => {
    if (source === 'whatsapp_audio') return 'Note vocale'
    if (source === 'whatsapp_text') return 'WhatsApp'
    return 'Note'
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 9, color: 'rgba(154,184,159,0.6)', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 8 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 300, color: '#FAFCFA', letterSpacing: '0.02em', lineHeight: 1 }}>
          Flux en temps réel
        </h1>
      </div>

      {/* Alertes */}
      {alertesNonLues.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          {alertesNonLues.map(a => {
            const isD = a.niveau === 'danger'
            const color = isD ? '#C47A82' : '#C4844A'
            return (
              <div key={a.id} style={{
                background: isD ? 'rgba(196,122,130,0.08)' : 'rgba(196,132,74,0.08)',
                border: '1px solid ' + (isD ? 'rgba(196,122,130,0.25)' : 'rgba(196,132,74,0.25)'),
                borderLeft: '3px solid ' + color,
                borderRadius: 8, padding: '12px 16px',
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}>{a.message}</div>
                <button onClick={() => marquerLu(a.id)} style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                  color: 'rgba(255,255,255,0.4)', borderRadius: 4, padding: '3px 10px',
                  fontSize: 10, cursor: 'pointer', letterSpacing: '0.08em', textTransform: 'uppercase'
                }}>Vu</button>
              </div>
            )
          })}
        </div>
      )}

      {/* Cards résumé — 2x2 sur mobile */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
        {[
          {
            label: 'Prochain RDV',
            value: prochainEvent
              ? (new Date(prochainEvent.scheduled_at).toDateString() === now.toDateString() ? "Aujourd'hui" : new Date(prochainEvent.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }))
              : '—',
            sub: prochainEvent
              ? new Date(prochainEvent.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + (prochainEvent.intervenants ? ' · ' + prochainEvent.intervenants.name.split(' ')[0] : '')
              : 'Aucun rendez-vous',
            accent: '#9AB89F',
            dot: !!prochainEvent,
          },
          {
            label: 'Dernier passage',
            value: dernierPassage
              ? (() => { const d = Math.floor((now - new Date(dernierPassage.scheduled_at)) / 86400000); return d === 0 ? "Aujourd'hui" : d === 1 ? 'Hier' : `Il y a ${d}j` })()
              : '—',
            sub: dernierPassage ? (typeLabel[dernierPassage.type] || dernierPassage.label) : 'Aucun passage',
            accent: '#A89FCC',
            dot: !!dernierPassage,
          },
          {
            label: 'Renouvellement',
            value: prochaineOrdonnance ? (joursOrdonnance === 0 ? "Aujourd'hui" : `${joursOrdonnance} jour${joursOrdonnance > 1 ? 's' : ''}`) : '—',
            sub: prochaineOrdonnance ? prochaineOrdonnance.type_ordonnance : 'Aucune ordonnance',
            accent: joursOrdonnance !== null && joursOrdonnance <= 3 ? '#C47A82' : joursOrdonnance !== null && joursOrdonnance <= 7 ? '#C4844A' : '#9AB89F',
            dot: !!prochaineOrdonnance,
          },
          {
            label: 'Dernière note',
            value: derniereNote ? `Il y a ${derniereNoteTemps}` : '—',
            sub: derniereNote ? (derniereNote.intervenant_name || 'Famille') : 'Aucune note',
            accent: '#9AB89F',
            dot: !!derniereNote,
          },
        ].map((card) => (
          <Card key={card.label}>
            <Label>{card.label}</Label>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 22, fontWeight: 400, color: card.accent, lineHeight: 1.2, marginBottom: 6 }}>
              {card.value}
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontWeight: 300, lineHeight: 1.4 }}>{card.sub}</div>
          </Card>
        ))}
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 24 }}>
        {[
          { label: 'Notes', value: totalNotes, color: '#6B8F71' },
          { label: 'Silences', value: silenceCount, color: '#C47A82' },
          { label: 'Relances', value: relanceCount, color: '#C4844A' },
        ].map((s) => (
          <Card key={s.label} style={{ padding: '16px', borderTop: '2px solid ' + s.color, textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 300, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6, letterSpacing: '0.15em', textTransform: 'uppercase' }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Events */}
      {events.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <Label>Événements de la semaine</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {events.map((e) => {
              const color = statusColors[e.status] || '#666'
              const estPasse = new Date(e.scheduled_at) < now && e.status === 'a_venir'
              return (
                <div key={e.id} style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: '1px solid rgba(107,143,113,0.1)',
                  borderLeft: '3px solid ' + (estPasse ? 'rgba(255,255,255,0.1)' : color),
                  borderRadius: 8, padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                  opacity: estPasse ? 0.5 : 1,
                }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: '#FAFCFA', fontWeight: 300 }}>{e.label}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                      {new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {e.intervenants && ' · ' + e.intervenants.name}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 9, padding: '3px 8px', borderRadius: 4,
                    background: (estPasse ? 'rgba(255,255,255,0.05)' : color + '20'),
                    color: estPasse ? 'rgba(255,255,255,0.25)' : color,
                    letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 500
                  }}>
                    {estPasse ? 'Passé' : statusLabels[e.status] || e.status}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Label>Dernières notes</Label>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B8F71', marginBottom: 12 }} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notes.length === 0 && (
            <Card>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.25)', textAlign: 'center', padding: '20px 0' }}>Aucune note pour le moment</div>
            </Card>
          )}
          {notes.map((n, index) => (
            <Card key={n.id || index} style={{ padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{ width: 5, height: 5, borderRadius: '50%', background: n.source === 'whatsapp_audio' ? '#A89FCC' : n.source === 'whatsapp_text' ? '#6B8F71' : '#7A9FA8' }} />
                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>{sourceLabel(n.source)}</span>
                </div>
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
                  {new Date(n.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {n.intervenant_name && (
                <div style={{ fontSize: 11, color: 'rgba(154,184,159,0.6)', marginBottom: 8, fontStyle: 'italic' }}>
                  {n.intervenant_name}
                </div>
              )}
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.7, fontWeight: 300 }}>{n.content}</p>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}