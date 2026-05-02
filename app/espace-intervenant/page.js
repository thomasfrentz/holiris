'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useIntervenant } from '../lib/useIntervenant'

export default function IntervenantDashboard() {
  const [notes, setNotes] = useState([])
  const [events, setEvents] = useState([])
  const [alertes, setAlertes] = useState([])
  const [dataLoading, setDataLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [newCode, setNewCode] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [codeSuccess, setCodeSuccess] = useState(false)
  const [resume, setResume] = useState('')
  const [resumeLoading, setResumeLoading] = useState(false)

  const { seniorsList, selectedSenior, selectedSeniorId, switchSenior, isIntervenant, intervenantName, loading } = useIntervenant()
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    if (!selectedSeniorId || !selectedSenior) return
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const debutSemaine = new Date(); debutSemaine.setHours(0, 0, 0, 0)
      const finSemaine = new Date(); finSemaine.setDate(finSemaine.getDate() + (7 - finSemaine.getDay())); finSemaine.setHours(23, 59, 59, 999)
      const unMoisAvant = new Date(); unMoisAvant.setMonth(unMoisAvant.getMonth() - 1)

      const [eventsRes, notesRes, alertesRes] = await Promise.all([
        supabase.from('events').select('*, intervenants(*)').eq('senior_id', selectedSeniorId).gte('scheduled_at', debutSemaine.toISOString()).lte('scheduled_at', finSemaine.toISOString()).order('scheduled_at', { ascending: true }),
        supabase.from('notes').select('*').eq('senior_id', selectedSeniorId).gte('created_at', unMoisAvant.toISOString()).order('created_at', { ascending: false }),
        supabase.from('alertes').select('*').eq('senior_id', selectedSeniorId).eq('lu', false).order('created_at', { ascending: false })
      ])

      const notesData = notesRes.data || []
      const alertesData = alertesRes.data || []
      setEvents(eventsRes.data || [])
      setNotes(notesData)
      setAlertes(alertesData)
      setDataLoading(false)
      if (notesData.length > 0) generateResumeWith(notesData, alertesData, selectedSenior)
    }
    loadData()
  }, [selectedSeniorId, selectedSenior])

  async function generateResumeWith(notesData, alertesData, senior) {
    setResumeLoading(true)
    try {
      const response = await fetch('/api/resume', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ notes: notesData, alertes: alertesData, senior }) })
      const data = await response.json()
      setResume(data.resume || '')
    } catch (e) { console.error('Erreur résumé:', e) }
    setResumeLoading(false)
  }

  async function generateResume() {
    if (notes.length === 0 || !selectedSenior) return
    generateResumeWith(notes, alertes, selectedSenior)
  }

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)
    await supabase.from('notes').insert({
      senior_id: selectedSeniorId, content: newNote,
      source: 'intervenant', intervenant_name: intervenantName,
      created_at: new Date().toISOString()
    })
    setNewNote(''); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    const unMoisAvant = new Date(); unMoisAvant.setMonth(unMoisAvant.getMonth() - 1)
    const { data } = await supabase.from('notes').select('*').eq('senior_id', selectedSeniorId).gte('created_at', unMoisAvant.toISOString()).order('created_at', { ascending: false })
    setNotes(data || [])
    setSaving(false)
  }

  async function activateCode() {
    if (!newCode.trim()) return
    setCodeLoading(true); setCodeError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: intervenantData } = await supabase.from('intervenants').select('*').eq('code_acces', newCode.trim().toUpperCase()).limit(1)

    if (!intervenantData?.length) { setCodeError('Code invalide.'); setCodeLoading(false); return }
    const intervenant = intervenantData[0]
    if (intervenant.user_id && intervenant.user_id !== user.id) { setCodeError('Ce code a déjà été utilisé.'); setCodeLoading(false); return }

    await supabase.from('intervenants').update({ user_id: user.id }).eq('id', intervenant.id)
    if (intervenant.email) await supabase.from('intervenants').update({ user_id: user.id }).eq('email', intervenant.email)
    setCodeSuccess(true)
    setTimeout(() => window.location.reload(), 1500)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const statusColors = { note_received: '#7FAF9B', silence: '#D98992', relance_envoyee: '#E6B98A', a_venir: '#BC84C6' }
  const statusBgs = { note_received: '#EAF4EF', silence: '#FBECED', relance_envoyee: '#FDF3E7', a_venir: '#F3EDF7' }
  const statusLabels = { note_received: 'Reçu', silence: 'Silence', relance_envoyee: 'Relancé', a_venir: 'À venir' }
  const typeLabel = { care: 'Aide à domicile', kine: 'Kiné', medical: 'Médical', pharmacy: 'Pharmacie' }

  const cardStyle = { background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '20px 22px', marginBottom: 16 }
  const Tag = ({ children, color, bg }) => (
    <span style={{ fontSize: 11, fontWeight: 500, color, background: bg, padding: '3px 10px', borderRadius: 20 }}>{children}</span>
  )

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA', fontSize: 14 }}>Chargement...</div>
    </div>
  )

  if (!isIntervenant) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)' }}>
      <div style={{ textAlign: 'center', maxWidth: 400, padding: 32 }}>
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 24 }}>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.5" fill="none"/>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.5" fill="none"/>
          <circle cx="32" cy="32" r="5" fill="#7FAF9B"/>
          <circle cx="32" cy="32" r="2.2" fill="#FCFDFC"/>
        </svg>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: '#1F2A24', marginBottom: 12 }}>Activez votre compte</h2>
        <p style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.7, marginBottom: 28, fontWeight: 300 }}>
          Vous avez reçu un code d'accès par email pour activer votre espace intervenant.
        </p>
        <button onClick={() => router.push('/espace-intervenant/onboarding')}
          style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '13px 32px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: "'Inter', sans-serif" }}>
          Entrer mon code d'accès →
        </button>
        <div style={{ marginTop: 16 }}>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: '#9BB5AA', fontSize: 12, cursor: 'pointer', textDecoration: 'underline', fontFamily: "'Inter', sans-serif" }}>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )

  if (dataLoading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA', fontSize: 14 }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif", background: '#F7F9F8', color: '#1F2A24' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Inter:wght@300;400;500;600&display=swap');`}</style>

      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '1px solid #EBF0EC', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="30" height="30" viewBox="0 0 64 64" fill="none">
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="2" fill="none"/>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="2" fill="none"/>
            <circle cx="32" cy="32" r="4" fill="#7FAF9B"/>
            <circle cx="32" cy="32" r="1.8" fill="#fff"/>
          </svg>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1F2A24', lineHeight: 1 }}>Holiris</div>
            <div style={{ fontSize: 9, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Espace intervenant</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#6F7C75' }}>{intervenantName}</span>
          <Link href="/agenda" style={{ textDecoration: 'none', fontSize: 13, color: '#4A8870', fontWeight: 500 }}>Agenda</Link>
          <button onClick={logout} style={{ background: '#FBECED', color: '#C4606A', border: '1px solid #F2C4C8', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 20px' }}>

        {/* Header page */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>
            {new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1.1 }}>
            Bonjour, {intervenantName?.split(' ')[0]}
          </h1>
        </div>

        {/* Sélecteur senior */}
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Dossier actif</div>
          {seniorsList.length > 1 ? (
            <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
              style={{ width: '100%', background: 'transparent', color: '#1F2A24', border: '1px solid #E8EFEB', borderRadius: 8, padding: '10px 14px', fontSize: 15, outline: 'none', fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, marginBottom: 12, cursor: 'pointer' }}>
              {seniorsList.map(s => <option key={s.id} value={s.id}>{s.name} · {s.age} ans · {s.city}</option>)}
            </select>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#1F2A24' }}>{selectedSenior?.name}</div>
              <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>{selectedSenior?.age} ans · {selectedSenior?.city}</div>
            </div>
          )}
          {!showCodeInput ? (
            <button onClick={() => setShowCodeInput(true)}
              style={{ background: 'none', border: '1px dashed #C8DDD4', borderRadius: 8, padding: '8px 16px', fontSize: 12, color: '#9BB5AA', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
              + Ajouter un senior avec un code
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Code d'accès" value={newCode} onChange={e => setNewCode(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && activateCode()}
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #C8DDD4', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'monospace', letterSpacing: '0.15em' }} />
                <button onClick={activateCode} disabled={codeLoading || !newCode.trim()}
                  style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {codeLoading ? '...' : 'Activer'}
                </button>
                <button onClick={() => { setShowCodeInput(false); setNewCode(''); setCodeError('') }}
                  style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>✕</button>
              </div>
              {codeError && <div style={{ fontSize: 12, color: '#D98992', marginTop: 6 }}>{codeError}</div>}
              {codeSuccess && <div style={{ fontSize: 12, color: '#4A8870', marginTop: 6 }}>Senior ajouté — rechargement...</div>}
            </div>
          )}
        </div>

        {/* Alertes */}
        {alertes.length > 0 && (
          <div style={{ marginBottom: 16 }}>
            {alertes.map(a => {
              const danger = a.niveau === 'danger'
              const color = danger ? '#D98992' : '#E6B98A'
              const bg = danger ? '#FBECED' : '#FDF3E7'
              const border = danger ? '#F2C4C8' : '#F0D9B5'
              return (
                <div key={a.id} style={{ background: bg, border: '1px solid ' + border, borderLeft: '3px solid ' + color, borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, marginTop: 5, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 10, color, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 4 }}>{danger ? 'Urgent' : 'Attention'}</div>
                    <div style={{ fontSize: 13, color: '#1F2A24' }}>{a.message}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Résumé IA */}
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#BC84C6', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 4 }}>Synthèse IA</div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#1F2A24' }}>État général — 30 derniers jours</div>
            </div>
            <button onClick={generateResume} disabled={resumeLoading}
              style={{ background: '#F3EDF7', color: '#8B6FAA', border: '1px solid #E0D0EC', borderRadius: 6, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
              {resumeLoading ? '...' : '↻ Actualiser'}
            </button>
          </div>
          {resumeLoading ? (
            <div style={{ color: '#9BB5AA', fontSize: 13, fontStyle: 'italic' }}>Analyse en cours...</div>
          ) : resume ? (
            <div style={{ fontSize: 14, color: '#3A4A40', lineHeight: 1.8, fontWeight: 300, whiteSpace: 'pre-wrap' }}>{resume}</div>
          ) : (
            <div style={{ color: '#9BB5AA', fontSize: 13 }}>Aucune note ce mois-ci pour générer un résumé.</div>
          )}
        </div>

        {/* Ajouter une note */}
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>Nouvelle note</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontWeight: 500, color: '#1F2A24', marginBottom: 14 }}>
            Comment va {selectedSenior?.name?.split(' ')[0]} aujourd'hui ?
          </div>
          <textarea
            placeholder="Décrivez l'état général, l'humeur, les activités..."
            value={newNote} onChange={e => setNewNote(e.target.value)} rows={4}
            style={{ width: '100%', padding: '12px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', marginBottom: 10, color: '#1F2A24', background: '#FAFCFC' }}
          />
          <div style={{ background: '#FDF3E7', border: '1px solid #F0D9B5', borderRadius: 8, padding: '8px 14px', fontSize: 12, color: '#C4844A', marginBottom: 14, fontWeight: 400 }}>
            Ne partagez pas de diagnostics, ordonnances ou données médicales confidentielles.
          </div>
          {saved && (
            <div style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
              Note publiée avec succès.
            </div>
          )}
          <button onClick={addNote} disabled={saving || !newNote.trim()}
            style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!newNote.trim() || saving) ? 0.5 : 1 }}>
            {saving ? 'Publication...' : 'Publier la note'}
          </button>
        </div>

        {/* Passages semaine */}
        <div style={{ ...cardStyle }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Passages cette semaine</div>
          {events.length === 0 ? (
            <div style={{ color: '#9BB5AA', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucun passage prévu cette semaine</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {events.map((e, i) => {
                const color = statusColors[e.status] || '#9BB5AA'
                const bg = statusBgs[e.status] || '#F4F5F5'
                const estPasse = new Date(e.scheduled_at) < new Date() && e.status === 'a_venir'
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 8, background: '#F7F9F8', borderLeft: '3px solid ' + (estPasse ? '#E8EFEB' : color), opacity: estPasse ? 0.5 : 1 }}>
                    <div style={{ fontSize: 12, color: '#9BB5AA', width: 44, flexShrink: 0, fontWeight: 500 }}>
                      {new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, color: '#1F2A24', fontWeight: 400 }}>{e.label}</div>
                      <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 2 }}>
                        {new Date(e.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                      </div>
                    </div>
                    <Tag color={estPasse ? '#9BB5AA' : color} bg={estPasse ? '#F4F5F5' : bg}>
                      {estPasse ? 'Passé' : statusLabels[e.status]}
                    </Tag>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Dernières notes */}
        <div style={{ ...cardStyle, marginBottom: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Dernières notes</div>
          {notes.length === 0 ? (
            <div style={{ color: '#9BB5AA', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Aucune note ce mois-ci</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {notes.slice(0, 5).map((n, i) => (
                <div key={n.id || i} style={{ padding: '14px 16px', borderRadius: 8, background: '#F7F9F8', borderLeft: '3px solid #C8DDD4' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <span style={{ fontSize: 12, color: '#4A8870', fontWeight: 500 }}>{n.intervenant_name || 'Inconnu'}</span>
                    <span style={{ fontSize: 11, color: '#9BB5AA' }}>
                      {new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: '#3A4A40', lineHeight: 1.7, margin: 0, fontWeight: 300 }}>{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
