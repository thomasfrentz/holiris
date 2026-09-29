import { NextResponse } from 'next/server'
import { supabaseAdmin, verifierAdmin } from '@/lib/serveur'

export const runtime = 'nodejs'

// Données de la page Admin (admin connecté uniquement)
export async function GET() {
  const { user, admin } = await verifierAdmin()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!admin) return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 })

  const [seniorsRes, familleRes] = await Promise.all([
    supabaseAdmin.from('seniors').select('*, famille!famille_senior_id_fkey(name, email, is_admin)').order('created_at', { ascending: false }),
    supabaseAdmin.from('famille').select('*, seniors!famille_senior_id_fkey(name)').order('created_at', { ascending: false })
  ])

  return NextResponse.json({
    seniors: seniorsRes.data || [],
    utilisateurs: familleRes.data || []
  })
}
