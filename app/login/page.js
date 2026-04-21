'use client'
import { useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const handleSubmit = async () => {
    setLoading(true)
    setError('')

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) {
        setError('Email ou mot de passe incorrect')
      } else {
        window.location.href = '/'
      }
    } else {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) {
        setError(error.message)
      } else {
        setError('Compte créé ! Vous pouvez vous connecter.')
        setMode('login')
      }
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#12201a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 380, textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, background: '#2ecc71', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 22, color: '#12201a', margin: '0 auto 20px' }}>H</div>
        <h1 style={{ fontSize: 24, fontWeight: 'bold', color: '#12201a', marginBottom: 8 }}>Holiris</h1>
        <p style={{ color: '#888', fontSize: 14, marginBottom: 28 }}>
          {mode === 'login' ? 'Connectez-vous pour suivre votre proche' : 'Créez votre compte Holiris'}
        </p>

        <input
          type="email"
          placeholder="Votre email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          style={{ width: '100%', padding: '12px 16px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box', marginBottom: 10 }}
        />
        <input
          type="password"
          placeholder="Votre mot de passe"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          style={{ width: '100%', padding: '12px 16px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, fontFamily: 'Georgia, serif', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }}
        />

        {error && (
          <div style={{ background: error.includes('créé') ? '#eafaf1' : '#fdf0f0', color: error.includes('créé') ? '#27ae60' : '#e74c3c', borderRadius: 8, padding: '8px 12px', fontSize: 13, marginBottom: 12 }}>
            {error}
          </div>
        )}

        <button
          onClick={handleSubmit}
          disabled={loading || !email || !password}
          style={{ width: '100%', background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 15, fontWeight: 'bold', cursor: 'pointer', marginBottom: 12 }}
        >
          {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer mon compte'}
        </button>

        <div
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          style={{ fontSize: 13, color: '#888', cursor: 'pointer' }}
        >
          {mode === 'login' ? "Pas encore de compte ? Créer un compte" : "Déjà un compte ? Se connecter"}
        </div>
      </div>
    </div>
  )
}
