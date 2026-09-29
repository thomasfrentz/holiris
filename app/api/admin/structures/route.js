import { NextResponse } from 'next/server'
import { supabaseAdmin, verifierAdmin } from '@/lib/serveur'
import { inviterGestionnaire } from '@/lib/invitations'

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Structures (admin Holiris uniquement)
export async function GET() {
  const { user, admin } = await verifierAdmin()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!admin) return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 })

  const [structures, membres, seniors] = await Promise.all([
    supabaseAdmin.from('structures').select('id, nom, created_at').order('nom'),
    supabaseAdmin.from('structure_membres').select('structure_id, nom, email, user_id'),
    supabaseAdmin.from('seniors').select('id, structure_id'),
  ])
  if (structures.error) return NextResponse.json({ error: structures.error.message }, { status: 500 })

  return NextResponse.json({
    structures: structures.data.map(s => ({
      ...s,
      gestionnaires: (membres.data || []).filter(m => m.structure_id === s.id).map(m => ({ nom: m.nom, email: m.email, compteActif: !!m.user_id })),
      nbSeniors: (seniors.data || []).filter(x => x.structure_id === s.id).length,
    })),
  })
}

// action : 'creer' (structure + invitation du responsable) | 'rattacher' (senior existant ↔ structure)
export async function POST(request) {
  try {
    const { admin } = await verifierAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Réservé à l\'admin' }, { status: 403 })
    const body = await request.json()

    if (body.action === 'creer') {
      const nom = String(body.nom || '').trim().slice(0, 120)
      const email = String(body.email || '').trim().toLowerCase()
      if (!nom || !EMAIL_VALIDE.test(email)) return NextResponse.json({ success: false, error: 'Nom de structure et email valide requis' }, { status: 400 })

      const { data: structure, error } = await supabaseAdmin.from('structures').insert({ nom }).select().single()
      if (error) throw error
      const { data: gestionnaire, error: errM } = await supabaseAdmin.from('structure_membres')
        .insert({ structure_id: structure.id, email, nom: String(body.nomResponsable || '').trim().slice(0, 80) || null })
        .select().single()
      if (errM) throw errM

      const result = await inviterGestionnaire(gestionnaire, structure.nom)
      return NextResponse.json({ success: result.success, linked: result.linked })
    }

    if (body.action === 'rattacher') {
      const { error } = await supabaseAdmin.from('seniors')
        .update({ structure_id: body.structureId || null })
        .eq('id', body.seniorId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Erreur admin structures:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
