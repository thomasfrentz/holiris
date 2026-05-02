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

  const prochainEvent = events.filter(e => new Date(e.scheduled_at) >= now).sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0]
  const dernierPassage = events.filter(e => e.status === 'note_received' && new Date(e.scheduled_at) < now).sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))[0]
  const derniereNote = notes[0]
  const prochaineOrdonnance = ordonnances.filter(o => new Date(o.date_renouvellement) >= now).sort((a, b) => new Date(a.date_renouvellement) - new Date(b.date_renouvellement))[0]
  const joursOrdonnance = prochaineOrdonnance ? Math.ceil((new Date(prochaineOrdonnance.date_renouvellement) - now) / 86400000) : null

  const typeLabel = { care: 'Aide à domicile', kine: 'Kiné', medical: 'Médical', pharmacy: 'Pharmacie' }

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return
    const supabase = createClient(supabaseUrl, supabaseKey)
    const ch1 = supabase.channel('db-notes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' }, (p) => { setNotes(prev => [p.new, ...prev].slice(0, 3)); setTotalNotes(prev => prev + 1) }).subscribe()
    const ch2 = supabase.channel('db-alertes').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertes' }, (p) => { setAlertes(prev => [p.new, ...prev]) }).subscribe()
    return () => { ch1.unsubscribe(); ch2.unsubscribe() }
  }, [supabaseUrl, supabaseKey])

  async function marquerLu(id) {
    if (String(id).startsWith('ordonnance-')) { setAlertes(prev => prev.filter(a => a.id !== id)); return }
    const supabase = createClient(supabaseUrl, supabaseKey)
    await supabase.from('alertes').update({ lu: true }).eq('id', id)
    setAlertes(prev => prev.filter(a => a.id !== id))
  }

  const alertesNonLues = alertes.filter(a => !a.lu)

  const statusColors = { note_received: '#9AB89F', silence: '#C47A82', relance_envoyee: '#C4844A', a_venir: 'rgba(255,255,255,0.2)' }
  const statusLabels = { note_received: 'Reçu', silence: 'Silence', relance_envoyee: 'Relancé', a_venir: 'À venir' }

  const D = ({ children }) => (
    <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'rgba(154,184,159,0.5)', fontWeight: 500, marginBottom: 16 }}>{children}</div>
  )

  const formatRelative = (date) => {
    const d = Math.floor((now - new Date(date)) / 86400000)
    if (d === 0) return "Aujourd'hui"
    if (d === 1) return 'Hier'
    return `Il y a ${d} jours`
  }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>

      {/* ── En-tête ── */}
      <div style={{ marginBottom: 48, paddingBottom: 32, borderBottom: '1px solid rgba(154,184,159,0.1)' }}>
        <div style={{ fontSize: 10, color: 'rgba(154,184,159,0.5)', letterSpacing: '0.3em', textTransform: 'uppercase', marginBottom: 12 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 300, color: '#FAFCFA', letterSpacing: '0.02em', lineHeight: 1, marginBottom: 12 }}>
          Flux en temps réel
        </h1>
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#6B8F71', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em' }}>Temps réel</span>
          </div>
          {alertesNonLues.length > 0 && (
            <div style={{ fontSize: 11, color: '#C47A82', letterSpacing: '0.08em' }}>
              {alertesNonLues.length} alerte{alertesNonLues.length > 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* ── Alertes ── */}
      {alertesNonLues.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          {alertesNonLues.map(a => {
            const danger = a.niveau === 'danger'
            const color = danger ? '#C47A82' : '#C4844A'
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 16,
                padding: '16px 0', borderBottom: '1px solid rgba(154,184,159,0.08)',
              }}>
                <div style={{ width: 1, alignSelf: 'stretch', background: color, flexShrink: 0, marginTop: 4 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 9, color: color, letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>
                    {danger ? 'Urgent' : 'Attention'}
                  </div>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', fontWeight: 300, lineHeight: 1.6 }}>{a.message}</div>
                </div>
                <button onClick={() => marquerLu(a.id)} style={{
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'rgba(255,255,255,0.3)', padding: '4px 12px', fontSize: 9,
                  letterSpacing: '0.15em', textTransform: 'uppercase', cursor: 'pointer',
                  borderRadius: 1, fontFamily: 'inherit',
                }}>Lu</button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── 4 KPIs ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'rgba(154,184,159,0.1)', marginBottom: 40, border: '1px solid rgba(154,184,159,0.1)' }}>
        {[
          {
            label: 'Prochain RDV',
            value: prochainEvent ? (new Date(prochainEvent.scheduled_at).toDateString() === now.toDateString() ? "Aujourd'hui" : new Date(prochainEvent.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long' })) : 'Aucun',
            detail: prochainEvent ? new Date(prochainEvent.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + (prochainEvent.intervenants ? ' — ' + prochainEvent.intervenants.name.split(' ')[0] : '') : 'Aucun rendez-vous prévu',
            accent: '#9AB89F',
          },
          {
            label: 'Dernier passage',
            value: dernierPassage ? formatRelative(dernierPassage.scheduled_at) : 'Aucun',
            detail: dernierPassage ? (typeLabel[dernierPassage.type] || dernierPassage.label) : 'Aucun passage enregistré',
            accent: '#A89FCC',
          },
          {
            label: 'Renouvellement',
            value: prochaineOrdonnance ? (joursOrdonnance === 0 ? "Aujourd'hui" : `${joursOrdonnance} j`) : 'RAS',
            detail: prochaineOrdonnance ? prochaineOrdonnance.type_ordonnance : 'Aucune ordonnance',
            accent: joursOrdonnance !== null && joursOrdonnance <= 3 ? '#C47A82' : joursOrdonnance !== null && joursOrdonnance <= 7 ? '#C4844A' : '#9AB89F',
          },
          {
            label: 'Dernière note',
            value: derniereNote ? (() => { const d = Math.floor((now - new Date(derniereNote.created_at)) / 60000); return d < 60 ? `${d}min` : d < 1440 ? `${Math.floor(d/60)}h` : `${Math.floor(d/1440)}j` })() : '—',
            detail: derniereNote ? (derniereNote.intervenant_name || 'Famille') : 'Aucune note',
            accent: '#9AB89F',
          },
        ].map(card => (
          <div key={card.label} style={{ background: '#0F1610', padding: '24px 20px' }}>
            <div style={{ fontSize: 9, color: 'rgba(154,184,159,0.4)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>{card.label}</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 300, color: card.accent, lineHeight: 1, marginBottom: 8 }}>{card.value}</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', fontWeight: 300, lineHeight: 1.4 }}>{card.detail}</div>
          </div>
        ))}
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: '1px solid rgba(154,184,159,0.1)', marginBottom: 48 }}>
        {[
          { label: 'Notes reçues', value: totalNotes, color: '#9AB89F' },
          { label: 'Silences', value: silenceCount, color: '#C47A82' },
          { label: 'Relances', value: relanceCount, color: '#C4844A' },
        ].map((s, i) => (
          <div key={s.label} style={{
            padding: '28px 20px',
            borderRight: i < 2 ? '1px solid rgba(154,184,159,0.1)' : 'none',
          }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 300, color: s.color, lineHeight: 1, marginBottom: 8 }}>{s.value}</div>
            <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── Événements ── */}
      {events.length > 0 && (
        <div style={{ marginBottom: 48 }}>
          <D>Événements</D>
          {events.map((e, i) => {
            const color = statusColors[e.status] || 'rgba(255,255,255,0.2)'
            const estPasse = new Date(e.scheduled_at) < now && e.status === 'a_venir'
            return (
              <div key={e.id} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '14px 0',
                borderBottom: '1px solid rgba(154,184,159,0.07)',
                opacity: estPasse ? 0.4 : 1,
              }}>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', width: 40, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                  {new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 300 }}>{e.label}</div>
                  {e.intervenants && <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{e.intervenants.name}</div>}
                </div>
                <div style={{ fontSize: 9, color: color, letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                  {estPasse ? 'Passé' : statusLabels[e.status]}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Notes ── */}
      <div>
        <D>Dernières notes</D>
        {notes.length === 0 && (
          <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.2)', fontWeight: 300, padding: '24px 0' }}>Aucune note pour le moment.</div>
        )}
        {notes.map((n, i) => (
          <div key={n.id || i} style={{
            padding: '24px 0',
            borderBottom: '1px solid rgba(154,184,159,0.07)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 9, color: 'rgba(154,184,159,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {n.source === 'whatsapp_audio' ? 'Note vocale' : n.source === 'whatsapp_text' ? 'WhatsApp' : 'Note'}
                </div>
                {n.intervenant_name && (
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' }}>{n.intervenant_name}</div>
                )}
              </div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.05em' }}>
                {new Date(n.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
            <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', lineHeight: 1.75, fontWeight: 300 }}>{n.content}</p>
          </div>
        ))}
      </div>

    </div>
  )
}