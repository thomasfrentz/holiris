'use client'
import { useState, useEffect } from 'react'

export default function Dashboard({ initialSenior, initialEvents, initialNotes, supabaseUrl, supabaseKey }) {
  const [events] = useState(initialEvents || [])
  const [notes, setNotes] = useState(initialNotes || [])

  console.log('Dashboard monté, URL:', supabaseUrl)

  const silenceCount = events.filter(e => e.status === 'silence').length
  const relanceCount = events.filter(e => e.status === 'relance_envoyee').length

  const statusConfig = {
    note_received: { color: '#2ecc71', label: '✅ Note reçue' },
    silence: { color: '#e74c3c', label: '🔴 Silence détecté' },
    relance_envoyee: { color: '#f39c12', label: '📨 Relance envoyée' },
    a_venir: { color: '#3498db', label: '🕐 À venir' },
  }

  const typeIcon = { care: '🤝', kine: '🦵', medical: '🏥', pharmacy: '💊' }

  useEffect(() => {
    console.log('Initialisation Realtime avec URL:', supabaseUrl)

    if (!supabaseUrl || !supabaseKey) {
      console.error('Variables Supabase manquantes !')
      return
    }

    // Import dynamique pour éviter les problèmes SSR
    import('@supabase/supabase-js').then(({ createClient }) => {
      const supabase = createClient(supabaseUrl, supabaseKey)

      const channel = supabase
        .channel('notes-realtime')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notes' },
          (payload) => {
            console.log('🎉 Nouvelle note reçue !', payload.new)
            setNotes(prev => [payload.new, ...prev].slice(0, 3))
          }
        )
        .subscribe((status) => {
          console.log('Statut Realtime:', status)
        })

      return () => {
        supabase.removeChannel(channel)
      }
    })
  }, [supabaseUrl, supabaseKey])

  return (
    <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>⚡ Flux en temps réel</h1>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>
        {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>

      {/* STATS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[
          { icon: '✅', label: 'Notes reçues', value: notes.length, color: '#2ecc71' },
          { icon: '🔴', label: 'Silences détectés', value: silenceCount, color: '#e74c3c' },
          { icon: '📨', label: 'Relances envoyées', value: relanceCount, color: '#f39c12' },
        ].map((s) => (
          <div key={s.label} style={{ background: '#fff', borderRadius: 12, padding: 20, borderTop: `3px solid ${s.color}`, boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
            <div style={{ fontSize: 28 }}>{s.icon}</div>
            <div style={{ fontSize: 32, fontWeight: 900, color: s.color, margin: '8px 0 4px' }}>{s.value}</div>
            <div style={{ fontSize: 12, color: '#888' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* EVENTS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {events?.map((e) => {
          const cfg = statusConfig[e.status] ?? { color: '#999', label: e.status }
          return (
            <div key={e.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', borderLeft: `4px solid ${cfg.color}`, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 24 }}>{typeIcon[e.type] ?? '📋'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 14, color: '#12201a' }}>{e.label}</div>
                <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                  {new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                  {e.intervenants && ` · ${e.intervenants.name}`}
                </div>
              </div>
              <div style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: cfg.color + '22', color: cfg.color, fontWeight: 'bold' }}>
                {cfg.label}
              </div>
            </div>
          )
        })}
      </div>

      {/* NOTES */}
      <h2 style={{ fontSize: 14, fontWeight: 'bold', color: '#12201a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>
        Dernières notes <span style={{ color: '#2ecc71', fontSize: 11 }}>● temps réel</span>
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes?.map((n, index) => (
          <div key={n.id || index} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 'bold', color: '#12201a' }}>
                {n.source === 'whatsapp_audio' ? '🎤 Note vocale' : n.source === 'whatsapp_text' ? '💬 WhatsApp' : '📝 Note manuelle'}
              </span>
              <span style={{ fontSize: 11, color: '#aaa' }}>
                {new Date(n.created_at).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
            <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, margin: 0 }}>{n.content}</p>
          </div>
        ))}
      </div>
    </main>
  )
}