import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { randomBytes } from 'crypto'
import { escapeHtml, emailNouveauCompte, emailCompteExistant } from '@/lib/emails'

const resend = new Resend(process.env.RESEND_API_KEY)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

function generateToken() {
  return randomBytes(24).toString('base64url')
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
