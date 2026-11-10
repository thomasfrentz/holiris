import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { escapeHtml, emailContact } from '@/lib/emails'

const resend = new Resend(process.env.RESEND_API_KEY)

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DESTINATAIRE = 'thomas.frentz@holiris.fr'

// Lien dans le nom ou le message : refusé (les messages d'hameçonnage renvoient vers une fausse page)
const LIEN = /(https?:\/\/|www\.|\b[a-z0-9-]+\.[a-z]{2,}\/\S)/i

// Captcha Cloudflare Turnstile : exigé dès que la clé secrète est configurée sur Vercel
async function captchaValide(jeton, ip) {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return true
  if (!jeton) return false
  const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: new URLSearchParams({ secret, response: String(jeton).slice(0, 2048), ...(ip && { remoteip: ip }) }),
  }).catch(() => null)
  const d = await r?.json().catch(() => null)
  return d?.success === true
}

// Formulaire de contact de la page d'accueil : le message part par email, avec l'adresse du visiteur en réponse
export async function POST(request) {
  try {
    const body = await request.json()

    // Champ piège invisible : rempli uniquement par les robots
    if (body.site_web) return NextResponse.json({ success: true })

    const champ = (v, max = 200) => String(v ?? '').trim().slice(0, max)
    const contact = {
      nom: champ(body.nom, 120),
      email: champ(body.email, 200).toLowerCase(),
      telephone: champ(body.telephone, 30),
      profil: champ(body.profil, 40),
      message: champ(body.message, 3000),
    }
    if (!contact.nom || !EMAIL_VALIDE.test(contact.email) || contact.message.length < 5) {
      return NextResponse.json({ success: false, error: 'Merci de renseigner votre nom, un email valide et votre message.' }, { status: 400 })
    }
    if (LIEN.test(contact.nom) || LIEN.test(contact.message)) {
      return NextResponse.json({ success: false, error: 'Pour des raisons de sécurité, les liens ne sont pas acceptés dans le message.' }, { status: 400 })
    }
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    if (!await captchaValide(body.captcha, ip)) {
      return NextResponse.json({ success: false, captcha: true, error: 'La vérification anti-robot a échoué. Réessayez.' }, { status: 400 })
    }

    const e = Object.fromEntries(Object.entries(contact).map(([k, v]) => [k, escapeHtml(v)]))
    const { error } = await resend.emails.send({
      from: 'Holiris <contact@holiris.fr>',
      to: DESTINATAIRE,
      replyTo: contact.email,
      subject: 'Contact holiris.fr — ' + contact.nom.replace(/[\r\n]+/g, ' '),
      html: emailContact(e),
    })
    if (error) throw new Error(error.message)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur formulaire de contact:', error.message)
    return NextResponse.json({ success: false, error: 'Envoi impossible pour le moment. Écrivez-nous à ' + DESTINATAIRE }, { status: 500 })
  }
}
