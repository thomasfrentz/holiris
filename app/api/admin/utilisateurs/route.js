import { NextResponse } from 'next/server'
import { supabaseAdmin, verifierAdmin } from '@/lib/serveur'

// Archiver, restaurer ou supprimer une fiche famille (admin Holiris uniquement)
export async function POST(request) {
  try {
    const { admin } = await verifierAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Réservé à l\'admin' }, { status: 403 })

    const { id, action } = await request.json()
    const { data: fiche } = await supabaseAdmin.from('famille').select('id, is_admin, archived_at').eq('id', id).maybeSingle()
    if (!fiche) return NextResponse.json({ success: false, error: 'Utilisateur introuvable' }, { status: 404 })

    // Un admin doit d'abord perdre son rôle : évite de retirer par erreur le dernier accès admin
    if (fiche.is_admin && action !== 'restaurer') {
      return NextResponse.json({ success: false, error: 'Retirez d\'abord le rôle admin de cet utilisateur.' }, { status: 400 })
    }

    if (action === 'archiver') {
      await supabaseAdmin.from('famille').update({ archived_at: new Date().toISOString() }).eq('id', id)
    } else if (action === 'restaurer') {
      await supabaseAdmin.from('famille').update({ archived_at: null }).eq('id', id)
    } else if (action === 'supprimer') {
      if (!fiche.archived_at) return NextResponse.json({ success: false, error: 'Archivez d\'abord cet utilisateur.' }, { status: 400 })
      const { error } = await supabaseAdmin.from('famille').delete().eq('id', id)
      if (error) throw error
    } else {
      return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur admin utilisateurs:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
