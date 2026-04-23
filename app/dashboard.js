'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function Dashboard({ initialSenior, initialEvents, initialNotes, initialTotalNotes, initialAlertes, supabaseUrl, supabaseKey }) {
  const [events] = useState(initialEvents || [])
  const [notes, setNotes] = useState(initialNotes || [])
  const [totalNotes, setTotalNotes] = useState(initialTotalNotes || 0)
  const [alertes, setAlertes] = useState(initialAlertes || [])

  const silenceCount = events.filter(e => e.status === 'silence').length
  const relanceCount = events.filter(e => e.status === 'relance_envoyee').length

  const statusConfig = {
    note_received: { color: '#2ecc71', label: '✅ Note reçue' },
    silence: { color: '#e74c3c', label: '🔴 Silence détecté' },
    relance_envoyee: { color: '#f39c12', label: '📨 Relance envoyée' },
    a_venir: { color: '#3498db', label: '🕐 À venir' },
  }

  const typeIcon = { care: '🤝', kine: '🦵', medical: '🏥', pharmacy: '💊' }

  const niveauConfig = {
    info: { color: '#3498db', bg: '#eaf4ff', icon: 'ℹ️' },
    warning: { color: '#f39c12', bg: '#fef9ec', icon: '⚠️' },
    danger: { color: '#e74c3c', bg: '#fdf0f0', icon: '🚨' },
  }

  useEffect(() => {
    if (!supabaseUrl || !supabaseKey) return

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Temps réel notes
    const notesChannel = supabase
      .channel('db-notes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes' },
        (payload) => {
          setNotes(prev => [payload.new, ...prev].slice(0, 3))
          setTotalNotes(prev => prev + 1)
        }
      )
      .subscribe()

    // Temps réel alertes
    const alertesChannel = supabase
      .channel('db-alertes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alertes' },
        (payload) => {
          console.log('Nouvelle alerte !', payload.new)
          setAlertes(prev => [payload.new, ...prev])
        }
      )
      .subscribe()

    return () => {
      notesChannel.unsubscribe()
      alertesChannel.unsubscribe()
    }
  }, [supabaseUrl, supabaseKey])

  async function marquerLu(id) {
    const supabase = createClient(supabaseUrl, supabaseKey)
    await supabase.from('alertes').update({ lu: true }).eq('id', id)
    setAlertes(prev => prev.filter(a => a.id !== id))
  }

  const alertesNonLues = alertes.filter(a => !a.lu)

  return (
    <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>
        ⚡ Flux en temps réel
      </h1>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>
        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* ALERTES IA */}
      {alertesNonLues.length > 0 && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#12201a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
            🤖 Alertes IA
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alertesNonLues.map(a => {
              const cfg = niveauConfig[a.niveau] || niveauConfig.warning
              return (
                <div key={a.id} style={{
                  background: cfg.bg,
                  border: '1px solid ' + cfg.color + '44',
                  borderLeft: '4px solid ' + cfg.color,
                  borderRadius: 10,
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12
                }}>
                  <span style={{ fontSize: 20 }}>{cfg.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: '#333', fontWeight: '500' }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>
                      {new Date(a.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <button
                    onClick={() => marquerLu(a.id)}
                    style={{ background: 'none', border: '1px solid ' + cfg.color, color: cfg.color, borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    Vu ✓
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { icon: '✅', label: 'Notes reçues', value: totalNotes, color: '#2ecc71' },
          { icon: '🔴', label: 'Silences détectés', value: silenceCount, color: '#e74c3c' },
          { icon: '📨', label: 'Relances envoyées', value: relanceCount, color: '#f39c12' },
        ].map((s) => (
          <div key={s.label} style={{
            background: '#fff',
            borderRadius: 12,
            padding: 20,
            borderTop: '3px solid ' + s.color,
            boxShadow: '0 1px 6px rgba(0,0,0,0.05)'
          }}>
            <div style={{ fontSize: 28 }}>{s.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: s.color, margin: '8px 0 4px' }}>
              {s.value}
            </div>
            <div style={{ fontSize: 12, color: '#888' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* EVENTS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {events?.map((e) => {
          const cfg = statusConfig[e.status] ?? { color: '#999', label: e.status }
          return (
            <div key={e.id} style={{
              background: '#fff',
              borderRadius: 10,
              padding: '14px 16px',
              borderLeft: '4px solid ' + cfg.color,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              display: 'flex',
              alignItems: 'center',
              gap: 14
            }}>
              <div style={{ fontSize: 24 }}>{typeIcon[e.type] ?? '📋'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 14, color: '#12201a' }}>{e.label}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {e.intervenants && ' · ' + e.intervenants.name}
                </div>
              </div>
              <div style={{
                fontSize: 12,
                padding: '3px 10px',
                borderRadius: 20,
                background: cfg.color + '22',
                color: cfg.color,
                fontWeight: 'bold'
              }}>
                {cfg.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* NOTES */}
      <h2 style={{
        fontSize: 14,
        fontWeight: 'bold',
        color: '#12201a',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12
      }}>
        Dernières notes <span style={{ color: '#2ecc71', fontSize: 11 }}>● temps réel</span>
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes?.map((n, index) => (
          <div key={n.id || index} style={{
            background: '#fff',
            borderRadius: 10,
            padding: 16,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 'bold', color: '#12201a' }}>
                {n.source === 'whatsapp_audio' ? '🎤 Note vocale' :
                 n.source === 'whatsapp_text' ? '💬 WhatsApp' : '📝 Note'}
              </span>
              <span style={{ fontSize: 11, color: '#aaa' }}>
                {new Date(n.created_at).toLocaleString('fr-FR', {
                  day: '2-digit', month: '2-digit',
                  hour: '2-digit', minute: '2-digit'
                })}
              </span>
            </div>
            {n.intervenant_name && (
              <div style={{ fontSize: 12, color: '#5a8a6a', marginBottom: 6, fontStyle: 'italic' }}>
                👤 {n.intervenant_name}
              </div>
            )}
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, margin: 0 }}>
              {n.content}
            </p>
          </div>
        ))}
      </div>
    </main>
  )
}
