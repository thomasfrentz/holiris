'use client'
import { useEffect, useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Landing from './landing/page'

export default function Home() {
  const [checking, setChecking] = useState(true)
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push('/app')
      } else {
        setChecking(false)
      }
    }
    checkAuth()
  }, [])

  if (checking) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#1E2820' }}>
      <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
        <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#9AB89F" strokeWidth="1.2" fill="none"/>
        <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#A89FCC" strokeWidth="1.2" fill="none"/>
        <circle cx="32" cy="32" r="5" fill="#9AB89F"/>
        <circle cx="32" cy="32" r="2.2" fill="#1E2820"/>
      </svg>
    </div>
  )

  return <Landing />
}