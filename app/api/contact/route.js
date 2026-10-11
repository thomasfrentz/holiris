import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { escapeHtml, emailContact } from '@/lib/emails'

const resend = new Resend(process.env.RESEND_API_KEY)

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const DESTINATAIRE = 'thomas.frentz@holiris.fr'

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
