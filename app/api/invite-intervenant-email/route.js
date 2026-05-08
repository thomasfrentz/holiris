import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export async function POST(request) {
  try {
    const { familleId, email, prenom, role, seniorName } = await request.json()

    const code = generateCode()

    await supabase.from('famille')
      .update({ email, code_acces: code })
      .eq('id', familleId)

    const { error } = await resend.emails.send({
      from: 'Holiris <contact@holiris.fr>',
      to: email,
      subject: 'Votre accès Holiris — Suivi de ' + seniorName,
      html: `
        <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #f4f1ec;">
          <div style="text-align: center; margin-bottom: 32px;">
            <h1 style="font-size: 32px; font-weight: 300; color: #1E2820; letter-spacing: 0.12em;">Holiris</h1>
            <p style="font-size: 14px; color: #888; font-style: italic;">Prendre soin de ceux qui nous sont chers</p>
          </div>
          <div style="background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
            <p style="font-size: 16px; color: #1E2820; margin-bottom: 16px;">Bonjour ${prenom} 👋</p>
            <p style="font-size: 14px; color: #555; line-height: 1.7; margin-bottom: 20px;">
              Vous avez été invité(e) à rejoindre <strong>Holiris</strong> pour le suivi de <strong>${seniorName}</strong> en tant que <strong>${role}</strong>.
            </p>
            <p style="font-size: 14px; color: #555; line-height: 1.7; margin-bottom: 24px;">
              Créez votre compte sur Holiris puis entrez votre code d'accès pour activer votre espace.
            </p>
            <div style="text-align: center; margin-bottom: 24px;">
              <a href="https://holiris.fr/login?signup=true" style="background: #6B8F71; color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 14px; font-weight: 500; letter-spacing: 0.06em;">
                Créer mon compte →
              </a>
            </div>
            <div style="background: #f0f9f4; border: 1px solid #b8d8bc; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
              <p style="font-size: 12px; color: #5a8a6a; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 8px;">Votre code d'accès</p>
              <p style="font-size: 32px; font-weight: bold; color: #12201a; letter-spacing: 0.2em; margin: 0;">${code}</p>
            </div>
            <p style="font-size: 12px; color: #aaa; text-align: center; margin: 0;">
              Holiris · <a href="https://holiris.fr/privacy" style="color: #9AB89F;">Confidentialité</a>
            </p>
          </div>
        </div>
      `
    })

    if (error) {
      console.error('Erreur Resend:', error)
      return NextResponse.json({ success: false, error })
    }

    return NextResponse.json({ success: true, code })

  } catch (error) {
    console.error('Erreur:', error.message)
    return NextResponse.json({ success: false, error: error.message })
  }
}
