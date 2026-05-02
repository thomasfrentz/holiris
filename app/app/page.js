'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Dashboard from '../dashboard'
import Layout from '../components/Layout'
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
        .from('famille').select('senior_id')
        .eq('user_id', user.id).limit(1)

      if (!familleData?.length) {
        const { data: intervenantData } = await supabase
          .from('intervenants').select('id')
          .eq('user_id', user.id).limit(1)
        router.push(intervenantData?.length > 0 ? '/espace-intervenant' : '/famille-onboarding')
        return
      }

      if (!selectedSeniorId) return

      // 30 jours en arrière pour les derniers passages
      const debutPeriode = new Date()
      debutPeriode.setDate(debutPeriode.getDate() - 30)
      debutPeriode.setHours(0, 0, 0, 0)

      // 3 mois en avant pour les prochains RDV
      const finPeriode = new Date()
      finPeriode.setMonth(finPeriode.getMonth() + 3)
      finPeriode.setHours(23, 59, 59, 999)

      const [eventsRes, notesRes, notesCountRes, alertesRes, ordonnancesRes] = await Promise.all([
        supabase.from('events').select('*, intervenants(*)')
          .eq('senior_id', selectedSeniorId)
          .gte('scheduled_at', debutPeriode.toISOString())
          .lte('scheduled_at', finPeriode.toISOString())
          .order('scheduled_at', { ascending: true }),
        supabase.from('notes').select('*')
          .eq('senior_id', selectedSeniorId)
          .order('created_at', { ascending: false }).limit(3),
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

  if (loading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA', fontSize: 14 }}>Chargement...</div>
    </div>
  )

  return (
    <Layout
      senior={selectedSenior}
      seniors={seniors}
      selectedSeniorId={selectedSeniorId}
      switchSenior={switchSenior}
      isAdmin={isAdmin}
    >
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
    </Layout>
  )
}
