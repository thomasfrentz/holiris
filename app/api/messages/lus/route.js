import { NextResponse } from 'next/server'
import { supabaseAdmin, clientUtilisateur } from '@/lib/serveur'

// Accusés de lecture : les messages affichés à l'écran sont marqués lus par l'utilisateur connecté.
// Seuls les messages qu'il a le droit de lire (règles d'accès), et dont il n'est pas l'auteur, sont retenus ;
// la première lecture est conservée.
export async function POST(request) {
  try {
    const supabase = await clientUtilisateur()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ success: false }, { status: 401 })

    const { ids } = await request.json()
    const demandes = (Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string').slice(0, 300)
    if (!demandes.length) return NextResponse.json({ success: true, lus: 0 })

    const { data: visibles } = await supabase.from('messages').select('id').in('id', demandes).neq('auteur_user_id', user.id)
    if (!visibles?.length) return NextResponse.json({ success: true, lus: 0 })

    const { error } = await supabaseAdmin.from('messages_lus')
      .upsert(visibles.map(m => ({ message_id: m.id, user_id: user.id })), { onConflict: 'message_id,user_id', ignoreDuplicates: true })
    if (error) throw error
    return NextResponse.json({ success: true, lus: visibles.length })
  } catch (error) {
    console.error('Erreur accusés de lecture:', error.message)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
