import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const [seniorsRes, familleRes] = await Promise.all([
    supabase.from('seniors').select('*, famille!famille_senior_id_fkey(name, email, is_admin)').order('created_at', { ascending: false }),
    supabase.from('famille').select('*, seniors!famille_senior_id_fkey(name)').order('created_at', { ascending: false })
  ])

  return NextResponse.json({
    seniors: seniorsRes.data || [],
    utilisateurs: familleRes.data || []
  })
}
