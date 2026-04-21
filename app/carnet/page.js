'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Carnet() {
  const [notes, setNotes] = useState([])
  const [senior, setSenior] = useState(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Récupérer le senior lié à cet utilisateur
      const { data: familleData } = await supabase
        .from('famille')
        .select('senior_id')
        .eq('user_id', user.id)
        .limit(1)

      const seniorId = familleData?.[0]?.senior_id
      if (!seniorId) { router.push('/login'); return }

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
      </aside>

      <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
        <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>
          📝 Carnet de suivi
        </h1>
        <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>
          {notes.length} notes au total · {senior?.name}
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {notes.map((n, index) => (
            <div key={n.id || index} style={{
              background: '#fff',
              borderRadius: 10,
              padding: 16,
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
              borderLeft: `4px solid ${n.source === 'whatsapp_audio' ? '#9b59b6' : n.source === 'whatsapp_text' ? '#2ecc71' : '#3498db'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 'bold', color: '#12201a' }}>
                  {n.source === 'whatsapp_audio' ? '🎤 Note vocale' :
                   n.source === 'whatsapp_text' ? '💬 WhatsApp' : '📝 Note'}
                </span>
                <span style={{ fontSize: 11, color: '#aaa' }}>
                  {new Date(n.created_at).toLocaleString('fr-FR', {
                    weekday: 'short', day: '2-digit', month: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </span>
              </div>
              <p style={{ fontSize: 14, color: '#444', lineHeight: 1.6, margin: 0 }}>
                {n.content}
              </p>
            </div>
          ))}

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
