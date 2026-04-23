import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export function useAdmin() {
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function checkAdmin() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      )

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data } = await supabase
        .from('famille')
        .select('is_admin')
        .eq('user_id', user.id)
        .limit(1)

      setIsAdmin(data?.[0]?.is_admin === true)
      setLoading(false)
    }
    checkAdmin()
  }, [])

  return { isAdmin, loading }
}
