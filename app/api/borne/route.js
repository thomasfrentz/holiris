import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/serveur'

// Chargement d'une borne par son code (la borne n'a pas de compte connecté).
// Le code de la borne sert de clé : il ne donne accès qu'au nom du senior et à la liste des personnes.
export async function GET(request) {
  const code = new URL(request.url).searchParams.get('code')?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'Code manquant' }, { status: 400 })

  const { data: borne } = await supabaseAdmin.from('bornes')
    .select('id, code, senior_id, seniors(name)').eq('code', code).maybeSingle()
  if (!borne) return NextResponse.json({ error: 'Code borne invalide' }, { status: 404 })

  const [{ data: intervenants }, { data: famille }] = await Promise.all([
    supabaseAdmin.from('intervenants').select('id, name, role').eq('senior_id', borne.senior_id).is('archived_at', null).order('name'),
    supabaseAdmin.from('famille').select('id, name, role').eq('senior_id', borne.senior_id).is('archived_at', null).order('name'),
  ])

  const personnes = [
    ...(intervenants || []).map(p => ({ ...p, type: 'intervenant' })),
    ...(famille || []).map(p => ({ ...p, type: 'famille' })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ borne, personnes })
}
