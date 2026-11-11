import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant } from '@/lib/serveur'
import { creerPassages } from '@/lib/passagesReguliers'

// Proposition de passages réguliers envoyée par Holiris : lue et acceptée ou refusée par son seul destinataire
async function propositionDe(id, user) {
  if (!id || !user) return null
  const { data: p } = await supabaseAdmin.from('propositions_passages')
    .select('*, intervenants(id, name, role, user_id, archived_at)').eq('id', id).maybeSingle()
  return p && p.intervenants?.user_id === user.id ? p : null
}

const reponse = p => ({ statut: p.statut, passagesCrees: p.passages_crees, jours: p.jours, heure: p.heure, reponduAt: p.repondu_at })

export async function GET(request) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const p = await propositionDe(new URL(request.url).searchParams.get('id'), user)
  if (!p) return NextResponse.json({ error: 'Proposition introuvable' }, { status: 404 })
  return NextResponse.json(reponse(p))
}

export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    const body = await request.json()
    const p = await propositionDe(body.id, user)
    if (!p) return NextResponse.json({ success: false, error: 'Proposition introuvable' }, { status: 404 })
    if (p.statut !== 'proposee') return NextResponse.json({ success: true, ...reponse(p) }) // déjà répondu (double clic, autre appareil)
    if (p.intervenants.archived_at) return NextResponse.json({ success: false, error: 'Vous ne suivez plus ce dossier.' }, { status: 403 })

    // La réponse est enregistrée avant la création, pour qu'un second clic ne crée pas les passages deux fois
    const { data: prise } = await supabaseAdmin.from('propositions_passages')
      .update({ statut: body.accepter ? 'acceptee' : 'refusee', repondu_at: new Date().toISOString() })
      .eq('id', p.id).eq('statut', 'proposee').select().maybeSingle()
    if (!prise) return NextResponse.json({ success: true, ...reponse(p) })
    if (!body.accepter) return NextResponse.json({ success: true, ...reponse(prise) })

    try {
      const nombre = await creerPassages(prise, p.intervenants)
      const { data: finale } = await supabaseAdmin.from('propositions_passages').update({ passages_crees: nombre }).eq('id', p.id).select().single()
      return NextResponse.json({ success: true, ...reponse(finale) })
    } catch (e) {
      // Création impossible : la proposition redevient acceptable
      await supabaseAdmin.from('propositions_passages').update({ statut: 'proposee', repondu_at: null }).eq('id', p.id)
      throw e
    }
  } catch (error) {
    console.error('Erreur proposition de passages:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
