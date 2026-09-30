'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Dashboard from '../dashboard'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'
import { useNonLus } from '../lib/useNonLus'
import BandeauMessages from '../components/BandeauMessages'

export default function App() {
  const [events, setEvents] = useState([])
  const [notes, setNotes] = useState([])
  const [totalNotes, setTotalNotes] = useState(0)
  const [alertes, setAlertes] = useState([])
  const [ordonnances, setOrdonnances] = useState([])
  const [loading, setLoading] = useState(true)
  const [aContacter, setAContacter] = useState([])
  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin, loading: seniorsLoading } = useSenior()
  const [estGestionnaire, setEstGestionnaire] = useState(false)
  const nonLus = useNonLus()
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  // Gestionnaire sans client pour l'instant : direction « Ma structure » pour créer un premier dossier
  useEffect(() => {
    if (estGestionnaire && !seniorsLoading && !seniors.length) router.push('/structure')
  }, [estGestionnaire, seniorsLoading, seniors.length])

  // Demandes de contact suite à une information médicale essentielle
  useEffect(() => {
    fetch('/api/signalement')
      .then(res => res.ok ? res.json() : { signalements: [] })
      .then(data => setAContacter(data.signalements || []))
      .catch(() => {})
  }, [])

  async function marquerContacte(id) {
    const res = await fetch('/api/signalement', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action: 'contacte' })
    })
    const result = await res.json()
    if (result.success) setAContacter(prev => prev.filter(s => s.id !== id))
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: familleData } = await supabase
        .from('famille').select('senior_id')
        .eq('user_id', user.id).is('archived_at', null).limit(1)

      // Un gestionnaire de structure accède au tableau de bord de ses clients sans ligne famille
      const { data: gestionData } = familleData?.length ? { data: [] }
        : await supabase.from('structure_membres').select('id').eq('user_id', user.id).limit(1)

      if (gestionData?.length) setEstGestionnaire(true)

      if (!familleData?.length && !gestionData?.length) {
        const { data: intervenantData } = await supabase
          .from('intervenants').select('id')
          .eq('user_id', user.id).is('archived_at', null).limit(1)
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
      <BandeauMessages nonLus={nonLus} seniorId={selectedSeniorId} />
      {aContacter.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #E0D0EC', borderLeft: '3px solid #8B6FAA', borderRadius: 12, padding: '16px 20px', marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#8B6FAA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>À contacter</div>
          <div style={{ fontSize: 12, color: '#9BB5AA', marginBottom: 12, lineHeight: 1.5 }}>
            Ces personnes ont une information médicale jugée essentielle. Elle n&apos;est pas enregistrée sur Holiris : appelez-les pour en savoir plus.
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {aContacter.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', paddingTop: 10, borderTop: '1px solid #F3EDF7' }}>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#1F2A24' }}>
                    {s.auteur_nom}{s.auteur_role ? ' · ' + s.auteur_role : ''}
                  </div>
                  <div style={{ fontSize: 12, color: '#6F7C75', marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>Suivi de {s.seniors?.name}</span>
                    {s.auteur_telephone && <a href={'tel:' + s.auteur_telephone} style={{ color: '#4A8870' }}>{s.auteur_telephone}</a>}
                    {s.auteur_email && <a href={'mailto:' + s.auteur_email} style={{ color: '#4A8870' }}>{s.auteur_email}</a>}
                    <span style={{ color: '#9BB5AA' }}>{new Date(s.repondu_at).toLocaleDateString('fr-FR')}</span>
                  </div>
                </div>
                <button onClick={() => marquerContacte(s.id)}
                  style={{ background: '#F3EDF7', color: '#8B6FAA', border: '1px solid #E0D0EC', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                  C&apos;est fait ✓
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
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
