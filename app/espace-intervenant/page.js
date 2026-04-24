'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import { useIntervenant } from '../lib/useIntervenant'

export default function IntervenantDashboard() {
  const [notes, setNotes] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [needsOnboarding, setNeedsOnboarding] = useState(false)
  const { seniorsList, selectedSenior, selectedSeniorId, switchSenior, isIntervenant, intervenantName } = useIntervenant()
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Vérifier si l'utilisateur est un intervenant
      const { data: intervenantsData } = await supabase
        .from('intervenants')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)

      // Si pas intervenant, vérifier si c'est un nouveau compte qui a besoin d'onboarding
      if (!intervenantsData?.length) {
        // Vérifier si c'est une famille
        const { data: familleData } = await supabase
          .from('famille')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)

        if (familleData?.length) {
          router.push('/app')
        } else {
          setNeedsOnboarding(true)
        }
        setLoading(false)
        return
      }

      if (!selectedSeniorId) return

      const debutSemaine = new Date()
      debutSemaine.setHours(0, 0, 0, 0)
      const finSemaine = new Date()
      finSemaine.setDate(finSemaine.getDate() + (7 - finSemaine.getDay()))
      finSemaine.setHours(23, 59, 59, 999)

      const { data: eventsData } = await supabase
        .from('events')
        .select('*, intervenants(*)')
        .eq('senior_id', selectedSeniorId)
        .gte('scheduled_at', debutSemaine.toISOString())
        .lte('scheduled_at', finSemaine.toISOString())
        .order('scheduled_at', { ascending: true })
      setEvents(eventsData || [])

      const { data: notesData } = await supabase
        .from('notes')
        .select('*')
        .eq('senior_id', selectedSeniorId)
        .order('created_at', { ascending: false })
        .limit(5)
      setNotes(notesData || [])

      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId])

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)

    await supabase.from('notes').insert({
      senior_id: selectedSeniorId,
      content: newNote,
      source: 'famille',
      intervenant_name: intervenantName,
      created_at: new Date().toISOString()
    })

    setNewNote('')
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)

    const { data } = await supabase
      .from('notes')
      .select('*')
      .eq('senior_id', selectedSeniorId)
      .order('created_at', { ascending: false })
      .limit(5)
    setNotes(data || [])
    setSaving(false)
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

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Chargement...</div>
    </div>
  )

  if (needsOnboarding) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#1E2820' }}>
      <div style={{ textAlign: 'center', color: '#e8f0eb', maxWidth: 400, padding: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔑</div>
        <h2 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 28, fontWeight: 300, marginBottom: 12 }}>Activez votre compte</h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 24 }}>
          Vous avez reçu un code d'accès par email. Entrez-le pour activer votre espace intervenant.
        </p>
        <button
          onClick={() => router.push('/espace-intervenant/onboarding')}
          style={{ background: '#6B8F71', color: '#FAFCFA', border: 'none', borderRadius: 2, padding: '13px 32px', fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
        >
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

  return (
    <div style={{ minHeight: '100vh', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      {/* HEADER */}
      <div style={{ background: '#12201a', color: '#e8f0eb', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#2ecc71', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#12201a', fontSize: 16 }}>H</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 16 }}>Holiris</div>
            <div style={{ fontSize: 10, color: '#5a8a6a', letterSpacing: 1 }}>ESPACE INTERVENANT</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, color: '#9abaa8' }}>👤 {intervenantName}</span>
          <button onClick={logout}
            style={{ background: 'rgba(231,76,60,0.15)', color: '#ff8070', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer' }}>
            Déconnexion
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '24px 16px' }}>

        {/* SÉLECTEUR SENIOR */}
        {seniorsList.length > 1 && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 8 }}>DOSSIER ACTIF</label>
            <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #2ecc71', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff' }}>
              {seniorsList.map(s => (
                <option key={s.id} value={s.id}>{s.name} · {s.age} ans · {s.city}</option>
              ))}
            </select>
          </div>
        )}

        {/* CARTE SENIOR */}
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

        {/* AJOUTER UNE NOTE */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>📝 Ajouter une note</h2>
          <textarea
            placeholder={'Comment va ' + selectedSenior?.name + ' aujourd\'hui ?'}
            value={newNote}
            onChange={e => setNewNote(e.target.value)}
            rows={4}
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

        {/* AGENDA SEMAINE */}
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
                        {' · '}
                        {new Date(e.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
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

        {/* DERNIÈRES NOTES */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>📋 Dernières notes</h2>
          {notes.length === 0 ? (
            <div style={{ color: '#aaa', fontSize: 13, textAlign: 'center', padding: 20 }}>Aucune note pour le moment</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {notes.map((n, i) => (
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
