import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/serveur'
import { nonLusPour } from '@/lib/messagesNonLus'

// Chargement d'une borne par son code (la borne n'a pas de compte connecté).
// Le code de la borne sert de clé : il ne donne accès qu'au nom du senior et à la liste des personnes.
export async function GET(request) {
  const code = new URL(request.url).searchParams.get('code')?.trim().toUpperCase()
  if (!code) return NextResponse.json({ error: 'Code manquant' }, { status: 400 })

  const { data: borne } = await supabaseAdmin.from('bornes')
    .select('id, code, senior_id, seniors(name)').eq('code', code).maybeSingle()
  if (!borne) return NextResponse.json({ error: 'Code borne invalide' }, { status: 404 })

  // Messages non lus : nombre et prénoms seulement, jamais le contenu
  const personneId = new URL(request.url).searchParams.get('nonlus')

  // Accueil de la borne : une ligne par personne du dossier qui a des messages non lus
  if (personneId === 'tous') {
    const [{ data: interv }, { data: fam }] = await Promise.all([
      supabaseAdmin.from('intervenants').select('name, user_id').eq('senior_id', borne.senior_id).is('archived_at', null).not('user_id', 'is', null),
      supabaseAdmin.from('famille').select('name, user_id').eq('senior_id', borne.senior_id).is('archived_at', null).not('user_id', 'is', null),
    ])
    const vus = new Set()
    const personnes = [...(interv || []), ...(fam || [])].filter(p => !vus.has(p.user_id) && vus.add(p.user_id))
    const lignes = await Promise.all(personnes.map(async p => {
      const { parSenior } = await nonLusPour(p.user_id, [borne.senior_id])
      return { prenom: p.name.split(' ')[0], nombre: parSenior[borne.senior_id]?.nombre || 0 }
    }))
    return NextResponse.json({ messages: lignes.filter(l => l.nombre > 0) })
  }

  if (personneId) {
    const table = new URL(request.url).searchParams.get('type') === 'famille' ? 'famille' : 'intervenants'
    const { data: p } = await supabaseAdmin.from(table).select('user_id, senior_id').eq('id', personneId).maybeSingle()
    if (!p?.user_id || p.senior_id !== borne.senior_id) return NextResponse.json({ nombre: 0, auteurs: [] })
    const { parSenior } = await nonLusPour(p.user_id, [borne.senior_id])
    return NextResponse.json(parSenior[borne.senior_id] || { nombre: 0, auteurs: [] })
  }

  // Alertes non lues, affichées sur l'accueil de la borne
  if (new URL(request.url).searchParams.get('alertes')) {
    const depuis = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
    const { data: alertes } = await supabaseAdmin.from('alertes')
      .select('id, niveau, message, created_at')
      .eq('senior_id', borne.senior_id).eq('lu', false).gte('created_at', depuis)
      .or('type.is.null,type.neq.sans_passage') // « aucun passage » : pour la famille, pas pour l'écran du senior
      .order('created_at', { ascending: false }).limit(5)
    // Les urgentes d'abord, comme sur le tableau de bord
    return NextResponse.json({ alertes: (alertes || []).sort((a, b) => (b.niveau === 'danger') - (a.niveau === 'danger')) })
  }

  const [{ data: intervenants }, { data: famille }] = await Promise.all([
    supabaseAdmin.from('intervenants').select('id, name, role').eq('senior_id', borne.senior_id).is('archived_at', null).order('name'),
    supabaseAdmin.from('famille').select('id, name, role').eq('senior_id', borne.senior_id).is('archived_at', null).order('name'),
  ])

  const personnes = [
    ...(intervenants || []).map(p => ({ ...p, type: 'intervenant' })),
    ...(famille || []).map(p => ({ ...p, type: 'famille' })),
  ].sort((a, b) => a.name.localeCompare(b.name))

  return NextResponse.json({ borne, personnes })
}
