import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { jetonDepuisInvitation, fichesDuJeton, couperAcces } from '@/lib/accesMobile'

// Borne sur téléphone d'un intervenant sans compte. Le jeton du lien sert de clé : il donne accès
// aux seniors suivis (nom seulement) et aux messages adressés à l'intervenant, jamais au reste du dossier.

async function messagesPour(ficheIds) {
  if (!ficheIds.length) return []
  const { data } = await supabaseAdmin.from('messages')
    .select('id, contenu, auteur_nom, auteur_role, destinataire_id, destinataire_nom, senior_id, created_at')
    .eq('destinataire_type', 'intervenant').in('destinataire_id', ficheIds).is('lu_borne_at', null)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .order('created_at', { ascending: true })
  return data || []
}

export async function GET(request) {
  const jeton = new URL(request.url).searchParams.get('j')
  const fiches = await fichesDuJeton(jeton)
  if (!fiches.length) return NextResponse.json({ error: 'Lien invalide' }, { status: 404 })
  return NextResponse.json({
    prenom: fiches[0].name.split(' ')[0],
    dossiers: fiches.map(f => ({ ficheId: f.id, seniorId: f.senior_id, senior: f.seniors?.name || '', nom: f.name, role: f.role })),
    messages: await messagesPour(fiches.map(f => f.id)),
  })
}

export async function POST(request) {
  try {
    const body = await request.json()

    // « Utiliser sans compte » depuis le lien d'invitation
    if (body.action === 'activer') {
      const jeton = await jetonDepuisInvitation(body.invitation)
      if (!jeton) return NextResponse.json({ success: false, error: 'Ce lien n\'est plus valide.' }, { status: 404 })
      return NextResponse.json({ success: true, jeton })
    }

    // « Lu » sur un message adressé à l'intervenant
    if (body.action === 'lu') {
      const fiches = await fichesDuJeton(body.jeton)
      if (!fiches.length) return NextResponse.json({ success: false }, { status: 404 })
      await supabaseAdmin.from('messages').update({ lu_borne_at: new Date().toISOString() })
        .eq('id', body.id).in('destinataire_id', fiches.map(f => f.id)).is('lu_borne_at', null)
      return NextResponse.json({ success: true })
    }

    // Téléphone perdu ou intervenant parti : couper l'accès (page Intervenants)
    if (body.action === 'couper') {
      const user = await utilisateurCourant()
      if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
      const { data: fiche } = await supabaseAdmin.from('intervenants').select('senior_id').eq('id', body.id).maybeSingle()
      if (!fiche) return NextResponse.json({ success: false, error: 'Fiche introuvable' }, { status: 404 })
      const { data: acces } = await supabaseAdmin.from('famille').select('id')
        .eq('user_id', user.id).eq('senior_id', fiche.senior_id).is('archived_at', null).limit(1)
      if (!acces?.length && !await peutGererSenior(user.id, fiche.senior_id)) {
        return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
      }
      await couperAcces(body.id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Erreur ma-borne:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
