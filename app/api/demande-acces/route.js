import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/serveur'
import { escapeHtml, emailNouvelleDemande } from '@/lib/emails'

const resend = new Resend(process.env.RESEND_API_KEY)

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Demande d'accès publique (nouvelle famille) : enregistrée puis signalée à l'admin
export async function POST(request) {
  try {
    const body = await request.json()

    // Champ piège invisible : rempli uniquement par les robots
    if (body.site_web) return NextResponse.json({ success: true })

    const champ = (v, max = 200) => String(v ?? '').trim().slice(0, max)
    const demande = {
      prenom: champ(body.prenom, 80),
      nom: champ(body.nom, 80),
      email: champ(body.email, 200).toLowerCase(),
      telephone: champ(body.telephone, 30) || null,
      senior_nom: champ(body.seniorNom, 120) || null,
      senior_ville: champ(body.seniorVille, 80) || null,
      lien: champ(body.lien, 60) || null,
      message: champ(body.message, 1000) || null,
    }
    if (!demande.prenom || !demande.nom || !EMAIL_VALIDE.test(demande.email)) {
      return NextResponse.json({ success: false, error: 'Merci de renseigner votre prénom, votre nom et un email valide.' }, { status: 400 })
    }

    // Une seule demande en attente par email
    const { data: existante } = await supabaseAdmin.from('demandes_acces')
      .select('id').eq('email', demande.email).eq('statut', 'en_attente').maybeSingle()
    if (existante) return NextResponse.json({ success: true, dejaEnAttente: true })

    const { error } = await supabaseAdmin.from('demandes_acces').insert(demande)
    if (error) throw error

    // Prévenir le ou les admins
    const { data: admins } = await supabaseAdmin.from('famille')
      .select('email').eq('is_admin', true).not('email', 'is', null)
    const destinataires = [...new Set((admins || []).map(a => a.email.toLowerCase()))]
    if (destinataires.length) {
      const e = Object.fromEntries(Object.entries(demande).map(([k, v]) => [k, escapeHtml(v)]))
      const { error: errMail } = await resend.emails.send({
        from: 'Holiris <contact@holiris.fr>',
        to: destinataires,
        subject: 'Nouvelle demande d\'accès — ' + demande.prenom + ' ' + demande.nom,
        html: emailNouvelleDemande({
          prenom: e.prenom, nom: e.nom, email: e.email, telephone: e.telephone,
          seniorNom: e.senior_nom, seniorVille: e.senior_ville, lien: e.lien, message: e.message,
        }),
      })
      if (errMail) console.error('Erreur email demande:', errMail)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur demande d\'accès:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue, réessayez plus tard.' }, { status: 500 })
  }
}
