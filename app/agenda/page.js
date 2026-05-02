'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'
import { useIntervenant } from '../lib/useIntervenant'

export default function Agenda() {
  const [events, setEvents] = useState([])
  const [intervenants, setIntervenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)

  const [label, setLabel] = useState('')
  const [type, setType] = useState('care')
  const [intervenantId, setIntervenantId] = useState('')
  const [date, setDate] = useState('')
  const [heure, setHeure] = useState('')
  const [recurrence, setRecurrence] = useState('none')
  const [recurrenceDays, setRecurrenceDays] = useState([])

  const { seniors, selectedSenior: adminSenior, selectedSeniorId: adminSeniorId, switchSenior: adminSwitch, isAdmin, loading: seniorLoading } = useSenior()
  const { selectedSenior: intervenantSenior, selectedSeniorId: intervenantSeniorId, switchSenior: intervenantSwitch, seniorsList, isIntervenant, loading: intervenantLoading } = useIntervenant()

  const selectedSenior = isIntervenant ? intervenantSenior : adminSenior
  const selectedSeniorId = isIntervenant ? intervenantSeniorId : adminSeniorId
  const switchSenior = isIntervenant ? intervenantSwitch : adminSwitch
  const seniorsList2 = isIntervenant ? seniorsList : seniors

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const joursOptions = [
    { value: '1', label: 'Lun' }, { value: '2', label: 'Mar' },
    { value: '3', label: 'Mer' }, { value: '4', label: 'Jeu' },
    { value: '5', label: 'Ven' }, { value: '6', label: 'Sam' },
    { value: '0', label: 'Dim' },
  ]

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (!selectedSeniorId) { setLoading(false); return }

      const { data: eventsData } = await supabase
        .from('events').select('*, intervenants(*)')
        .eq('senior_id', selectedSeniorId)
        .order('scheduled_at', { ascending: true })
      setEvents(eventsData || [])

      const { data: intervenantsData } = await supabase
        .from('intervenants').select('*')
        .eq('senior_id', selectedSeniorId)
      setIntervenants(intervenantsData || [])

      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId])

  function toggleDay(day) {
    setRecurrenceDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  async function generateRecurringEvents(baseEvent) {
    const evts = []
    const startDate = new Date(baseEvent.scheduled_at)
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + 3)

    if (recurrence === 'daily') {
      let current = new Date(startDate)
      current.setDate(current.getDate() + 1)
      while (current <= endDate) {
        evts.push({ ...baseEvent, scheduled_at: new Date(current).toISOString() })
        current.setDate(current.getDate() + 1)
      }
    } else if (recurrence === 'weekly' && recurrenceDays.length > 0) {
      let current = new Date(startDate)
      current.setDate(current.getDate() + 1)
      while (current <= endDate) {
        if (recurrenceDays.includes(String(current.getDay()))) {
          evts.push({ ...baseEvent, scheduled_at: new Date(current).toISOString() })
        }
        current.setDate(current.getDate() + 1)
      }
    } else if (recurrence === 'biweekly') {
      let current = new Date(startDate)
      current.setDate(current.getDate() + 14)
      while (current <= endDate) {
        evts.push({ ...baseEvent, scheduled_at: new Date(current).toISOString() })
        current.setDate(current.getDate() + 14)
      }
    } else if (recurrence === 'monthly') {
      let current = new Date(startDate)
      current.setMonth(current.getMonth() + 1)
      while (current <= endDate) {
        evts.push({ ...baseEvent, scheduled_at: new Date(current).toISOString() })
        current.setMonth(current.getMonth() + 1)
      }
    }
    return evts
  }

  async function addEvent() {
    if (!label || !date || !heure) return
    setSaving(true)

    const scheduledAt = new Date(date + 'T' + heure).toISOString()
    const baseEvent = {
      senior_id: selectedSeniorId,
      intervenant_id: intervenantId || null,
      label, type,
      scheduled_at: scheduledAt,
      status: 'a_venir',
      recurrence: recurrence !== 'none' ? recurrence : null,
      recurrence_days: recurrenceDays.length > 0 ? recurrenceDays.join(',') : null
    }

    const { data, error } = await supabase.from('events').insert(baseEvent).select('*, intervenants(*)')

    if (!error && data) {
      let allNewEvents = [data[0]]
      if (recurrence !== 'none') {
        const recurringEvents = await generateRecurringEvents(baseEvent)
        if (recurringEvents.length > 0) {
          const { data: recurData } = await supabase.from('events').insert(recurringEvents).select('*, intervenants(*)')
          if (recurData) allNewEvents = [...allNewEvents, ...recurData]
        }
      }
      setEvents(prev => [...prev, ...allNewEvents].sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at)))
      setLabel(''); setType('care'); setIntervenantId(''); setDate(''); setHeure('')
      setRecurrence('none'); setRecurrenceDays([]); setShowForm(false)
    }
    setSaving(false)
  }

  async function deleteEvent(id) {
    if (!isAdmin) return
    await supabase.from('events').delete().eq('id', id)
    setEvents(prev => prev.filter(e => e.id !== id))
  }

  const statusConfig = {
    note_received: { color: '#2ecc71', label: '✅ Note reçue' },
    silence: { color: '#e74c3c', label: '🔴 Silence détecté' },
    relance_envoyee: { color: '#f39c12', label: '📨 Relance envoyée' },
    a_venir: { color: '#3498db', label: '🕐 À venir' },
  }

  const typeOptions = [
    { value: 'care', label: '🤝 Aide à domicile' },
    { value: 'medical', label: '🏥 Médical' },
    { value: 'kine', label: '🦵 Kinésithérapie' },
    { value: 'pharmacy', label: '💊 Pharmacie' },
  ]

  const typeIcon = { care: '🤝', kine: '🦵', medical: '🏥', pharmacy: '💊' }

  const recurrenceLabel = {
    none: 'Une seule fois', daily: 'Tous les jours',
    weekly: 'Toutes les semaines', biweekly: 'Toutes les 2 semaines', monthly: 'Tous les mois',
  }

  const groupedEvents = events.reduce((acc, e) => {
    const d = new Date(e.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
    if (!acc[d]) acc[d] = []
    acc[d].push(e)
    return acc
  }, {})

  if (seniorLoading || intervenantLoading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Chargement...</div>
    </div>
  )

  if (!selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Aucun dossier accessible.</div>
    </div>
  )

  return (
    <Layout
      senior={selectedSenior}
      seniors={seniorsList2}
      selectedSeniorId={selectedSeniorId}
      switchSenior={switchSenior}
      isAdmin={isAdmin}
      isIntervenant={isIntervenant}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>📅 Agenda</h1>
          <p style={{ color: '#888', fontSize: 13 }}>{events.length} événement{events.length > 1 ? 's' : ''} · {selectedSenior?.name}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
          + Ajouter
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>Nouvel événement</h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Description</label>
              <input placeholder="Ex: Passage infirmière" value={label} onChange={e => setLabel(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Type</label>
              <select value={type} onChange={e => setType(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff' }}>
                {typeOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Intervenant</label>
              <select value={intervenantId} onChange={e => setIntervenantId(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff' }}>
                <option value="">Aucun</option>
                {intervenants.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Date de début</label>
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Heure</label>
              <input type="time" value={heure} onChange={e => setHeure(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Récurrence</label>
            <select value={recurrence} onChange={e => { setRecurrence(e.target.value); setRecurrenceDays([]) }}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff' }}>
              <option value="none">Une seule fois</option>
              <option value="daily">Tous les jours</option>
              <option value="weekly">Toutes les semaines (choisir les jours)</option>
              <option value="biweekly">Toutes les 2 semaines</option>
              <option value="monthly">Tous les mois</option>
            </select>
          </div>
          {recurrence === 'weekly' && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>Jours de la semaine</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {joursOptions.map(j => (
                  <button key={j.value} onClick={() => toggleDay(j.value)}
                    style={{ padding: '6px 14px', borderRadius: 20, fontSize: 13, cursor: 'pointer', fontWeight: 'bold',
                      background: recurrenceDays.includes(j.value) ? '#12201a' : '#f0f4f0',
                      color: recurrenceDays.includes(j.value) ? '#2ecc71' : '#888',
                      border: recurrenceDays.includes(j.value) ? '1px solid #12201a' : '1px solid #ddd' }}>
                    {j.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {recurrence !== 'none' && (
            <div style={{ background: '#f0f9f4', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#2d5a47', marginBottom: 16 }}>
              🔄 {recurrenceLabel[recurrence]} — événements générés sur 3 mois
            </div>
          )}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addEvent} disabled={saving || !label || !date || !heure}
              style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
              {saving ? 'Création...' : recurrence !== 'none' ? 'Créer les événements récurrents' : 'Ajouter'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {Object.keys(groupedEvents).length === 0 && !loading && (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 12 }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📅</div>
          <div>Aucun événement pour le moment</div>
        </div>
      )}

      {Object.entries(groupedEvents).map(([d, dayEvents]) => (
        <div key={d} style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>{d}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {dayEvents.map(e => {
              const estPasse = new Date(e.scheduled_at) < new Date() && e.status === 'a_venir'
              const cfg = estPasse
                ? { color: '#bbb', label: '⏱ Passé' }
                : statusConfig[e.status] ?? { color: '#999', label: e.status }
              return (
                <div key={e.id} style={{ background: '#fff', borderRadius: 10, padding: '14px 16px', borderLeft: '4px solid ' + cfg.color, boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ fontSize: 24 }}>{typeIcon[e.type] ?? '📋'}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: 14, color: estPasse ? '#aaa' : '#12201a' }}>
                      {e.label}
                      {e.recurrence && <span style={{ fontSize: 11, color: '#2ecc71', marginLeft: 8 }}>🔄 {recurrenceLabel[e.recurrence]}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                      {new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      {e.intervenants && ' · ' + e.intervenants.name}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: cfg.color + '22', color: cfg.color, fontWeight: 'bold' }}>{cfg.label}</div>
                    {isAdmin && (
                      <button onClick={() => deleteEvent(e.id)}
                        style={{ background: '#fdf0f0', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>🗑️</button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </Layout>
  )
}
