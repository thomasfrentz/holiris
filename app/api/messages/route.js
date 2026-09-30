import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { analyserNote, creerSignalement } from '@/lib/notesMedicales'
import { escapeHtml, emailNouveauMessage, lienDesinscription, entetesDesinscription, adressesDesinscrites } from '@/lib/emails'

// Fil de discussion d'un senior : envoi d'un message (filtre médical, puis notification par email).
// La lecture se fait directement depuis le navigateur, protégée par les règles d'accès.

const resend = new Resend(process.env.RESEND_API_KEY)
const HEURE = 60 * 60 * 1000

// Qui écrit, à quel titre : proche, intervenant, gestionnaire de la structure ou admin
async function auteurPour(user, seniorId) {
  const [{ data: fam }, { data: interv }] = await Promise.all([
    supabaseAdmin.from('famille').select('id, name, role, phone, email').eq('user_id', user.id).eq('senior_id', seniorId).is('archived_at', null).limit(1),
    supabaseAdmin.from('intervenants').select('id, name, role, phone, whatsapp, email').eq('user_id', user.id).eq('senior_id', seniorId).is('archived_at', null).limit(1),
  ])
  if (interv?.[0]) { const i = interv[0]; return { type: 'intervenant', id: i.id, nom: i.name, role: i.role, telephone: i.phone || i.whatsapp, email: i.email || user.email } }
  if (fam?.[0]) { const f = fam[0]; return { type: 'famille', id: f.id, nom: f.name, role: f.role, telephone: f.phone, email: f.email || user.email } }
  if (!await peutGererSenior(user.id, seniorId)) return null
  const { data: g } = await supabaseAdmin.from('structure_membres').select('id, nom, email, structures(nom)').eq('user_id', user.id).limit(1).maybeSingle()
  if (g) return { type: 'structure', id: g.id, nom: g.nom || g.email.split('@')[0], role: g.structures?.nom || 'Structure', email: g.email }
  const { data: a } = await supabaseAdmin.from('famille').select('id, name').eq('user_id', user.id).eq('is_admin', true).limit(1).maybeSingle()
  return { type: 'famille', id: a?.id, nom: a?.name || user.email.split('@')[0], role: 'Holiris', email: user.email }
}

// Email aux autres participants ayant un compte, au plus un par heure et par personne
async function notifier(senior, auteurUserId, auteur, contenu) {
  const [{ data: fam }, { data: interv }, { data: gest }] = await Promise.all([
    supabaseAdmin.from('famille').select('name, email, user_id').eq('senior_id', senior.id).is('archived_at', null).not('user_id', 'is', null),
    supabaseAdmin.from('intervenants').select('name, email, user_id').eq('senior_id', senior.id).is('archived_at', null).not('user_id', 'is', null),
    senior.structure_id
      ? supabaseAdmin.from('structure_membres').select('nom, email, user_id').eq('structure_id', senior.structure_id).not('user_id', 'is', null)
      : { data: [] },
  ])
  const desinscrits = await adressesDesinscrites(supabaseAdmin)
  const destinataires = new Map()
  for (const p of [...(fam || []), ...(interv || []), ...(gest || []).map(g => ({ ...g, name: g.nom }))]) {
    if (!p.email || p.user_id === auteurUserId) continue
    const email = p.email.toLowerCase()
    if (!desinscrits.has(email) && !destinataires.has(email)) destinataires.set(email, p)
  }
  if (!destinataires.size) return 0

  const { data: recents } = await supabaseAdmin.from('notifications_messages').select('email')
    .eq('senior_id', senior.id).in('email', [...destinataires.keys()]).gte('envoye_at', new Date(Date.now() - HEURE).toISOString())
  for (const r of recents || []) destinataires.delete(r.email)
  if (!destinataires.size) return 0

  const extrait = contenu.length > 280 ? contenu.slice(0, 277) + '…' : contenu
  const messages = [...destinataires].map(([email, p]) => ({
    from: 'Holiris <contact@holiris.fr>',
    to: email,
    subject: 'Nouveau message de ' + auteur.nom.split(' ')[0] + ' — suivi de ' + senior.name,
    headers: entetesDesinscription(email),
    html: emailNouveauMessage({
      prenom: escapeHtml(p.name?.split(' ')[0]),
      auteurNom: escapeHtml(auteur.nom),
      auteurRole: escapeHtml(auteur.role),
      seniorName: escapeHtml(senior.name),
      extrait: escapeHtml(extrait),
      desinscription: lienDesinscription(email).page,
    }),
  }))
  const { error } = await resend.batch.send(messages)
  if (error) { console.error('Erreur notification message:', error); return 0 }
  await supabaseAdmin.from('notifications_messages').upsert(
    [...destinataires.keys()].map(email => ({ senior_id: senior.id, email, envoye_at: new Date().toISOString() }))
  )
  return messages.length
}

export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    const { seniorId, texte } = await request.json()
    const brut = String(texte || '').trim().slice(0, 2000)
    if (!seniorId || !brut) return NextResponse.json({ success: false, error: 'Message vide' }, { status: 400 })

    const auteur = await auteurPour(user, seniorId)
    if (!auteur) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
    const { data: senior } = await supabaseAdmin.from('seniors').select('id, name, structure_id').eq('id', seniorId).single()

    // Filtre médical : seule la partie non médicale est publiée
    const { medical, note: contenu } = await analyserNote(brut)

    let message = null
    if (contenu) {
      const { data, error } = await supabaseAdmin.from('messages').insert({
        senior_id: seniorId, auteur_user_id: user.id, auteur_nom: auteur.nom, auteur_role: auteur.role || null, contenu,
      }).select().single()
      if (error) throw error
      message = data
    }
    const signalementId = medical ? await creerSignalement({ seniorId, auteur, source: 'messages' }) : null
    const notifies = message ? await notifier(senior, user.id, auteur, contenu) : 0

    return NextResponse.json({ success: true, message, medical, signalementId, notePartielle: !!contenu, notifies })
  } catch (error) {
    console.error('Erreur message:', error.message)
    return NextResponse.json({ success: false, error: 'Le message n\'a pas pu être envoyé.' }, { status: 500 })
  }
}
