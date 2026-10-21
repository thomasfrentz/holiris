import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/serveur'

// Messages adressés à un intervenant par la famille ou la structure, affichés sur la borne le jour de son
// rendez-vous (dès 0 h, heure de Paris) jusqu'à ce qu'il les lise (sur la borne, son téléphone ou le site).
// Les messages entre intervenants restent privés : jamais sur la borne. Le code de la borne sert de clé.

const jourParis = d => new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris' }).format(new Date(d))

async function borneParCode(code) {
  const { data } = await supabaseAdmin.from('bornes').select('senior_id')
    .eq('code', String(code || '').trim().toUpperCase()).maybeSingle()
  return data
}

export async function GET(request) {
  const borne = await borneParCode(new URL(request.url).searchParams.get('code'))
  if (!borne) return NextResponse.json({ error: 'Code borne invalide' }, { status: 404 })

  const { data: tous } = await supabaseAdmin.from('messages')
    .select('id, contenu, auteur_nom, auteur_role, auteur_type, auteur_user_id, destinataire_id, destinataire_nom, created_at')
    .eq('senior_id', borne.senior_id).eq('destinataire_type', 'intervenant').is('lu_borne_at', null).is('groupe_id', null)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .order('created_at', { ascending: true })
  if (!tous?.length) return NextResponse.json({ messages: [] })

  // Auteur intervenant : type enregistré, ou, pour les messages plus anciens, compte d'un intervenant
  const sansType = [...new Set(tous.filter(m => !m.auteur_type).map(m => m.auteur_user_id))]
  const { data: comptesIntervenants } = sansType.length
    ? await supabaseAdmin.from('intervenants').select('user_id').in('user_id', sansType)
    : { data: [] }
  const auteursIntervenants = new Set((comptesIntervenants || []).map(c => c.user_id))
  const messages = tous.filter(m => m.auteur_type ? m.auteur_type !== 'intervenant' : !auteursIntervenants.has(m.auteur_user_id))
  if (!messages.length) return NextResponse.json({ messages: [] })

  // Rendez-vous d'aujourd'hui avec ces intervenants
  const aujourdhui = jourParis(Date.now())
  const ids = [...new Set(messages.map(m => m.destinataire_id))]
  const { data: rdv } = await supabaseAdmin.from('events').select('intervenant_id, intervenant_ids, scheduled_at')
    .eq('senior_id', borne.senior_id)
    .gte('scheduled_at', new Date(Date.now() - 36 * 3600 * 1000).toISOString())
    .lte('scheduled_at', new Date(Date.now() + 36 * 3600 * 1000).toISOString())
  // Tous les intervenants du rendez-vous, pas seulement le premier
  const venusAujourdhui = new Set((rdv || []).filter(e => jourParis(e.scheduled_at) === aujourdhui)
    .flatMap(e => e.intervenant_ids?.length ? e.intervenant_ids : [e.intervenant_id]).filter(id => ids.includes(id)))

  // Déjà lus par l'intervenant depuis son compte (fil ouvert après le message)
  const { data: fiches } = await supabaseAdmin.from('intervenants').select('id, user_id').in('id', ids)
  const comptes = Object.fromEntries((fiches || []).filter(f => f.user_id).map(f => [f.id, f.user_id]))
  const { data: lectures } = Object.keys(comptes).length
    ? await supabaseAdmin.from('messages_lectures').select('user_id, lu_jusqu_a').eq('senior_id', borne.senior_id).in('user_id', Object.values(comptes))
    : { data: [] }
  const luJusqua = Object.fromEntries((lectures || []).map(l => [l.user_id, new Date(l.lu_jusqu_a).getTime()]))

  const aAfficher = messages.filter(m => venusAujourdhui.has(m.destinataire_id)
    && !(comptes[m.destinataire_id] && luJusqua[comptes[m.destinataire_id]] >= new Date(m.created_at).getTime()))
  return NextResponse.json({ messages: aAfficher.map(({ auteur_user_id, auteur_type, ...m }) => m) })
}

// « Lu » touché sur la borne
export async function POST(request) {
  const { code, id } = await request.json()
  const borne = await borneParCode(code)
  if (!borne) return NextResponse.json({ error: 'Code borne invalide' }, { status: 404 })
  await supabaseAdmin.from('messages').update({ lu_borne_at: new Date().toISOString() })
    .eq('id', id).eq('senior_id', borne.senior_id).is('lu_borne_at', null)
  return NextResponse.json({ success: true })
}
