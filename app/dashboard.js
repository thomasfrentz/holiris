'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

const Tag = ({ children, color = '#7FAF9B', bg = '#EAF4EF' }) => (
  <span style={{ fontSize: 11, fontWeight: 500, color, background: bg, padding: '3px 10px', borderRadius: 20, letterSpacing: '0.04em' }}>
    {children}
  </span>
)

const Section = ({ title, children }) => (
  <div style={{ marginBottom: 36 }}>
    <div style={{ fontSize: 11, fontWeight: 600, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>{title}</div>
    {children}
  </div>
)

export default function Dashboard({ initialSenior, initialEvents, initialNotes, initialTotalNotes, initialAlertes, initialOrdonnances, supabaseUrl, supabaseKey }) {
  const [events] = useState(initialEvents || [])
  const [notes, setNotes] = useState(initialNotes || [])
  const [totalNotes, setTotalNotes] = useState(initialTotalNotes || 0)
  const [alertes, setAlertes] = useState(initialAlertes || [])
  const [ordonnances] = useState(initialOrdonnances || [])

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

  const statusColors = { note_received: '#7FAF9B', silence: '#D98992', relance_envoyee: '#E6B98A', a_venir: '#BC84C6' }
  const statusBgs = { note_received: '#EAF4EF', silence: '#FBECED', relance_envoyee: '#FDF3E7', a_venir: '#F3EDF7' }
  const statusLabels = { note_received: 'Reçu', silence: 'Silence', relance_envoyee: 'Relancé', a_venir: 'À venir' }

  const formatRelative = (date) => {
    const d = Math.floor((now - new Date(date)) / 86400000)
    if (d === 0) return "Aujourd'hui"
    if (d === 1) return 'Hier'
    return `Il y a ${d}j`
  }

  const noteSourceLabel = (s) => s === 'whatsapp_audio' ? 'Note vocale' : s === 'whatsapp_text' ? 'WhatsApp' : 'Note'
  const noteSourceColor = (s) => {
    if (s === 'whatsapp_audio') return { color: '#BC84C6', bg: '#F3EDF7' }
    if (s === 'whatsapp_text') return { color: '#7FAF9B', bg: '#EAF4EF' }
    return { color: '#6F7C75', bg: '#F4F5F5' }
  }

  return (
    <div style={{ maxWidth: 880, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <div style={{ fontSize: 12, color: '#9BB5AA', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8, fontWeight: 500 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(36px, 4vw, 52px)', fontWeight: 400, color: '#1F2A24', letterSpacing: '0.01em', lineHeight: 1.1, marginBottom: 12 }}>
          Flux en temps réel
        </h1>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#7FAF9B' }} />
            <span style={{ fontSize: 13, color: '#9BB5AA' }}>Mis à jour en direct</span>
          </div>
          {alertesNonLues.length > 0 && (
            <Tag color="#D98992" bg="#FBECED">{alertesNonLues.length} alerte{alertesNonLues.length > 1 ? 's' : ''}</Tag>
          )}
        </div>
      </div>

      {/* Alertes */}
      {alertesNonLues.length > 0 && (
        <div style={{ marginBottom: 32 }}>
          {alertesNonLues.map(a => {
            const danger = a.niveau === 'danger'
            const color = danger ? '#D98992' : '#E6B98A'
            const bg = danger ? '#FBECED' : '#FDF3E7'
            const border = danger ? '#F2C4C8' : '#F0D9B5'
            return (
              <div key={a.id} style={{ background: bg, border: '1px solid ' + border, borderRadius: 10, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
                <div style={{ width: 3, height: 38, borderRadius: 2, background: color, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 10, color, letterSpacing: '0.15em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 5 }}>
                    {danger ? 'Urgent' : 'Attention'}
                  </div>
                  <div style={{ fontSize: 14, color: '#1F2A24', fontWeight: 400, lineHeight: 1.5 }}>{a.message}</div>
                </div>
                <button onClick={() => marquerLu(a.id)} style={{ background: '#fff', border: '1px solid ' + border, color: '#6F7C75', padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', borderRadius: 6, fontFamily: 'inherit' }}>
                  Lu
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* KPIs 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 36 }}>
        {[
          {
            label: 'Prochain RDV',
            value: prochainEvent ? (new Date(prochainEvent.scheduled_at).toDateString() === now.toDateString() ? "Aujourd'hui" : new Date(prochainEvent.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long' })) : 'Aucun',
            detail: prochainEvent ? new Date(prochainEvent.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) + (prochainEvent.intervenants ? ' — ' + prochainEvent.intervenants.name.split(' ')[0] : '') : 'Aucun rendez-vous prévu',
            accent: '#4A8870', accentBg: '#EAF4EF',
          },
          {
            label: 'Dernier passage',
            value: dernierPassage ? formatRelative(dernierPassage.scheduled_at) : 'Aucun',
            detail: dernierPassage ? (typeLabel[dernierPassage.type] || dernierPassage.label) : 'Aucun passage enregistré',
            accent: '#8B6FAA', accentBg: '#F3EDF7',
          },
          {
            label: 'Renouvellement',
            value: prochaineOrdonnance ? (joursOrdonnance === 0 ? "Aujourd'hui" : `${joursOrdonnance} j`) : 'RAS',
            detail: prochaineOrdonnance ? prochaineOrdonnance.type_ordonnance : 'Aucune ordonnance',
            accent: joursOrdonnance !== null && joursOrdonnance <= 3 ? '#C4606A' : joursOrdonnance !== null && joursOrdonnance <= 7 ? '#C4844A' : '#4A8870',
            accentBg: joursOrdonnance !== null && joursOrdonnance <= 7 ? '#FDF3E7' : '#EAF4EF',
          },
          {
            label: 'Dernière note',
            value: derniereNote ? (() => { const d = Math.floor((now - new Date(derniereNote.created_at)) / 60000); return d < 60 ? `${d} min` : d < 1440 ? `${Math.floor(d/60)}h` : `${Math.floor(d/1440)}j` })() : '—',
            detail: derniereNote ? (derniereNote.intervenant_name || 'Famille') : 'Aucune note',
            accent: '#4A8870', accentBg: '#EAF4EF',
          },
        ].map(card => (
          <div key={card.label} className="hl-card" style={{ padding: '20px 22px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#9BB5AA', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>{card.label}</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, fontWeight: 500, color: card.accent, lineHeight: 1.1, marginBottom: 7 }}>{card.value}</div>
            <div style={{ fontSize: 12, color: '#9BB5AA', lineHeight: 1.4 }}>{card.detail}</div>
          </div>
        ))}
      </div>

      {/* Événements */}
      {events.length > 0 && (
        <Section title="Événements de la semaine">
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EFEB', overflow: 'hidden' }}>
            {events.map((e, i) => {
              const color = statusColors[e.status] || '#9BB5AA'
              const bg = statusBgs[e.status] || '#F4F5F5'
              const estPasse = new Date(e.scheduled_at) < now && e.status === 'a_venir'
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '15px 20px', borderBottom: i < events.length - 1 ? '1px solid #F0F4F1' : 'none', opacity: estPasse ? 0.45 : 1 }}>
                  <div style={{ fontSize: 13, color: '#9BB5AA', width: 44, flexShrink: 0, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                    {new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, color: '#1F2A24', fontWeight: 400 }}>{e.label}</div>
                    {e.intervenants && <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>{e.intervenants.name}</div>}
                  </div>
                  <Tag color={estPasse ? '#9BB5AA' : color} bg={estPasse ? '#F4F5F5' : bg}>
                    {estPasse ? 'Passé' : statusLabels[e.status]}
                  </Tag>
                </div>
              )
            })}
          </div>
        </Section>
      )}

      {/* Notes */}
      <Section title="Dernières notes">
        {notes.length === 0 && (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E8EFEB', padding: '36px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 15, color: '#9BB5AA' }}>Aucune note pour le moment.</div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {notes.map((n, i) => {
            const src = noteSourceColor(n.source)
            return (
              <div key={n.id || i} className="hl-card" style={{ padding: '20px 22px', background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color={src.color} bg={src.bg}>{noteSourceLabel(n.source)}</Tag>
                    {n.intervenant_name && <span style={{ fontSize: 13, color: '#6F7C75', fontStyle: 'italic' }}>{n.intervenant_name}</span>}
                  </div>
                  <span style={{ fontSize: 12, color: '#9BB5AA' }}>
                    {new Date(n.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <p style={{ fontSize: 15, color: '#3A4A40', lineHeight: 1.75, fontWeight: 400 }}>{n.content}</p>
              </div>
            )
          })}
        </div>
      </Section>

    </div>
  )
}
