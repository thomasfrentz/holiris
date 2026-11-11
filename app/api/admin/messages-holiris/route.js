import { NextResponse } from 'next/server'
import { supabaseAdmin, verifierAdmin } from '@/lib/serveur'
import { EXPEDITEUR_HOLIRIS } from '@/lib/expediteurHoliris'

// Messages automatiques envoyés par Holiris (admin Holiris uniquement) : destinataire, lecture et,
// pour une proposition de passages, la réponse de l'intervenant
export async function GET() {
  const { admin } = await verifierAdmin()
  if (!admin) return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 })

  const { data: messages, error } = await supabaseAdmin.from('messages')
    .select('id, senior_id, contenu, destinataire_nom, created_at, seniors(name), propositions_passages(statut, jours, heure, passages_crees, repondu_at)')
    .eq('auteur_user_id', EXPEDITEUR_HOLIRIS).order('created_at', { ascending: false }).limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const ids = (messages || []).map(m => m.id)
  const { data: lectures } = ids.length
    ? await supabaseAdmin.from('messages_lus').select('message_id, lu_at').in('message_id', ids)
    : { data: [] }
  const premiereLecture = new Map()
  for (const l of lectures || []) {
    if (!premiereLecture.has(l.message_id) || l.lu_at < premiereLecture.get(l.message_id)) premiereLecture.set(l.message_id, l.lu_at)
  }

  return NextResponse.json({
    messages: (messages || []).map(m => ({
      id: m.id, createdAt: m.created_at, contenu: m.contenu,
      destinataire: m.destinataire_nom, senior: m.seniors?.name || '',
      luAt: premiereLecture.get(m.id) || null,
      proposition: m.propositions_passages ? {
        statut: m.propositions_passages.statut, jours: m.propositions_passages.jours, heure: m.propositions_passages.heure,
        passagesCrees: m.propositions_passages.passages_crees, reponduAt: m.propositions_passages.repondu_at,
      } : null,
    })),
  })
}
