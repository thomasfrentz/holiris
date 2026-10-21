import { NextResponse } from 'next/server'
import { supabaseAdmin, verifierAdmin } from '@/lib/serveur'
import { envoyerModele, numeroWhatsapp, derniereErreurWhatsapp } from '@/lib/whatsapp'

// Relance WhatsApp manuelle des intervenants, depuis l'administration (admin Holiris uniquement).
// Modèle « relances_intervenant » dans tous les cas.
const JOUR = 24 * 3600 * 1000

async function intervenantsSansNote(jours) {
  const depuis = new Date(Date.now() - jours * JOUR).toISOString()
  const [{ data: fiches }, { data: notes }, { data: evenements }, { data: relances }] = await Promise.all([
    supabaseAdmin.from('intervenants').select('id, name, role, whatsapp, phone, senior_id, seniors!intervenants_senior_id_fkey(name)').is('archived_at', null),
    supabaseAdmin.from('notes').select('senior_id, intervenant_name, created_at')
      .gte('created_at', new Date(Date.now() - 90 * JOUR).toISOString()).not('intervenant_name', 'is', null),
    supabaseAdmin.from('events').select('id, scheduled_at, intervenant_id, intervenant_ids')
      .gte('scheduled_at', depuis).lte('scheduled_at', new Date().toISOString()),
    supabaseAdmin.from('relances').select('intervenant_id, sent_at').eq('status', 'sent').not('intervenant_id', 'is', null),
  ])

  return (fiches || []).filter(f => numeroWhatsapp(f.whatsapp || f.phone)).map(f => {
    const sesNotes = (notes || []).filter(n => n.senior_id === f.senior_id && n.intervenant_name.startsWith(f.name))
    const derniereNote = sesNotes.map(n => n.created_at).sort().pop() || null
    const passage = (evenements || []).filter(e => (e.intervenant_ids?.length ? e.intervenant_ids : [e.intervenant_id]).includes(f.id))
      .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))[0] || null
    const derniereRelance = (relances || []).filter(r => r.intervenant_id === f.id).map(r => r.sent_at).sort().pop() || null
    return {
      id: f.id, nom: f.name, role: f.role, senior: f.seniors?.name || '', seniorId: f.senior_id,
      derniereNote, derniereRelance, passageId: passage?.id || null, passageLe: passage?.scheduled_at || null,
    }
  }).filter(i => !i.derniereNote || i.derniereNote < depuis)
    .sort((a, b) => a.senior.localeCompare(b.senior) || a.nom.localeCompare(b.nom))
}

export async function GET(request) {
  const { admin } = await verifierAdmin()
  if (!admin) return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 })
  const jours = Math.min(Math.max(parseInt(new URL(request.url).searchParams.get('jours')) || 3, 1), 30)
  return NextResponse.json({ intervenants: await intervenantsSansNote(jours) })
}

export async function POST(request) {
  try {
    const { admin } = await verifierAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Réservé à l\'admin' }, { status: 403 })
    const { ids, jours } = await request.json()
    const choisis = new Set(Array.isArray(ids) ? ids : [])
    // La liste est recalculée : seuls des intervenants réellement sans note peuvent être relancés
    const cibles = (await intervenantsSansNote(Math.min(Math.max(parseInt(jours) || 3, 1), 30))).filter(i => choisis.has(i.id))

    const resultats = []
    for (const i of cibles) {
      const { data: fiche } = await supabaseAdmin.from('intervenants').select('whatsapp, phone').eq('id', i.id).single()
      const envoye = await envoyerModele(numeroWhatsapp(fiche.whatsapp || fiche.phone), 'relances_intervenant', [i.nom.split(' ')[0], i.senior])
      await supabaseAdmin.from('relances').insert({
        event_id: i.passageId, intervenant_id: i.id, channel: 'whatsapp_meta',
        status: envoye ? 'sent' : 'failed', erreur: envoye ? null : derniereErreurWhatsapp, sent_at: new Date().toISOString(),
      })
      resultats.push({ id: i.id, nom: i.nom, envoye, erreur: envoye ? null : derniereErreurWhatsapp })
    }
    return NextResponse.json({ success: true, resultats })
  } catch (error) {
    console.error('Erreur relance manuelle:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
