import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const [seniorsRes, familleRes] = await Promise.all([
    supabase.from('seniors').select('*, famille(name, email, is_admin)').order('created_at', { ascending: false }),
    supabase.from('famille').select('*, seniors(name)').order('created_at', { ascending: false })
  ])

  console.log('seniors error:', JSON.stringify(seniorsRes.error))
  console.log('famille error:', JSON.stringify(familleRes.error))
  console.log('seniors count:', seniorsRes.data?.length)
  console.log('famille count:', familleRes.data?.length)

  return NextResponse.json({
    seniors: seniorsRes.data || [],
    utilisateurs: familleRes.data || [],
    debug: {
      seniorsError: seniorsRes.error,
      familleError: familleRes.error,
    }
  })
}
