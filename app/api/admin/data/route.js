import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET() {
  const [seniorsRes, familleRes] = await Promise.all([
    supabase.from('seniors').select('*, famille(name, email, is_admin)').order('created_at', { ascending: false }),
    supabase.from('famille').select('*, seniors(name)').order('created_at', { ascending: false })
  ])

  return NextResponse.json({
    seniors: seniorsRes.data || [],
    utilisateurs: familleRes.data || []
  })
}
