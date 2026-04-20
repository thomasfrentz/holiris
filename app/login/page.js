'use client'
import { useState } from 'react'
import { createClient } from '../../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  const handleLogin = async () => {
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({ 
      email,
      options: {
        emailRedirectTo: 'http://localhost:3000/auth/callback'
      }
    })
    if (!error) setSent(true)
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#12201a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 380, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: '#2ecc71', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#12201a', margin: '0 auto 20px' }}>H</div>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#12201a', marginBottom: 8 }}>Holiris</h1>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 28 }}>Connectez-vous pour suivre votre proche</p>

        {!sent ? (
          <>
            <input
              type="email"
              placeholder="Votre email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={{ width: '100%', padding: '12px 16px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
            />
            <button
              onClick={handleLogin}
              disabled={loading || !email}
              style={{ width: '100%', background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}
            >
              {loading ? 'Envoi...' : 'Recevoir le lien de connexion'}
            </button>
          </>
        ) : (
          <div style={{ background: '#eafaf1', borderRadius: 10, padding: 20, color: '#27ae60' }}>
            <div style={{ fontSize: 32, marginBottom: 10 }}>📧</div>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Lien envoyé !</div>
            <div style={{ fontSize: 13 }}>Vérifiez votre boîte email et cliquez sur le lien pour vous connecter.</div>
          </div>
        )}
      </div>
    </div>
  )
}