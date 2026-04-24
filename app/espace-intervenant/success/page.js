'use client'
import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function Success() {
  useEffect(() => {
    async function refreshAndRedirect() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )
      // Rafraîchir la session
      await supabase.auth.refreshSession()
      // Attendre 1 seconde
      await new Promise(resolve => setTimeout(resolve, 1000))
      window.location.replace('/espace-intervenant')
    }
    refreshAndRedirect()
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E2820', fontFamily: 'Georgia, serif' }}>
      <div style={{ textAlign: 'center', color: '#e8f0eb' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h2 style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 28, fontWeight: 300, marginBottom: 12 }}>
          Compte activé !
        </h2>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.6)' }}>Redirection vers votre espace...</p>
      </div>
    </div>
  )
}
