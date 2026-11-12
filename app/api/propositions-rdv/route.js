import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, clientUtilisateur } from '@/lib/serveur'
import { propositionsVisibles } from '@/lib/rdvMentionnes'
import { enParis, instantParis } from '@/lib/passagesReguliers'

// Rendez-vous mentionnés dans les notes et les messages d'un dossier : proposés à ceux qui peuvent lire
// la note ou le message, qui les ajoutent à l'agenda (tels quels ou corrigés) ou les ignorent
const TYPES = ['medical', 'kine', 'pharmacy', 'care']
const reponse = p => ({
  id: p.id, noteId: p.note_id, messageId: p.message_id, auteur: p.auteur,
  libelle: p.libelle, type: p.type, date: p.date, heure: p.heure, statut: p.statut,
})

// Rendez-vous à venir (ou d'aujourd'hui) du dossier
export async function GET(request) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const seniorId = new URL(request.url).searchParams.get('seniorId')
  if (!seniorId) return NextResponse.json({ error: 'Dossier manquant' }, { status: 400 })

  const { data, error } = await supabaseAdmin.from('propositions_rdv').select('*')
    .eq('senior_id', seniorId).gte('date', enParis(Date.now()).date).order('date').limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const visibles = await propositionsVisibles(data || [], await clientUtilisateur())
  return NextResponse.json({ propositions: visibles.map(reponse) })
}

// { id, ajouter: true, libelle, date, heure, type } ou { id, ajouter: false }
export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    const body = await request.json()
    const { data: p } = await supabaseAdmin.from('propositions_rdv').select('*').eq('id', body.id || null).maybeSingle()
    const [visible] = p ? await propositionsVisibles([p], await clientUtilisateur()) : []
    if (!visible) return NextResponse.json({ success: false, error: 'Rendez-vous introuvable' }, { status: 404 })
    if (p.statut !== 'proposee') return NextResponse.json({ success: true, proposition: reponse(visible) }) // déjà traité (double clic, autre personne)

    if (!body.ajouter) {
      const { data } = await supabaseAdmin.from('propositions_rdv')
        .update({ statut: 'ignoree', repondu_par: user.id, repondu_at: new Date().toISOString() })
        .eq('id', p.id).eq('statut', 'proposee').select().maybeSingle()
      return NextResponse.json({ success: true, proposition: reponse({ ...visible, ...(data || { statut: 'ignoree' }) }) })
    }

    const libelle = String(body.libelle ?? p.libelle).trim().slice(0, 120)
    const date = String(body.date ?? p.date)
    const heure = String(body.heure ?? p.heure ?? '')
    const type = TYPES.includes(body.type) ? body.type : p.type
    if (!libelle) return NextResponse.json({ success: false, error: 'Indiquez le rendez-vous.' }, { status: 400 })
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(heure)) {
      return NextResponse.json({ success: false, error: 'Indiquez le jour et l\'heure du rendez-vous.' }, { status: 400 })
    }

    // Réservée avant d'écrire dans l'agenda : un second clic ne crée pas un second rendez-vous
    const { data: reservee } = await supabaseAdmin.from('propositions_rdv')
      .update({ statut: 'ajoutee', libelle, date, heure, type, repondu_par: user.id, repondu_at: new Date().toISOString() })
      .eq('id', p.id).eq('statut', 'proposee').select().maybeSingle()
    if (!reservee) return NextResponse.json({ success: true, proposition: reponse({ ...visible, statut: 'ajoutee' }) })

    const { data: event, error } = await supabaseAdmin.from('events').insert({
      senior_id: p.senior_id, label: libelle, type, scheduled_at: instantParis(date, heure).toISOString(),
      status: 'a_venir', intervenant_id: null, intervenant_ids: [],
    }).select('id').single()
    if (error) {
      await supabaseAdmin.from('propositions_rdv').update({ statut: 'proposee', repondu_par: null, repondu_at: null }).eq('id', p.id)
      throw error
    }
    await supabaseAdmin.from('propositions_rdv').update({ event_id: event.id }).eq('id', p.id)
    return NextResponse.json({ success: true, proposition: reponse({ ...visible, ...reservee }) })
  } catch (error) {
    console.error('Erreur rendez-vous mentionné:', error.message)
    return NextResponse.json({ success: false, error: 'Le rendez-vous n\'a pas pu être ajouté.' }, { status: 500 })
  }
}
