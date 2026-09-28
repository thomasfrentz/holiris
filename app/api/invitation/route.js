import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const SITE_URL = 'https://holiris.fr'

function generateToken() {
  return randomBytes(24).toString('base64url')
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

async function getCurrentUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Cherche un compte Holiris existant pour cet email
async function findUserIdByEmail(email) {
  const target = email.trim().toLowerCase()
  const perPage = 1000
  for (let page = 1; ; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const found = data.users.find(u => u.email?.toLowerCase() === target)
    if (found) return found.id
    if (data.users.length < perPage) return null
  }
}

function emailLayout(content) {
  return `
    <div style="font-family: Georgia, serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #f4f1ec;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 32px; font-weight: 300; color: #1E2820; letter-spacing: 0.12em;">Holiris</h1>
        <p style="font-size: 14px; color: #888; font-style: italic;">Prendre soin de ceux qui nous sont chers</p>
      </div>
      <div style="background: #fff; border-radius: 8px; padding: 32px; box-shadow: 0 1px 4px rgba(0,0,0,0.06);">
        ${content}
        <p style="font-size: 12px; color: #aaa; text-align: center; margin: 0;">
          Holiris · <a href="${SITE_URL}/privacy" style="color: #9AB89F;">Confidentialité</a>
        </p>
      </div>
    </div>
  `
}

function bouton(href, label) {
  return `
    <div style="text-align: center; margin-bottom: 24px;">
      <a href="${href}" style="background: #6B8F71; color: white; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-size: 14px; font-weight: 500; letter-spacing: 0.06em;">
        ${label}
      </a>
    </div>
  `
}

const rappelIntervenant = `
  <div style="background: #fef9ec; border-left: 3px solid #c4844a; padding: 14px 16px; border-radius: 0 4px 4px 0; margin-bottom: 20px;">
    <p style="font-size: 13px; color: #c4844a; margin: 0; font-weight: 500;">⚠️ Rappel important</p>
    <p style="font-size: 13px; color: #888; margin: 6px 0 0; line-height: 1.6;">
      Partagez uniquement l'état général, le moral et les activités de votre patient.
      Ne partagez jamais de diagnostics, ordonnances ou données médicales confidentielles.
    </p>
  </div>
`

function emailNouveauCompte({ prenom, role, seniorName, token, email, type }) {
  const lien = `${SITE_URL}/rejoindre?token=${token}&type=${type}&email=${encodeURIComponent(email)}`
  return emailLayout(`
    <p style="font-size: 16px; color: #1E2820; margin-bottom: 16px;">Bonjour ${prenom} 👋</p>
    <p style="font-size: 14px; color: #555; line-height: 1.7; margin-bottom: 20px;">
      Vous avez été invité(e) à rejoindre <strong>Holiris</strong> pour le suivi de <strong>${seniorName}</strong> en tant que <strong>${role}</strong>.
    </p>
    <p style="font-size: 14px; color: #555; line-height: 1.7; margin-bottom: 24px;">
      Pour accéder à l'espace de ${seniorName}, commencez par créer votre compte Holiris avec cette adresse email.
      Votre accès sera activé automatiquement.
    </p>
    ${bouton(lien, 'Créer mon compte →')}
    ${type === 'intervenant' ? rappelIntervenant : ''}
  `)
}

function emailCompteExistant({ prenom, role, seniorName, type }) {
  const espace = type === 'intervenant' ? '/espace-intervenant' : '/app'
  return emailLayout(`
    <p style="font-size: 16px; color: #1E2820; margin-bottom: 16px;">Bonjour ${prenom} 👋</p>
    <p style="font-size: 14px; color: #555; line-height: 1.7; margin-bottom: 20px;">
      Vous avez été ajouté(e) au suivi de <strong>${seniorName}</strong> en tant que <strong>${role}</strong>.
    </p>
    <p style="font-size: 14px; color: #555; line-height: 1.7; margin-bottom: 24px;">
      Ce nouvel espace est déjà rattaché à votre compte Holiris. Connectez-vous puis sélectionnez
      <strong>${seniorName}</strong> dans le menu « Dossier actif » pour passer d'un senior à l'autre.
    </p>
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent(espace)}`, 'Accéder à l\'espace →')}
    ${type === 'intervenant' ? rappelIntervenant : ''}
  `)
}

export async function POST(request) {
  try {
    const { type, id } = await request.json()
    const table = type === 'famille' ? 'famille' : type === 'intervenant' ? 'intervenants' : null
    if (!table || !id) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })

    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    const fkey = type === 'famille' ? 'famille_senior_id_fkey' : 'intervenants_senior_id_fkey'
    const { data: membre } = await supabaseAdmin
      .from(table).select(`*, seniors!${fkey}(name)`)
      .eq('id', id).single()
    if (!membre) return NextResponse.json({ success: false, error: 'Membre introuvable' }, { status: 404 })
    if (!membre.email) return NextResponse.json({ success: false, error: 'Aucun email renseigné' }, { status: 400 })

    // L'invitant doit avoir accès au dossier de ce senior (ou être admin)
    const { data: acces } = await supabaseAdmin
      .from('famille').select('senior_id, is_admin')
      .eq('user_id', user.id)
    const autorise = (acces || []).some(f => f.is_admin === true || f.senior_id === membre.senior_id)
    if (!autorise) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })

    const email = membre.email.trim().toLowerCase()
    const prenom = escapeHtml(membre.name?.split(' ')[0])
    const role = escapeHtml(membre.role)
    const seniorName = escapeHtml(membre.seniors?.name)

    const existingUserId = membre.user_id || await findUserIdByEmail(email)

    if (existingUserId) {
      // Compte existant → rattachement direct au nouveau senior
      await supabaseAdmin.from(table)
        .update({ email, user_id: existingUserId, invite_token: null })
        .eq('id', id)

      const { error } = await resend.emails.send({
        from: 'Holiris <contact@holiris.fr>',
        to: email,
        subject: 'Nouvel accès Holiris — Suivi de ' + membre.seniors?.name,
        html: emailCompteExistant({ prenom, role, seniorName, type }),
      })
      if (error) {
        console.error('Erreur Resend:', error)
        return NextResponse.json({ success: false, linked: true, error })
      }
      return NextResponse.json({ success: true, linked: true })
    }

    // Pas encore de compte → lien de création de compte (le jeton prouve l'accès à la boîte mail)
    const token = membre.invite_token || generateToken()
    await supabaseAdmin.from(table)
      .update({ email, invite_token: token })
      .eq('id', id)

    const { error } = await resend.emails.send({
      from: 'Holiris <contact@holiris.fr>',
      to: email,
      subject: 'Votre accès Holiris — Suivi de ' + membre.seniors?.name,
      html: emailNouveauCompte({ prenom, role, seniorName, token, email, type }),
    })
    if (error) {
      console.error('Erreur Resend:', error)
      return NextResponse.json({ success: false, linked: false, error })
    }
    return NextResponse.json({ success: true, linked: false })

  } catch (error) {
    console.error('Erreur invitation:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
