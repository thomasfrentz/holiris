'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function OnboardingIntervenant() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  async function linkAccount() {
    if (!code.trim()) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: intervenantData } = await supabase
      .from('intervenants')
      .select('*')
      .eq('code_acces', code.trim())
      .limit(1)

    if (!intervenantData?.length) {
      setError('Code invalide. Vérifiez votre email d\'invitation.')
      setLoading(false)
      return
    }

    const intervenant = intervenantData[0]

    if (intervenant.user_id && intervenant.user_id !== user.id) {
      setError('Ce code a déjà été utilisé.')
      setLoading(false)
      return
    }

    // Lier ce row
    const { error: updateError } = await supabase
      .from('intervenants')
      .update({ user_id: user.id })
      .eq('id', intervenant.id)

    if (updateError) {
      setError('Erreur lors de l\'activation. Réessayez.')
      setLoading(false)
      return
    }

    // Synchroniser tous les rows du même email sur le même user_id
    if (intervenant.email) {
      await supabase
        .from('intervenants')
        .update({ user_id: user.id })
        .eq('email', intervenant.email)
    }

    window.location.href = '/espace-intervenant/success'
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E2820', fontFamily: 'var(--font-body, DM Sans, sans-serif)' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 30% 60%, rgba(107,143,113,0.2) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 75% 35%, rgba(122,111,168,0.15) 0%, transparent 65%)' }} />

      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 4, padding: '48px 40px', width: '100%', maxWidth: 420, position: 'relative' }}>

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
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>ACTIVATION DE VOTRE COMPTE</p>
        </div>

        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, marginBottom: 28, textAlign: 'center' }}>
          Entrez le code d'accès reçu par email pour activer votre espace intervenant.
        </p>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9AB89F', display: 'block', marginBottom: 8 }}>Code d'accès</label>
          <input
            placeholder="Collez votre code ici"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && linkAccount()}
            style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(107,143,113,0.3)', borderRadius: 2, color: '#FAFCFA', fontSize: 16, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.2em', textAlign: 'center' }}
          />
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 6, textAlign: 'center' }}>
            Copiez-collez le code depuis votre email
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(196,122,130,0.15)', border: '1px solid rgba(196,122,130,0.3)', borderRadius: 2, padding: '10px 14px', fontSize: 13, color: '#e0939a', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button onClick={linkAccount} disabled={loading || !code.trim()}
          style={{ width: '100%', background: '#6B8F71', color: '#FAFCFA', border: 'none', borderRadius: 2, padding: '13px 0', fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', cursor: 'pointer' }}>
          {loading ? 'Activation en cours...' : 'Activer mon compte'}
        </button>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a href="/login" style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textDecoration: 'none' }}>← Retour à la connexion</a>
        </div>
      </div>
    </div>
  )
}