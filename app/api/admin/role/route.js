import { NextResponse } from 'next/server'
import { supabaseAdmin, verifierAdmin, lignesFamille } from '@/lib/serveur'

// Donner ou retirer le rôle admin à un membre (admin connecté uniquement)
export async function POST(request) {
  try {
    const { user, admin } = await verifierAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Réservé à l\'admin' }, { status: 403 })

    const { familleId, isAdmin } = await request.json()
    if (!familleId) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })

    if (!isAdmin) {
      // Ne pas retirer le dernier accès admin, ni son propre accès
      const { data: admins } = await supabaseAdmin.from('famille').select('id, user_id').eq('is_admin', true)
      const restants = (admins || []).filter(a => a.id !== familleId)
      if (!restants.length) return NextResponse.json({ success: false, error: 'Il doit rester au moins un admin.' }, { status: 400 })
      const mesLignes = (await lignesFamille(user.id)).map(l => l.id)
      if (mesLignes.includes(familleId) && !restants.some(a => a.user_id === user.id)) {
        return NextResponse.json({ success: false, error: 'Vous ne pouvez pas retirer votre propre accès admin.' }, { status: 400 })
      }
    }

    const { error } = await supabaseAdmin.from('famille').update({ is_admin: !!isAdmin }).eq('id', familleId)
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur rôle admin:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
