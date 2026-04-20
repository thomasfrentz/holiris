import { supabase } from '../lib/supabase'

export default async function Home() {
  const { data: seniors } = await supabase.from('seniors').select('*')
  const senior = seniors?.[0]

  const { data: events } = await supabase
    .from('events')
    .select('*, intervenants(*)')
    .eq('senior_id', senior?.id)
    .order('scheduled_at', { ascending: true })

  const { data: notes } = await supabase
    .from('notes')
    .select('*')
    .eq('senior_id', senior?.id)
    .order('created_at', { ascending: false })
    .limit(3)

  const noteCount = events?.filter(e => e.status === 'note_received').length ?? 0
  const silenceCount = events?.filter(e => e.status === 'silence').length ?? 0
  const relanceCount = events?.filter(e => e.status === 'relance_envoyee').length ?? 0

  const statusConfig = {
    note_received: { color: '#2ecc71', label: '✅ Note reçue' },
    silence:       { color: '#e74c3c', label: '🔴 Silence détecté' },
    relance_envoyee: { color: '#f39c12', label: '📨 Relance envoyée' },
    a_venir:       { color: '#3498db', label: '🕐 À venir' },
  }

  const typeIcon = { care: '🤝', kine: '🦵', medical: '🏥', pharmacy: '💊' }

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>

      {/* SIDEBAR */}
      <aside style={{ width: 260, background: '#12201a', color: '#e8f0eb', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 42, height: 42, background: '#2ecc71', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#12201a', fontSize: 18 }}>H</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>Holiris</div>
            <div style={{ fontSize: 10, color: '#5a8a6a', letterSpacing: 1 }}>PYRÉNÉES-ORIENTALES</div>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>👵</div>
          <div style={{ fontWeight: 'bold' }}>{senior?.name}</div>
          <div style={{ fontSize: 12, color: '#7aaa8a', marginTop: 2 }}>{senior?.age} ans · {senior?.city}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#2ecc71', marginTop: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2ecc71', display: 'inline-block' }} />
            Situation stable
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { icon: '⚡', label: 'Flux en temps réel' },
            { icon: '📅', label: 'Agenda' },
            { icon: '📝', label: 'Carnet de suivi' },
            { icon: '🤖', label: 'Assistant IA' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 8, color: '#9abaa8', cursor: 'pointer', fontSize: 14 }}>
              <span>{item.icon}</span>{item.label}
            </div>
          ))}
        </nav>

        {silenceCount > 0 && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#ff8070' }}>⚠️ {silenceCount} silence{silenceCount > 1 ? 's' : ''} détecté{silenceCount > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 11, color: '#cc8070', marginTop: 2 }}>L'IA a relancé les intervenants</div>
          </div>
        )}
      </aside>

      {/* MAIN */}
      <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>⚡ Flux en temps réel</h1>
        <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>

        {/* STATS */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[
            { icon: '✅', label: 'Notes reçues', value: noteCount, color: '#2ecc71' },
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
        <h2 style={{ fontSize: 14, fontWeight: 'bold', color: '#12201a', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 }}>Dernières notes</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes?.map((n) => (
            <div key={n.id} style={{ background: '#fff', borderRadius: 10, padding: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#12201a' }}>
                  {n.source === 'whatsapp' ? '🎤 Note vocale' : '📝 Note manuelle'}
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
    </div>
  )
}