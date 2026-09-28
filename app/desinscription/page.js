'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function DesinscriptionContent() {
  const [status, setStatus] = useState('confirm') // confirm | loading | desinscrit | reinscrit | error
  const searchParams = useSearchParams()
  const email = searchParams.get('email')
  const sig = searchParams.get('sig')

  async function envoyer(action) {
    setStatus('loading')
    try {
      const res = await fetch('/api/desinscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, sig, action })
      })
      const result = await res.json()
      setStatus(result.success ? (action === 'reinscrire' ? 'reinscrit' : 'desinscrit') : 'error')
    } catch { setStatus('error') }
  }

  const btnPrimary = { width: '100%', background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
  const btnLien = { background: 'none', border: 'none', color: '#9BB5AA', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', fontFamily: 'inherit', marginTop: 16 }

  let contenu
  if (!email || !sig || status === 'error') {
    contenu = (
      <>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: '#1F2A24', marginBottom: 12 }}>Lien invalide</div>
        <div style={{ fontSize: 14, color: '#9BB5AA', lineHeight: 1.6 }}>Utilisez le lien présent en bas d&apos;un email Holiris, ou écrivez-nous à contact@holiris.fr.</div>
      </>
    )
  } else if (status === 'desinscrit') {
    contenu = (
      <>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: '#4A8870', marginBottom: 12 }}>C&apos;est noté ✓</div>
        <div style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.6 }}>
          <strong>{email}</strong> ne recevra plus les emails hebdomadaires de Holiris.
          Votre accès à l&apos;espace reste inchangé.
        </div>
        <button onClick={() => envoyer('reinscrire')} style={btnLien}>Je me suis trompé(e), me réabonner</button>
      </>
    )
  } else if (status === 'reinscrit') {
    contenu = (
      <>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: '#4A8870', marginBottom: 12 }}>Réabonnement confirmé ✓</div>
        <div style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.6 }}>Vous recevrez à nouveau les emails hebdomadaires.</div>
      </>
    )
  } else {
    contenu = (
      <>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#1F2A24', marginBottom: 12 }}>Emails hebdomadaires</div>
        <div style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.6, marginBottom: 28 }}>
          Ne plus envoyer à <strong>{email}</strong> les résumés de la semaine et les rappels de Holiris ?
        </div>
        <button onClick={() => envoyer('desinscrire')} disabled={status === 'loading'} style={{ ...btnPrimary, opacity: status === 'loading' ? 0.6 : 1 }}>
          {status === 'loading' ? '...' : 'Me désinscrire'}
        </button>
      </>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', fontFamily: "'Inter', sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500&display=swap');`}</style>
      <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 440, textAlign: 'center', boxShadow: '0 4px 24px rgba(127,175,155,0.1)' }}>
        <svg width="44" height="44" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 20 }}>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.5" fill="none"/>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.5" fill="none"/>
          <circle cx="32" cy="32" r="5" fill="#7FAF9B"/>
          <circle cx="32" cy="32" r="2.2" fill="#fff"/>
        </svg>
        {contenu}
      </div>
    </div>
  )
}

export default function Desinscription() {
  return (
    <Suspense fallback={<div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>Chargement...</div>}>
      <DesinscriptionContent />
    </Suspense>
  )
}
