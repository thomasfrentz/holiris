import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/serveur'
import { empreinte } from '@/lib/documents'
import { escapeHtml, emailRattachementDecision } from '@/lib/emails'

const resend = new Resend(process.env.RESEND_API_KEY)

// Réponse d'un proche à la demande d'une structure de rejoindre le dossier d'un senior.
// Lien reçu par email (sans compte : le jeton prouve l'accès à la boîte mail), utilisable une fois.
async function demandeDuJeton(jeton) {
  if (!jeton) return null
  const { data } = await supabaseAdmin.from('demandes_rattachement')
    .select('id, statut, senior_id, structure_id, created_at, structures(nom), seniors(name)')
    .eq('jeton_hash', empreinte(String(jeton))).maybeSingle()
  // Lien valable 30 jours
  if (!data || !data.seniors || new Date(data.created_at) < new Date(Date.now() - 30 * 24 * 3600 * 1000)) return null
  return data
}

export async function GET(request) {
  const demande = await demandeDuJeton(new URL(request.url).searchParams.get('t'))
  if (!demande) return NextResponse.json({ error: 'Ce lien n’est plus valable.' }, { status: 404 })
  return NextResponse.json({ structure: demande.structures?.nom, senior: demande.seniors.name, statut: demande.statut })
}

export async function POST(request) {
  try {
    const { t, decision } = await request.json()
    const demande = await demandeDuJeton(t)
    if (!demande) return NextResponse.json({ success: false, error: 'Ce lien n’est plus valable.' }, { status: 404 })
    if (demande.statut !== 'en_attente') return NextResponse.json({ success: false, error: 'Vous avez déjà répondu à cette demande.' }, { status: 409 })
    if (!['accepter', 'refuser'].includes(decision)) return NextResponse.json({ success: false, error: 'Réponse invalide' }, { status: 400 })

    const accepte = decision === 'accepter'
    if (accepte) {
      const { error } = await supabaseAdmin.from('seniors').update({ structure_id: demande.structure_id }).eq('id', demande.senior_id)
      if (error) throw error
    }
    await supabaseAdmin.from('demandes_rattachement')
      .update({ statut: accepte ? 'acceptee' : 'refusee', traitee_at: new Date().toISOString() }).eq('id', demande.id)

    // Prévenir les gestionnaires de la structure et l'admin
    const [{ data: gestionnaires }, { data: admins }] = await Promise.all([
      supabaseAdmin.from('structure_membres').select('email').eq('structure_id', demande.structure_id).not('user_id', 'is', null),
      supabaseAdmin.from('famille').select('email').eq('is_admin', true).not('email', 'is', null),
    ])
    const contenu = { structureNom: escapeHtml(demande.structures?.nom || ''), seniorName: escapeHtml(demande.seniors.name), accepte }
    const sujet = `${demande.seniors.name} : demande de ${demande.structures?.nom} ${accepte ? 'acceptée' : 'refusée'}`
    const envois = [
      { to: [...new Set((gestionnaires || []).map(g => g.email.toLowerCase()))], html: emailRattachementDecision({ ...contenu, pourStructure: true }) },
      { to: [...new Set((admins || []).map(a => a.email.toLowerCase()))], html: emailRattachementDecision({ ...contenu, pourStructure: false }) },
    ].filter(e => e.to.length)
    for (const e of envois) {
      const { error } = await resend.emails.send({ from: 'Holiris <contact@holiris.fr>', subject: sujet, ...e })
      if (error) console.error('Erreur email décision rattachement:', error)
    }

    return NextResponse.json({ success: true, accepte })
  } catch (error) {
    console.error('Erreur rattachement:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
