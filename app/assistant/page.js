'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'

export default function Assistant() {
  const [notes, setNotes] = useState([])
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([
    { role: 'assistant', text: 'Bonjour ! Je suis l\'assistant IA Holiris. Je connais toute la situation de votre proche et peux répondre à vos questions, résumer la semaine, ou vous conseiller sur les aides disponibles.' }
  ])
  const [input, setInput] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const chatEndRef = useRef(null)
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
      if (!selectedSeniorId) return

      const { data: notesData } = await supabase
        .from('notes').select('*')
        .eq('senior_id', selectedSeniorId)
        .order('created_at', { ascending: false }).limit(10)
      setNotes(notesData || [])

      const { data: eventsData } = await supabase
        .from('events').select('*, intervenants(*)')
        .eq('senior_id', selectedSeniorId)
        .order('scheduled_at', { ascending: false }).limit(10)
      setEvents(eventsData || [])

      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function sendMessage() {
    if (!input.trim() || aiLoading) return
    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: userMsg }])
    setAiLoading(true)

    const context = 'Tu es l\'assistant IA de Holiris, plateforme de suivi des personnes âgées dans les Pyrénées-Orientales.\n\nPersonne suivie : ' + (selectedSenior?.name || '') + ', ' + (selectedSenior?.age || '') + ' ans, ' + (selectedSenior?.city || '') + '\n\nDernières notes :\n' + notes.slice(0, 5).map(n => '- ' + new Date(n.created_at).toLocaleDateString('fr-FR') + ' : ' + n.content).join('\n') + '\n\nProchains événements :\n' + events.slice(0, 5).map(e => '- ' + new Date(e.scheduled_at).toLocaleDateString('fr-FR') + ' : ' + e.label).join('\n') + '\n\nRéponds de façon bienveillante et concise (3-5 phrases max).'

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, messages: [{ role: 'user', content: userMsg }] })
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', text: data.text }])
    } catch (e) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Erreur de connexion.' }])
    }
    setAiLoading(false)
  }

  if (loading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Chargement...</div>
    </div>
  )

  return (
    <Layout senior={selectedSenior} seniors={seniors} selectedSeniorId={selectedSeniorId} switchSenior={switchSenior} isAdmin={isAdmin}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>🤖 Assistant IA</h1>
        <p style={{ color: '#888', marginBottom: 20, fontSize: 13 }}>
          Je connais la situation de {selectedSenior?.name} — posez-moi vos questions
        </p>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', gap: 8 }}>
              {m.role === 'assistant' && <div style={{ fontSize: 22, flexShrink: 0, marginTop: 2 }}>🤖</div>}
              <div style={{
                maxWidth: '70%', padding: '12px 16px', borderRadius: 14, fontSize: 14, lineHeight: 1.65,
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
              <div style={{ background: '#fff', padding: '12px 16px', borderRadius: 14, color: '#2ecc71', letterSpacing: 4 }}>● ● ●</div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <div style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          {['Résume la semaine', 'Comment va ' + (selectedSenior?.name || 'mon proche') + ' ?', 'Qu\'est-ce que l\'APA ?'].map(s => (
            <button key={s} onClick={() => setInput(s)}
              style={{ background: '#f0f4f0', border: '1px solid #d4e4d8', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 12, color: '#12201a' }}>
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
          <button onClick={sendMessage} disabled={aiLoading}
            style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '12px 20px', cursor: 'pointer', fontWeight: 'bold', fontSize: 14 }}>
            →
          </button>
        </div>
      </div>
    </Layout>
  )
}
