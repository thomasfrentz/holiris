import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { creerPassages, passagesDe, passagesDuGroupe } from '@/lib/passagesReguliers'

// Proposition de passages réguliers envoyée par Holiris : lue et acceptée ou refusée par son destinataire,
// l'intervenant lui-même ou, pour un groupe du même métier, l'un des proches (ou la structure) du senior
async function propositionDe(id, user) {
  if (!id || !user) return null
  const { data: p } = await supabaseAdmin.from('propositions_passages')
    .select('*, intervenants(id, name, role, user_id, archived_at)').eq('id', id).maybeSingle()
  if (!p) return null
  if (p.intervenant_id) return p.intervenants?.user_id === user.id ? p : null
  const { data: proche } = await supabaseAdmin.from('famille').select('id')
    .eq('user_id', user.id).eq('senior_id', p.senior_id).is('archived_at', null).limit(1)
  return proche?.length || await peutGererSenior(user.id, p.senior_id) ? p : null
}

const reponse = p => ({ statut: p.statut, passagesCrees: p.passages_crees, jours: p.jours, heure: p.heure, reponduAt: p.repondu_at, groupe: !p.intervenant_id })

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
    if (p.intervenants?.archived_at) return NextResponse.json({ success: false, error: 'Vous ne suivez plus ce dossier.' }, { status: 403 })

    // Jours et heure modifiés par l'intervenant quand la proposition ne lui convient pas
    const choix = {}
    if (body.accepter && (body.jours !== undefined || body.heure !== undefined)) {
      const jours = [...new Set((Array.isArray(body.jours) ? body.jours : []).map(String))].filter(j => /^[0-6]$/.test(j)).sort()
      const heure = String(body.heure || '')
      if (!jours.length || !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) {
        return NextResponse.json({ success: false, error: 'Choisissez au moins un jour et une heure.' }, { status: 400 })
      }
      Object.assign(choix, { jours: jours.join(','), heure })
    }

    // La réponse est enregistrée avant la création, pour qu'un second clic ne crée pas les passages deux fois
    const { data: prise } = await supabaseAdmin.from('propositions_passages')
      .update({ statut: body.accepter ? 'acceptee' : 'refusee', repondu_at: new Date().toISOString(), ...choix })
      .eq('id', p.id).eq('statut', 'proposee').select().maybeSingle()
    if (!prise) return NextResponse.json({ success: true, ...reponse(p) })
    if (!body.accepter) return NextResponse.json({ success: true, ...reponse(prise) })

    try {
      const nombre = await creerPassages(prise, p.intervenant_id ? passagesDe(p.intervenants) : passagesDuGroupe(prise))
      const { data: finale } = await supabaseAdmin.from('propositions_passages').update({ passages_crees: nombre }).eq('id', p.id).select().single()
      return NextResponse.json({ success: true, ...reponse(finale) })
    } catch (e) {
      // Création impossible : la proposition redevient acceptable, avec ses jours et son heure d'origine
      await supabaseAdmin.from('propositions_passages').update({ statut: 'proposee', repondu_at: null, jours: p.jours, heure: p.heure }).eq('id', p.id)
      throw e
    }
  } catch (error) {
    console.error('Erreur proposition de passages:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
