'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [isSignup, setIsSignup] = useState(false)

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  async function handleAuth() {
    setLoading(true)
    setError('')

    if (isSignup) {
      const { data, error } = await supabase.auth.signUp({ email, password })
      if (error) { setError(error.message); setLoading(false); return }

      if (data.user) {
        // Confirmer automatiquement l'email
        await fetch('/api/confirm-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.user.id })
        })

        // Connecter directement
        const { data: signInData } = await supabase.auth.signInWithPassword({ email, password })

        if (signInData?.user) {
          const { data: intervenantData } = await supabase
            .from('intervenants')
            .select('id')
            .eq('user_id', signInData.user.id)
            .limit(1)

          if (intervenantData?.length > 0) {
            router.push('/espace-intervenant')
          } else {
            router.push('/app')
          }
        }
      }
      setLoading(false)
      return
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }

    const { data: intervenantData } = await supabase
      .from('intervenants')
      .select('id')
      .eq('user_id', data.user.id)
      .limit(1)

    if (intervenantData?.length > 0) {
      router.push('/espace-intervenant')
    } else {
      router.push('/app')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E2820', fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 30% 60%, rgba(107,143,113,0.2) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 75% 35%, rgba(122,111,168,0.15) 0%, transparent 65%)' }} />

      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 4, padding: '48px 40px', width: '100%', maxWidth: 400, position: 'relative' }}>

        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 16 }}>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#9AB89F" strokeWidth="1.2" fill="none"/>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#A89FCC" strokeWidth="1.2" fill="none"/>
            <circle cx="32" cy="32" r="5" fill="#9AB89F"/>
            <circle cx="32" cy="32" r="2.2" fill="#1E2820"/>
          </svg>
          <h1 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 32, fontWeight: 300, color: '#FAFCFA', letterSpacing: '0.12em', marginBottom: 8 }}>
            Hol<span style={{ color: '#9AB89F', fontStyle: 'italic' }}>iris</span>
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
            {isSignup ? 'CRÉER UN COMPTE' : 'CONNEXION'}
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9AB89F', display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              placeholder="votre@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(107,143,113,0.3)', borderRadius: 2, color: '#FAFCFA', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>
          <div>
            <label style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9AB89F', display: 'block', marginBottom: 6 }}>Mot de passe</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAuth()}
              style={{ width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(107,143,113,0.3)', borderRadius: 2, color: '#FAFCFA', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {error && (
            <div style={{ background: 'rgba(196,122,130,0.15)', border: '1px solid rgba(196,122,130,0.3)', borderRadius: 2, padding: '10px 14px', fontSize: 13, color: '#e0939a' }}>
              {error}
            </div>
          )}

          <button
            onClick={handleAuth}
            disabled={loading || !email || !password}
            style={{ background: '#6B8F71', color: '#FAFCFA', border: 'none', borderRadius: 2, padding: '13px 0', fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', cursor: 'pointer', marginTop: 8 }}
          >
            {loading ? 'Connexion...' : isSignup ? 'Créer mon compte' : 'Se connecter'}
          </button>

          <div style={{ textAlign: 'center', marginTop: 8 }}>
            <button
              onClick={() => { setIsSignup(!isSignup); setError('') }}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline' }}
            >
              {isSignup ? 'Déjà un compte ? Se connecter' : 'Créer un compte'}
            </button>
          </div>
        </div>

        <div style={{ marginTop: 32, paddingTop: 20, borderTop: '1px solid rgba(107,143,113,0.15)', textAlign: 'center' }}>
          <a href="/" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>← Retour à l'accueil</a>
        </div>
      </div>
    </div>
  )
}
