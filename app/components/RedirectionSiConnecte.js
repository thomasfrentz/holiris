'use client'
import { useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

// Filet de sécurité de la page d'accueil : si la session n'a pu être lue côté serveur
// (jeton à rafraîchir), le navigateur renvoie quand même l'utilisateur connecté vers /app
export default function RedirectionSiConnecte() {
  const router = useRouter()
  useEffect(() => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    supabase.auth.getUser().then(({ data: { user } }) => { if (user) router.replace('/app') })
  }, [router])
  return null
}
