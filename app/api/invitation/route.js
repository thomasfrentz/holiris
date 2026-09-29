import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { inviterMembre } from '@/lib/invitations'

export async function POST(request) {
  try {
    const { type, id } = await request.json()
    const table = type === 'famille' ? 'famille' : type === 'intervenant' ? 'intervenants' : null
    if (!table || !id) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })

    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    const fkey = type === 'famille' ? 'famille_senior_id_fkey' : 'intervenants_senior_id_fkey'
    const { data: membre } = await supabaseAdmin
      .from(table).select(`*, seniors!${fkey}(name)`)
      .eq('id', id).single()
    if (!membre) return NextResponse.json({ success: false, error: 'Membre introuvable' }, { status: 404 })
    if (!membre.email) return NextResponse.json({ success: false, error: 'Aucun email renseigné' }, { status: 400 })

    // L'invitant doit suivre ce senior, ou pouvoir le gérer (admin, gestionnaire de sa structure)
    const { data: acces } = await supabaseAdmin
      .from('famille').select('senior_id')
      .eq('user_id', user.id).is('archived_at', null)
    const autorise = (acces || []).some(f => f.senior_id === membre.senior_id)
      || await peutGererSenior(user.id, membre.senior_id)
    if (!autorise) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })

    const result = await inviterMembre({ table, type, membre })
    return NextResponse.json({ success: result.success, linked: result.linked, error: result.error })
  } catch (error) {
    console.error('Erreur invitation:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
