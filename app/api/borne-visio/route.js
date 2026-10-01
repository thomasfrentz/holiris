import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/serveur'
import { VALIDITE_LIEN, visioEnCours, terminerVisio, serveursIce } from '@/lib/visio'

async function borneParCode(code) {
  const { data } = await supabaseAdmin.from('bornes').select('senior_id')
    .eq('code', String(code || '').trim().toUpperCase()).maybeSingle()
  return data
}

// Côté borne : y a-t-il un SOS récent (la borne surveille alors les demandes de visio), et une visio à démarrer ?
export async function GET(request) {
  const borne = await borneParCode(new URL(request.url).searchParams.get('code'))
  if (!borne) return NextResponse.json({ error: 'Code borne invalide' }, { status: 404 })

  const { data: sos } = await supabaseAdmin.from('alertes').select('id')
    .eq('senior_id', borne.senior_id).eq('type', 'sos')
    .gte('created_at', new Date(Date.now() - VALIDITE_LIEN).toISOString()).limit(1)
  const visio = sos?.length ? await visioEnCours(borne.senior_id) : null

  return NextResponse.json({
    sosRecent: !!sos?.length,
    visio: visio ? { canal: visio.canal, prenom: visio.destinataire, iceServers: await serveursIce() } : null,
  })
}

// La personne arrête la caméra depuis la borne
export async function POST(request) {
  const { code, canal } = await request.json()
  const borne = await borneParCode(code)
  if (!borne) return NextResponse.json({ error: 'Code borne invalide' }, { status: 404 })
  const visio = await visioEnCours(borne.senior_id)
  if (visio?.canal === canal) await terminerVisio(canal)
  return NextResponse.json({ success: true })
}
