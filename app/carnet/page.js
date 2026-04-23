'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAdmin } from '../lib/useAdmin'

export default function Carnet() {
  const [notes, setNotes] = useState([])
  const [senior, setSenior] = useState(null)
  const [famille, setFamille] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const { isAdmin } = useAdmin()
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
        .select('*')
        .eq('user_id', user.id)
        .limit(1)

      const seniorId = familleData?.[0]?.senior_id
      if (!seniorId) { router.push('/login'); return }

      setFamille(familleData[0])

      const { data: seniors } = await supabase
        .from('seniors')
        .select('*')
        .eq('id', seniorId)
      setSenior(seniors?.[0])

      const { data: notes } = await supabase
        .from('notes')
        .select('*')
        .eq('senior_id', seniorId)
        .order('created_at', { ascending: false })
      setNotes(notes || [])

      setLoading(false)
    }
    loadData()
  }, [])

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)

    const authorName = famille?.name || famille?.email?.split('@')[0] || 'Famille'

    const { data, error } = await supabase.from('notes').insert({
      senior_id: senior.id,
      content: newNote,
      source: 'famille',
      intervenant_name: authorName + (famille?.role ? ' · ' + famille.role : ''),
      created_at: new Date().toISOString()
    }).select()

    if (!error && data) {
      setNotes(prev => [data[0], ...prev])
      setNewNote('')
      setShowForm(false)
    }
    setSaving(false)
  }

  async function deleteNote(id) {
    if (!isAdmin) return
    await supabase.from('notes').delete().eq('id', id)
    setNotes(prev => prev.filter(n => n.id !== id))
  }

  async function editNote(id, content) {
    if (!isAdmin) return
    const newContent = prompt('Modifier la note :', content)
    if (!newContent || newContent === content) return
    await supabase.from('notes').update({ content: newContent }).eq('id', id)
    setNotes(prev => prev.map(n => n.id === id ? { ...n, content: newContent } : n))
  }

  const sourceLabel = (source) => {
    if (source === 'whatsapp_audio') return { icon: '🎤', label: 'Note vocale', color: '#9b59b6' }
    if (source === 'whatsapp_text') return { icon: '💬', label: 'WhatsApp', color: '#25D366' }
    if (source === 'famille') return { icon: '👨‍👩‍👧', label: 'Note famille', color: '#3498db' }
    return { icon: '📝', label: 'Note', color: '#3498db' }
  }

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Chargement...</div>
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
            { icon: '⚡', label: 'Flux en temps réel', href: '/' },
            { icon: '📅', label: 'Agenda', href: '/agenda' },
            { icon: '📝', label: 'Carnet de suivi', href: '/carnet' },
            { icon: '👥', label: 'Intervenants', href: '/intervenants' },
            { icon: '🤖', label: 'Assistant IA', href: '/assistant' },
            { icon: '👤', label: 'Mon profil', href: '/profil' },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                color: item.href === '/carnet' ? '#2ecc71' : '#9abaa8',
                background: item.href === '/carnet' ? 'rgba(46,204,113,0.15)' : 'none',
                fontWeight: item.href === '/carnet' ? 'bold' : 'normal',
                cursor: 'pointer', fontSize: 14
              }}>
                <span>{item.icon}</span>{item.label}
              </div>
            </Link>
          ))}
        </nav>

        {isAdmin && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ff8070' }}>🔐 Mode Admin</div>
            <div style={{ fontSize: 11, color: '#cc8070', marginTop: 2 }}>Modification et suppression activées</div>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a' }}>
            📝 Carnet de suivi
          </h1>
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
            + Ajouter une note
          </button>
        </div>
        <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>
          {notes.length} notes · {senior?.name}
        </p>

        {showForm && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
              Note de <strong>{famille?.name || famille?.email}</strong>
              {famille?.role && <span> · {famille.role}</span>}
            </div>
            <textarea
              placeholder="Décrivez l'état de votre proche, une observation, un événement..."
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              rows={4}
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', resize: 'none', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addNote} disabled={saving || !newNote.trim()}
                style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
                {saving ? 'Publication...' : 'Publier'}
              </button>
              <button onClick={() => { setShowForm(false); setNewNote('') }}
                style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {notes.map((n, index) => {
            const src = sourceLabel(n.source)
            return (
              <div key={n.id || index} style={{
                background: '#fff',
                borderRadius: 12,
                padding: 18,
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                borderLeft: '4px solid ' + src.color
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                      <span style={{ fontSize: 14 }}>{src.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 'bold', color: src.color }}>{src.label}</span>
                    </div>
                    {n.intervenant_name && (
                      <div style={{ fontSize: 13, color: '#333', fontWeight: '600', background: '#f0f4f0', padding: '3px 10px', borderRadius: 20, display: 'inline-block' }}>
                        👤 {n.intervenant_name}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 10 }}>
                    <span style={{ fontSize: 11, color: '#aaa' }}>
                      {new Date(n.created_at).toLocaleString('fr-FR', {
                        weekday: 'short', day: '2-digit', month: '2-digit',
                        hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    {isAdmin && (
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => editNote(n.id, n.content)}
                          style={{ background: '#f0f9ff', color: '#3498db', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>
                          ✏️ Modifier
                        </button>
                        <button onClick={() => deleteNote(n.id)}
                          style={{ background: '#fdf0f0', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>
                          🗑️ Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                <p style={{ fontSize: 14, color: '#333', lineHeight: 1.7, margin: 0 }}>
                  {n.content}
                </p>
              </div>
            )
          })}

          {notes.length === 0 && (
            <div style={{ textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
              <div>Aucune note pour le moment</div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
