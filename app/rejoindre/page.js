'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function RejoindreContent() {
  const [status, setStatus] = useState('loading')
  const [membre, setMembre] = useState(null)
  const [senior, setSenior] = useState(null)
  const [type, setType] = useState(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const typeParam = searchParams.get('type') // 'famille' ou 'intervenant'
  const emailParam = searchParams.get('email')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function checkToken() {
      if (!token) { setStatus('invalid'); return }

      setType(typeParam === 'famille' ? 'famille' : 'intervenant')

      // Lecture de l'invitation par le serveur (les fiches ne sont pas lisibles sans connexion)
      const res = await fetch('/api/rejoindre?token=' + encodeURIComponent(token) + '&type=' + (typeParam || 'intervenant'))
      if (!res.ok) { setStatus('invalid'); return }
      const data = await res.json()

      setMembre(data.membre)
      setSenior(data.senior)
      setStatus('valid')
    }
    checkToken()
  }, [token, typeParam])

  async function activer() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      const email = emailParam || membre?.email || ''
      const redirect = '/rejoindre?token=' + token + (typeParam ? '&type=' + typeParam : '')
      const typeInvit = typeParam === 'famille' ? 'famille' : 'intervenant'
      router.push(`/login?signup=true&type=${typeInvit}&jeton=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirect)}`)
      return
    }

    // Activation par le serveur : rattache ce dossier et les autres invitations du même email
    const res = await fetch('/api/rejoindre', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, type: typeParam || 'intervenant' })
    })
    const result = await res.json()
    if (!result.success) { alert(result.error || 'Activation impossible.'); return }

    setStatus('success')
    setTimeout(() => router.push(typeParam === 'famille' ? '/app' : '/espace-intervenant'), 2000)
  }

  if (status === 'loading') return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', fontFamily: "'Inter', sans-serif" }}>
      <div style={{ color: '#9BB5AA' }}>Vérification...</div>
    </div>
  )

  if (status === 'invalid') return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500&display=swap');`}</style>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#1F2A24', marginBottom: 12 }}>Lien déjà utilisé</div>
        <div style={{ fontSize: 14, color: '#9BB5AA', marginBottom: 24, maxWidth: 360 }}>Votre accès est sans doute déjà activé : connectez-vous avec votre email et votre mot de passe.</div>
        <a href="/login" style={{ display: 'inline-block', background: '#7FAF9B', color: '#fff', borderRadius: 8, padding: '12px 28px', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>Se connecter</a>
      </div>
    </div>
  )

  if (status === 'success') return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500&display=swap');`}</style>
      <div style={{ textAlign: 'center', padding: 32 }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, color: '#4A8870', marginBottom: 12 }}>Compte activé ✓</div>
        <div style={{ fontSize: 14, color: '#9BB5AA' }}>Redirection vers votre espace...</div>
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', fontFamily: "'Inter', sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500&display=swap');`}</style>
      <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 440, textAlign: 'center', boxShadow: '0 4px 24px rgba(127,175,155,0.1)' }}>
        <svg width="44" height="44" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 20 }}>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.5" fill="none"/>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.5" fill="none"/>
          <circle cx="32" cy="32" r="5" fill="#7FAF9B"/>
          <circle cx="32" cy="32" r="2.2" fill="#fff"/>
        </svg>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#1F2A24', marginBottom: 6 }}>Holiris</div>
        <div style={{ fontSize: 13, color: '#9BB5AA', marginBottom: 28 }}>
          {type === 'famille' ? 'Invitation proche' : 'Invitation intervenant'}
        </div>

        <div style={{ background: '#EAF4EF', border: '1px solid #C8DDD4', borderRadius: 10, padding: '16px 20px', marginBottom: 24, textAlign: 'left' }}>
          <div style={{ fontSize: 10, color: '#7FAF9B', fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Dossier</div>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1F2A24' }}>{senior?.name}</div>
          <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 4 }}>{senior?.age} ans · {senior?.city}</div>
        </div>

        {membre?.name && (
          <div style={{ fontSize: 14, color: '#6F7C75', marginBottom: 24 }}>
            Invitation pour <strong>{membre.name}</strong>
            {membre.role && <span> · {membre.role}</span>}
          </div>
        )}

        <button onClick={activer}
          style={{ width: '100%', background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          Activer mon accès →
        </button>

        <div style={{ fontSize: 11, color: '#C8DDD4', marginTop: 16 }}>
          Pas encore de compte ? Vous serez invité(e) à le créer, puis votre accès sera activé.
        </div>
      </div>
    </div>
  )
}

export default function Rejoindre() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>}>
      <RejoindreContent />
    </Suspense>
  )
}
