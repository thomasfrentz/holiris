// Invitations par email (côté serveur uniquement)
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/serveur'
import { escapeHtml, emailNouveauCompte, emailCompteExistant, emailGestionnaire } from '@/lib/emails'

const resend = new Resend(process.env.RESEND_API_KEY)

export function genererJeton() {
  return randomBytes(24).toString('base64url')
}

// Cherche un compte Holiris existant pour cet email
export async function trouverCompte(email) {
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

// Invite un proche ou un intervenant sur le dossier d'un senior :
// compte existant → rattachement direct ; sinon → lien de création de compte.
// membre : ligne famille / intervenants, avec seniors(name)
export async function inviterMembre({ table, type, membre }) {
  const email = membre.email.trim().toLowerCase()
  const prenom = escapeHtml(membre.name?.split(' ')[0])
  const role = escapeHtml(membre.role)
  const seniorName = escapeHtml(membre.seniors?.name)

  const existingUserId = membre.user_id || await trouverCompte(email)

  if (existingUserId) {
    await supabaseAdmin.from(table)
      .update({ email, user_id: existingUserId, invite_token: null })
      .eq('id', membre.id)

    const { error } = await resend.emails.send({
      from: 'Holiris <contact@holiris.fr>',
      to: email,
      subject: 'Nouvel accès Holiris — Suivi de ' + membre.seniors?.name,
      html: emailCompteExistant({ prenom, role, seniorName, type }),
    })
    if (error) console.error('Erreur Resend:', error)
    return { success: !error, linked: true, error }
  }

  // Le jeton prouve l'accès à la boîte mail
  const token = membre.invite_token || genererJeton()
  await supabaseAdmin.from(table)
    .update({ email, invite_token: token })
    .eq('id', membre.id)

  const { error } = await resend.emails.send({
    from: 'Holiris <contact@holiris.fr>',
    to: email,
    subject: 'Votre accès Holiris — Suivi de ' + membre.seniors?.name,
    html: emailNouveauCompte({ prenom, role, seniorName, token, email, type }),
  })
  if (error) console.error('Erreur Resend:', error)
  return { success: !error, linked: false, error }
}

// Invite un gestionnaire de structure (même principe)
// gestionnaire : ligne structure_membres ; structureNom : nom de la structure
export async function inviterGestionnaire(gestionnaire, structureNom) {
  const email = gestionnaire.email.trim().toLowerCase()
  const existingUserId = gestionnaire.user_id || await trouverCompte(email)

  let jeton = null
  if (existingUserId) {
    await supabaseAdmin.from('structure_membres').update({ user_id: existingUserId, invite_token: null }).eq('id', gestionnaire.id)
  } else {
    jeton = gestionnaire.invite_token || genererJeton()
    await supabaseAdmin.from('structure_membres').update({ invite_token: jeton }).eq('id', gestionnaire.id)
  }

  const { error } = await resend.emails.send({
    from: 'Holiris <contact@holiris.fr>',
    to: email,
    subject: 'Votre espace structure Holiris — ' + structureNom,
    html: emailGestionnaire({
      prenom: escapeHtml(gestionnaire.nom?.split(' ')[0]),
      structureNom: escapeHtml(structureNom),
      jeton,
      email,
    }),
  })
  if (error) console.error('Erreur Resend:', error)
  return { success: !error, linked: !!existingUserId, error }
}
