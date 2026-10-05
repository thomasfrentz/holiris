import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant } from '@/lib/serveur'

// Invitation par lien (page /rejoindre) : lecture avant connexion, puis activation par le compte connecté.
// Passe par le serveur : les tables famille et intervenants ne sont pas lisibles sans connexion.

function tableDe(type) {
  return type === 'famille'
    ? { table: 'famille', fkey: 'famille_senior_id_fkey' }
    : { table: 'intervenants', fkey: 'intervenants_senior_id_fkey' }
}

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Lien invalide' }, { status: 400 })

  const { table, fkey } = tableDe(searchParams.get('type'))
  const { data } = await supabaseAdmin.from(table)
    .select(`name, role, email, seniors!${fkey}(name, age, city, date_naissance)`)
    .eq('invite_token', token).is('archived_at', null).maybeSingle()
  if (!data) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 })

  return NextResponse.json({ membre: { name: data.name, role: data.role, email: data.email }, senior: data.seniors })
}

export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    const { token, type } = await request.json()
    const { table } = tableDe(type)
    const { data: ligne } = await supabaseAdmin.from(table)
      .select('id, email').eq('invite_token', token).is('archived_at', null).maybeSingle()
    if (!ligne) return NextResponse.json({ success: false, error: 'Ce lien n\'est plus valide.' }, { status: 404 })

    // L'invitation est nominative : elle s'active avec le compte de l'adresse invitée
    if (ligne.email && ligne.email.toLowerCase() !== user.email?.toLowerCase()) {
      return NextResponse.json({ success: false, error: 'Cette invitation a été envoyée à ' + ligne.email + ' : connectez-vous avec cette adresse.' }, { status: 403 })
    }

    await supabaseAdmin.from(table).update({ user_id: user.id, invite_token: null, ...(ligne.email ? {} : { email: user.email?.toLowerCase() }) }).eq('id', ligne.id)
    // Rattacher aussi les autres seniors en attente pour ce même email
    if (ligne.email) {
      await supabaseAdmin.from(table).update({ user_id: user.id, invite_token: null })
        .ilike('email', ligne.email).is('user_id', null)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur rejoindre:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
