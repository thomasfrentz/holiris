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
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (!selectedSeniorId) { setDataLoading(false); return }

      const debutSemaine = new Date()
      debutSemaine.setHours(0, 0, 0, 0)
      const finSemaine = new Date()
      finSemaine.setDate(finSemaine.getDate() + (7 - finSemaine.getDay()))
      finSemaine.setHours(23, 59, 59, 999)

      const unMoisAvant = new Date()
      unMoisAvant.setMonth(unMoisAvant.getMonth() - 1)

      const [eventsRes, notesRes, alertesRes] = await Promise.all([
        supabase.from('events').select('*, intervenants(*)')
          .eq('senior_id', selectedSeniorId)
          .gte('scheduled_at', debutSemaine.toISOString())
          .lte('scheduled_at', finSemaine.toISOString())
          .order('scheduled_at', { ascending: true }),
        supabase.from('notes').select('*')
          .eq('senior_id', selectedSeniorId)
          .gte('created_at', unMoisAvant.toISOString())
          .order('created_at', { ascending: false }),
        supabase.from('alertes').select('*')
          .eq('senior_id', selectedSeniorId)
          .eq('lu', false)
          .order('created_at', { ascending: false })
      ])

      const notesData = notesRes.data || []
      const alertesData = alertesRes.data || []

      setEvents(eventsRes.data || [])
      setNotes(notesData)
      setAlertes(alertesData)
      setDataLoading(false)

      // Générer le résumé directement ici, une fois les données disponibles
      if (notesData.length > 0 && selectedSenior) {
        generateResumeWith(notesData, alertesData, selectedSenior)
      }
    }
    loadData()
  }, [selectedSeniorId, selectedSenior])

  async function generateResumeWith(notesData, alertesData, senior) {
    setResumeLoading(true)
    try {
      const notesText = notesData.map(n =>
        `[${new Date(n.created_at).toLocaleDateString('fr-FR')}] ${n.intervenant_name || n.source || 'Inconnu'} : ${n.content}`
      ).join('\n')

      const alertesText = alertesData.length > 0
        ? alertesData.map(a => `- [${a.niveau?.toUpperCase() || 'INFO'}] ${a.message}`).join('\n')
        : 'Aucune alerte active.'

      const prompt = `Tu es un assistant médico-social. Voici les notes de suivi de ${senior?.name} (${senior?.age} ans) sur le dernier mois, ainsi que les alertes actives.

NOTES DU MOIS :
${notesText}

ALERTES ACTIVES :
${alertesText}

Rédige un résumé concis (5-8 lignes maximum) de l'état général de la personne, en mettant en évidence :
1. Les tendances générales (positives ou négatives)
2. Les signaux faibles à surveiller
3. Les points d'attention prioritaires pour l'intervenant

Sois factuel, bienveillant et professionnel. Ne mentionne pas de diagnostics médicaux.`

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{ role: 'user', content: prompt }]
        })
      })

      const data = await response.json()
      const text = data.content?.map(b => b.text || '').join('') || ''
      setResume(text)
    } catch (e) {
      console.error('Erreur résumé:', e)
    }
    setResumeLoading(false)
  }

  async function generateResume() {
    if (notes.length === 0) return
    generateResumeWith(notes, alertes, selectedSenior)
  }

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)
    await supabase.from('notes').insert({
      senior_id: selectedSeniorId,
      content: newNote,
      source: 'intervenant',
      intervenant_name: intervenantName,
      created_at: new Date().toISOString()
    })
    setNewNote('')
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    const unMoisAvant = new Date()
    unMoisAvant.setMonth(unMoisAvant.getMonth() - 1)
    const { data } = await supabase.from('notes').select('*')
      .eq('senior_id', selectedSeniorId)
      .gte('created_at', unMoisAvant.toISOString())
      .order('created_at', { ascending: false })
    setNotes(data || [])
    setSaving(false)
  }

  async function activateCode() {
    if (!newCode.trim()) return
    setCodeLoading(true)
    setCodeError('')
    const { data: { user } } = await supabase.auth.getUser()
    const { data: intervenantData } = await supabase
      .from('intervenants').select('*')
      .eq('code_acces', newCode.trim().toUpperCase())
      .limit(1)

    if (!intervenantData?.length) {
      setCodeError('Code invalide.')
      setCodeLoading(false)
      return
    }

    const intervenant = intervenantData[0]
    if (intervenant.user_id && intervenant.user_id !== user.id) {
      setCodeError('Ce code a déjà été utilisé.')
      setCodeLoading(false)
      return
    }

    await supabase.from('intervenants').update({ user_id: user.id }).eq('id', intervenant.id)
    if (intervenant.email) {
      await supabase.from('intervenants').update({ user_id: user.id }).eq('email', intervenant.email)
    }
    setCodeSuccess(true)
    setTimeout(() => window.location.reload(), 1500)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const statusConfig = {
    note_received: { color: '#2ecc71', label: '✅ Note reçue' },
    silence: { color: '#e74c3c', label: '🔴 Silence' },
    relance_envoyee: { color: '#f39c12', label: '📨 Relancé' },
    a_venir: { color: '#3498db', label: '🕐 À venir' },
  }

  const typeIcon = { care: '🤝', kine: '🦵', medical: '🏥', pharmacy: '💊' }

  const niveauConfig = {
    danger: { color: '#e74c3c', bg: '#fdf0f0', icon: '🔴' },
    warning: { color: '#f39c12', bg: '#fef9ec', icon: '⚠️' },
    info: { color: '#3498db', bg: '#eaf4fd', icon: 'ℹ️' },
  }

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Chargement...</div>
    </div>
  )

  if (!isIntervenant) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#1E2820' }}>
      <div style={{ textAlign: 'center', color: '#e8f0eb', maxWidth: 400, padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
        <h2 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 28, fontWeight: 300, marginBottom: 12 }}>Activez votre compte</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 24 }}>
          Vous avez reçu un code d'accès par email pour activer votre espace intervenant.
        </p>
        <button onClick={() => router.push('/espace-intervenant/onboarding')}
          style={{ background: '#6B8F71', color: '#FAFCFA', border: 'none', borderRadius: 2, padding: '13px 32px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>
          Entrer mon code d'accès
        </button>
        <div style={{ marginTop: 16 }}>
          <button onClick={logout} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            Se déconnecter
          </button>
        </div>
      </div>
    </div>
  )

  if (dataLoading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Chargement...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>

      <div style={{ background: '#12201a', color: '#e8f0eb', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#2ecc71', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#12201a', fontSize: 16 }}>H</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 16 }}>Holiris</div>
            <div style={{ fontSize: 10, color: '#5a8a6a', letterSpacing: 1 }}>ESPACE INTERVENANT</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#9abaa8' }}>👤 {intervenantName}</span>
          <Link href="/agenda" style={{ textDecoration: 'none' }}>
            <span style={{ fontSize: 13, color: '#2ecc71', fontWeight: 'bold', cursor: 'pointer' }}>📅 Agenda</span>
          </Link>
          <button onClick={logout}
            style={{ background: 'rgba(231,76,60,0.15)', color: '#ff8070', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

        <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>DOSSIER ACTIF</label>
          {seniorsList.length > 1 && (
            <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #2ecc71', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff', marginBottom: 10 }}>
              {seniorsList.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.age} ans · {s.city}</option>
              ))}
            </select>
          )}
          {!showCodeInput ? (
            <button onClick={() => setShowCodeInput(true)}
              style={{ background: 'none', border: '1px dashed #ccc', borderRadius: 8, padding: '7px 14px', fontSize: 12, color: '#888', cursor: 'pointer', width: '100%' }}>
              + Ajouter un senior avec un code
            </button>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input placeholder="Code d'accès" value={newCode}
                  onChange={e => setNewCode(e.target.value.toUpperCase())}
                  onKeyDown={e => e.key === 'Enter' && activateCode()}
                  style={{ flex: 1, padding: '9px 12px', border: '1px solid #2ecc71', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'monospace', letterSpacing: '0.15em' }} />
                <button onClick={activateCode} disabled={codeLoading || !newCode.trim()}
                  style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 'bold', cursor: 'pointer' }}>
                  {codeLoading ? '...' : 'Activer'}
                </button>
                <button onClick={() => { setShowCodeInput(false); setNewCode(''); setCodeError('') }}
                  style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '9px 12px', fontSize: 13, cursor: 'pointer' }}>✕</button>
              </div>
              {codeError && <div style={{ fontSize: 12, color: '#e74c3c', marginTop: 6 }}>{codeError}</div>}
              {codeSuccess && <div style={{ fontSize: 12, color: '#27ae60', marginTop: 6 }}>✅ Senior ajouté ! Rechargement...</div>}
            </div>
          )}
        </div>

        <div style={{ background: '#12201a', borderRadius: 12, padding: 20, marginBottom: 20, color: '#e8f0eb' }}>
          <div style={{ fontSize: 11, color: '#5a8a6a', letterSpacing: 1, marginBottom: 8 }}>VOTRE PATIENT</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ fontSize: 36 }}>👵</div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 18 }}>{selectedSenior?.name}</div>
              <div style={{ fontSize: 13, color: '#7aaa8a', marginTop: 2 }}>{selectedSenior?.age} ans · {selectedSenior?.city}</div>
            </div>
          </div>
        </div>

        {alertes.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {alertes.map(a => {
              const cfg = niveauConfig[a.niveau] ?? niveauConfig.info
              return (
                <div key={a.id} style={{ background: cfg.bg, border: `1px solid ${cfg.color}33`, borderRadius: 10, padding: '12px 16px', marginBottom: 8, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <span style={{ fontSize: 16 }}>{cfg.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, color: cfg.color, fontWeight: 'bold', marginBottom: 2 }}>{a.type}</div>
                    <div style={{ fontSize: 13, color: '#444' }}>{a.message}</div>
                    <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>{new Date(a.created_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', margin: 0 }}>🤖 État général — 30 derniers jours</h2>
            <button onClick={generateResume} disabled={resumeLoading}
              style={{ background: 'none', border: '1px solid #ddd', borderRadius: 8, padding: '5px 12px', fontSize: 12, color: '#888', cursor: 'pointer' }}>
              {resumeLoading ? '...' : '↻ Actualiser'}
            </button>
          </div>
          {resumeLoading ? (
            <div style={{ color: '#aaa', fontSize: 13, fontStyle: 'italic' }}>Analyse en cours...</div>
          ) : resume ? (
            <div style={{ fontSize: 14, color: '#333', lineHeight: 1.8, whiteSpace: 'pre-wrap' }}>{resume}</div>
          ) : (
            <div style={{ color: '#aaa', fontSize: 13 }}>Aucune note ce mois-ci pour générer un résumé.</div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>📝 Ajouter une note</h2>
          <textarea
            placeholder={'Comment va ' + (selectedSenior?.name || 'votre patient') + ' aujourd\'hui ?'}
            value={newNote} onChange={e => setNewNote(e.target.value)} rows={4}
            style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', resize: 'none', boxSizing: 'border-box', marginBottom: 12 }}
          />
          <div style={{ background: '#fef9ec', borderRadius: 8, padding: '8px 12px', fontSize: 12, color: '#c4844a', marginBottom: 12 }}>
            ⚠️ Ne partagez pas de diagnostics, ordonnances ou données médicales confidentielles.
          </div>
          {saved && (
            <div style={{ background: '#eafaf1', color: '#27ae60', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12, fontWeight: 'bold' }}>
              ✅ Note publiée !
            </div>
          )}
          <button onClick={addNote} disabled={saving || !newNote.trim()}
            style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '11px 24px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
            {saving ? 'Publication...' : 'Publier la note'}
          </button>
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>📅 Passages cette semaine</h2>
          {events.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucun passage prévu cette semaine</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {events.map(e => {
                const cfg = statusConfig[e.status] ?? { color: '#999', label: e.status }
                return (
                  <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderRadius: 8, background: '#f8f9f8', borderLeft: '3px solid ' + cfg.color }}>
                    <div style={{ fontSize: 20 }}>{typeIcon[e.type] ?? '📋'}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', fontSize: 14, color: '#12201a' }}>{e.label}</div>
                      <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                        {new Date(e.scheduled_at).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: '2-digit' })}
                        {' · '}{new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, padding: '3px 8px', borderRadius: 20, background: cfg.color + '22', color: cfg.color, fontWeight: 'bold' }}>
                      {cfg.label}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>📋 Dernières notes</h2>
          {notes.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucune note ce mois-ci</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.slice(0, 5).map((n, i) => (
                <div key={n.id || i} style={{ padding: '12px 14px', borderRadius: 8, background: '#f8f9f8', borderLeft: '3px solid #9ab89f' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 12, color: '#5a8a6a', fontWeight: 'bold' }}>👤 {n.intervenant_name || 'Inconnu'}</span>
                    <span style={{ fontSize: 11, color: '#aaa' }}>
                      {new Date(n.created_at).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p style={{ fontSize: 14, color: '#333', lineHeight: 1.6, margin: 0 }}>{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}