'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Assistant() {
  const [senior, setSenior] = useState(null)
  const [notes, setNotes] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Bonjour ! Je suis l\'assistant IA Holiris. Je connais toute la situation de votre proche et peux répondre à vos questions, résumer la semaine, ou vous conseiller sur les aides disponibles.' }
  ])
  const [input, setInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const chatEndRef = useRef(null)
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

      const seniorId = familleData?.[0]?.senior_id
      if (!seniorId) { router.push('/login'); return }

      const { data: seniors } = await supabase
        .from('seniors')
        .select('*')
        .eq('id', seniorId)
      setSenior(seniors?.[0])

      const { data: notesData } = await supabase
        .from('notes')
        .select('*')
        .eq('senior_id', seniorId)
        .order('created_at', { ascending: false })
        .limit(10)
      setNotes(notesData || [])

      const { data: eventsData } = await supabase
        .from('events')
        .select('*, intervenants(*)')
        .eq('senior_id', seniorId)
        .order('scheduled_at', { ascending: false })
        .limit(10)
      setEvents(eventsData || [])

      setLoading(false)
    }
    loadData()
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || aiLoading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setAiLoading(true)

    const context = `Tu es l'assistant IA de Holiris, plateforme de suivi des personnes âgées dans les Pyrénées-Orientales.

Personne suivie : ${senior?.name}, ${senior?.age} ans, ${senior?.city}

Dernières notes (${notes.length}) :
${notes.slice(0, 5).map(n => '- ' + new Date(n.created_at).toLocaleDateString('fr-FR') + ' : ' + n.content).join('\n')}

Prochains événements :
${events.slice(0, 5).map(e => '- ' + new Date(e.scheduled_at).toLocaleDateString('fr-FR') + ' : ' + e.label + ' (' + e.status + ')').join('\n')}

Réponds de façon bienveillante et concise (3-5 phrases max). Tu peux aussi expliquer les aides disponibles (APA, MaPrimeAdapt, etc.).`

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          system: context,
          messages: [{ role: 'user', content: userMsg }]
        })
      })
      const data = await response.json()
      const reply = data.content?.[0]?.text || 'Désolé, je n\'ai pas pu répondre.'
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Erreur de connexion.' }])
    }
    setAiLoading(false)
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
                color: item.href === '/assistant' ? '#2ecc71' : '#9abaa8',
                background: item.href === '/assistant' ? 'rgba(46,204,113,0.15)' : 'none',
                fontWeight: item.href === '/assistant' ? 'bold' : 'normal',
                cursor: 'pointer', fontSize: 14
              }}>
                <span>{item.icon}</span>{item.label}
              </div>
            </Link>
          ))}
        </nav>
      </aside>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>🤖 Assistant IA</h1>
        <p style={{ color: '#888', marginBottom: 20, fontSize: 13 }}>
          Je connais la situation de {senior?.name} — posez-moi vos questions
        </p>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
              {m.role === 'assistant' && <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>🤖</div>}
              <div style={{
                maxWidth: '70%',
                padding: '12px 16px',
                borderRadius: 14,
                fontSize: 14,
                lineHeight: 1.65,
                background: m.role === 'user' ? '#12201a' : '#fff',
                color: m.role === 'user' ? '#e8f0eb' : '#333',
                boxShadow: m.role === 'assistant' ? '0 1px 4px rgba(0,0,0,0.07)' : 'none'
              }}>
                {m.text}
              </div>
            </div>
          ))}
          {aiLoading && (
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ fontSize: 22 }}>🤖</div>
              <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 14, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', color: '#2ecc71', letterSpacing: 4 }}>● ● ●</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {['Résume la semaine', 'Comment va ' + senior?.name + ' ?', 'Qu\'est-ce que l\'APA ?'].map(s => (
            <button key={s} onClick={() => setInput(s)} style={{ background: '#f0f4f0', border: '1px solid #d4e4d8', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: '#12201a' }}>
              {s}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <input
            style={{ flex: 1, border: '1px solid #ddd', borderRadius: 10, padding: '12px 16px', fontSize: 14, fontFamily: 'Georgia, serif', outline: 'none' }}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage()}
            placeholder="Posez votre question..."
          />
          <button
            onClick={sendMessage}
            disabled={aiLoading}
            style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '12px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}
          >
            Envoyer →
          </button>
        </div>
      </main>
    </div>
  )
}
