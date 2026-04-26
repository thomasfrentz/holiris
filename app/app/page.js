'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Dashboard from '../dashboard'
import { useSenior } from '../lib/useSenior'

export default function App() {
  const [events, setEvents] = useState([])
  const [notes, setNotes] = useState([])
  const [totalNotes, setTotalNotes] = useState(0)
  const [alertes, setAlertes] = useState([])
  const [ordonnances, setOrdonnances] = useState([])
  const [loading, setLoading] = useState(true)
  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin } = useSenior()
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: familleData } = await supabase
        .from('famille')
        .select('senior_id')
        .eq('user_id', user.id)
        .limit(1)

      if (!familleData?.length) {
        const { data: intervenantData } = await supabase
          .from('intervenants')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)

        if (intervenantData?.length > 0) {
          router.push('/espace-intervenant')
        } else {
          router.push('/espace-intervenant')
        }
        return
      }

      if (!selectedSeniorId) return

      const debutSemaine = new Date()
      debutSemaine.setHours(0, 0, 0, 0)
      const finSemaine = new Date()
      finSemaine.setDate(finSemaine.getDate() + (7 - finSemaine.getDay()))
      finSemaine.setHours(23, 59, 59, 999)

      const [eventsRes, notesRes, notesCountRes, alertesRes, ordonnancesRes] = await Promise.all([
        supabase.from('events').select('*, intervenants(*)')
          .eq('senior_id', selectedSeniorId)
          .gte('scheduled_at', debutSemaine.toISOString())
          .lte('scheduled_at', finSemaine.toISOString())
          .order('scheduled_at', { ascending: true }),
        supabase.from('notes').select('*')
          .eq('senior_id', selectedSeniorId)
          .order('created_at', { ascending: false })
          .limit(3),
        supabase.from('notes').select('*', { count: 'exact', head: true })
          .eq('senior_id', selectedSeniorId),
        supabase.from('alertes').select('*')
          .eq('senior_id', selectedSeniorId)
          .eq('lu', false)
          .order('created_at', { ascending: false }),
        supabase.from('ordonnances').select('*')
          .eq('senior_id', selectedSeniorId)
          .order('date_renouvellement', { ascending: true })
      ])

      setEvents(eventsRes.data || [])
      setNotes(notesRes.data || [])
      setTotalNotes(notesCountRes.count || 0)
      setOrdonnances(ordonnancesRes.data || [])

      // Générer alertes renouvellement automatiquement
      const aujourd_hui = new Date()
      const alertesOrdonnances = (ordonnancesRes.data || []).filter(o => {
        const jours = Math.ceil((new Date(o.date_renouvellement) - aujourd_hui) / (1000 * 60 * 60 * 24))
        return jours <= 7 && jours >= 0
      }).map(o => {
        const jours = Math.ceil((new Date(o.date_renouvellement) - aujourd_hui) / (1000 * 60 * 60 * 24))
        return {
          id: 'ordonnance-' + o.id,
          message: `Renouvellement ordonnance "${o.type_ordonnance}" dans ${jours} jour${jours > 1 ? 's' : ''}`,
          niveau: jours <= 2 ? 'danger' : 'warning',
          created_at: new Date().toISOString(),
          lu: false,
          type: 'ordonnance'
        }
      })

      setAlertes([...alertesOrdonnances, ...(alertesRes.data || [])])
      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId])

  const silenceCount = events.filter(e => e.status === 'silence').length

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  if (loading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888', fontSize: 16 }}>Chargement...</div>
    </div>
  )

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

        {isAdmin && seniors.length > 1 ? (
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#5a8a6a', marginBottom: 8, letterSpacing: 1 }}>DOSSIER ACTIF</div>
            <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
              style={{ width: '100%', background: '#1a3028', color: '#e8f0eb', border: '1px solid #2ecc71', borderRadius: 8, padding: '8px 10px', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
              {seniors.map(s => <option key={s.id} value={s.id}>{s.name} · {s.age} ans</option>)}
            </select>
            <div style={{ fontSize: 11, color: '#7aaa8a', marginTop: 6 }}>{selectedSenior?.city}</div>
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>👵</div>
            <div style={{ fontWeight: 'bold' }}>{selectedSenior?.name}</div>
            <div style={{ fontSize: 12, color: '#7aaa8a', marginTop: 2 }}>{selectedSenior?.age} ans · {selectedSenior?.city}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#2ecc71', marginTop: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#2ecc71', display: 'inline-block' }} />
              Situation stable
            </div>
          </div>
        )}

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
          { icon: '⚡', label: 'Flux en temps réel', href: '/app' },
          { icon: '📅', label: 'Agenda', href: '/agenda' },
          { icon: '📝', label: 'Carnet de suivi', href: '/carnet' },
          { icon: '💊', label: 'Ordonnances', href: '/ordonnances' },
          { icon: '👥', label: 'Intervenants', href: '/intervenants' },
          { icon: '🤖', label: 'Assistant IA', href: '/assistant' },
          { icon: '👤', label: 'Mon profil', href: '/profil' },

          ].map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                color: item.href === '/app' ? '#2ecc71' : '#9abaa8',
                background: item.href === '/app' ? 'rgba(46,204,113,0.15)' : 'none',
                fontWeight: item.href === '/app' ? 'bold' : 'normal',
                cursor: 'pointer', fontSize: 14
              }}>
                <span>{item.icon}</span>{item.label}
              </div>
            </Link>
          ))}
        </nav>

        {silenceCount > 0 && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 'bold', color: '#ff8070' }}>⚠️ {silenceCount} silence{silenceCount > 1 ? 's' : ''} détecté{silenceCount > 1 ? 's' : ''}</div>
            <div style={{ fontSize: 11, color: '#cc8070', marginTop: 2 }}>L'IA a relancé les intervenants</div>
          </div>
        )}

        {isAdmin && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ff8070' }}>🔐 Mode Admin</div>
            <div style={{ fontSize: 11, color: '#cc8070', marginTop: 2 }}>Accès complet activé</div>
          </div>
        )}

        <div style={{ marginTop: 'auto' }}>
          <button onClick={logout}
            style={{ width: '100%', background: 'rgba(231,76,60,0.15)', color: '#ff8070', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, padding: '10px 0', fontSize: 13, cursor: 'pointer', fontWeight: 'bold' }}>
            🚪 Se déconnecter
          </button>
        </div>
      </aside>

      <Dashboard
        initialSenior={selectedSenior}
        initialEvents={events}
        initialNotes={notes}
        initialTotalNotes={totalNotes}
        initialAlertes={alertes}
        initialOrdonnances={ordonnances}
        supabaseUrl={process.env.NEXT_PUBLIC_SUPABASE_URL}
        supabaseKey={process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}
      />
    </div>
  )
}
