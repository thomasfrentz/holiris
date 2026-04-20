import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { redirect } from 'next/navigation'
import Dashboard from './dashboard'

export default async function Home() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

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

  const { count: totalNotes } = await supabase
    .from('notes')
    .select('*', { count: 'exact', head: true })
    .eq('senior_id', senior?.id)

  const silenceCount = events?.filter(e => e.status === 'silence').length ?? 0

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
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

        <div style={{ marginTop: 'auto', fontSize: 12, color: '#4a7a5a' }}>
          {user.email}
        </div>
      </aside>

      <Dashboard
        initialSenior={senior}
        initialEvents={events}
        initialNotes={notes}
        initialTotalNotes={totalNotes || 0}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL}
        supabaseKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
      />
    </div>
  )
}