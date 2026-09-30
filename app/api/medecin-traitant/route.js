import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'

// Désignation du médecin traitant d'un senior : par ses proches, sa structure ou l'admin
export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    const { seniorId, intervenantId } = await request.json()
    if (!seniorId) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })

    const { data: proche } = await supabaseAdmin.from('famille').select('id')
      .eq('user_id', user.id).eq('senior_id', seniorId).is('archived_at', null).limit(1)
    if (!proche?.length && !await peutGererSenior(user.id, seniorId)) {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
    }

    // intervenantId null = retirer la désignation
    if (intervenantId) {
      const { data: medecin } = await supabaseAdmin.from('intervenants')
        .select('senior_id, email, archived_at').eq('id', intervenantId).maybeSingle()
      if (!medecin || medecin.senior_id !== seniorId || medecin.archived_at) {
        return NextResponse.json({ success: false, error: 'Cet intervenant ne suit pas ce senior' }, { status: 400 })
      }
      if (!medecin.email) {
        return NextResponse.json({ success: false, error: 'Ajoutez d\'abord l\'email du médecin : le compte rendu lui est envoyé par email.' }, { status: 400 })
      }
    }

    const { error } = await supabaseAdmin.from('seniors').update({ medecin_traitant_id: intervenantId || null }).eq('id', seniorId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur médecin traitant:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
