import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/serveur'
import { SITE_URL, emailMotDePasse } from '@/lib/emails'
import { trouverCompte } from '@/lib/invitations'

const resend = new Resend(process.env.RESEND_API_KEY)

// Mot de passe oublié : lien de réinitialisation envoyé par Holiris (Resend), valable une heure.
// Même réponse que le compte existe ou non, pour ne pas révéler quelles adresses sont inscrites.
export async function POST(request) {
  try {
    const { email } = await request.json()
    const adresse = String(email || '').trim().toLowerCase()
    if (!adresse.includes('@')) return NextResponse.json({ success: false, error: 'Adresse email invalide.' }, { status: 400 })

    if (await trouverCompte(adresse)) {
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({ type: 'recovery', email: adresse })
      if (error) throw error
      const lien = `${SITE_URL}/nouveau-mot-de-passe?token_hash=${encodeURIComponent(data.properties.hashed_token)}`
      const { error: errMail } = await resend.emails.send({
        from: 'Holiris <contact@holiris.fr>',
        to: adresse,
        subject: 'Réinitialisation de votre mot de passe Holiris',
        html: emailMotDePasse({ lien }),
      })
      if (errMail) throw new Error(errMail.message)
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur mot de passe oublié:', error.message)
    return NextResponse.json({ success: false, error: 'L\'email n\'a pas pu être envoyé. Réessayez dans un instant.' }, { status: 500 })
  }
}
