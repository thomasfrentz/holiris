import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'

// Désignation de la personne de confiance d'un senior (admin uniquement)
export async function POST(request) {
  try {
    const { seniorId, familleId } = await request.json()
    if (!seniorId) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })

    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    if (!await peutGererSenior(user.id, seniorId)) return NextResponse.json({ success: false, error: 'Réservé à l\'admin ou à la structure' }, { status: 403 })

    // familleId null = retirer la désignation
    if (familleId) {
      const { data: membre } = await supabaseAdmin.from('famille')
        .select('senior_id, user_id, archived_at').eq('id', familleId).single()
      if (!membre || membre.senior_id !== seniorId || membre.archived_at) {
        return NextResponse.json({ success: false, error: 'Ce proche ne suit pas ce senior' }, { status: 400 })
      }
      if (!membre.user_id) {
        return NextResponse.json({ success: false, error: 'Ce proche doit d\'abord avoir créé son compte' }, { status: 400 })
      }
    }

    const { error } = await supabaseAdmin.from('seniors')
      .update({ personne_confiance_id: familleId || null })
      .eq('id', seniorId)
    if (error) throw error

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur personne de confiance:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
