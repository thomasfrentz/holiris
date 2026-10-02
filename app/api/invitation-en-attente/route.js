import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/serveur'
import { trouverCompte } from '@/lib/invitations'

// Page de connexion : l'adresse a-t-elle une invitation en attente sans compte créé ?
// (pour afficher « créez votre compte depuis l'email » plutôt que « mot de passe incorrect »)
export async function POST(request) {
  try {
    const { email } = await request.json()
    const adresse = String(email || '').trim().toLowerCase()
    if (!adresse.includes('@')) return NextResponse.json({ enAttente: false })

    const lignes = await Promise.all(['famille', 'intervenants'].map(table =>
      supabaseAdmin.from(table).select('id').ilike('email', adresse)
        .is('user_id', null).is('archived_at', null).not('invite_token', 'is', null).limit(1)))
    const invite = lignes.some(({ data }) => data?.length)
    return NextResponse.json({ enAttente: invite && !await trouverCompte(adresse) })
  } catch {
    return NextResponse.json({ enAttente: false })
  }
}
