// Modèles d'emails Holiris (côté serveur uniquement)
import { createHmac, timingSafeEqual } from 'crypto'

export const SITE_URL = 'https://holiris.fr'

// ── Désinscription des emails hebdomadaires ──
// Le lien est signé pour qu'on ne puisse pas désinscrire l'adresse de quelqu'un d'autre

function signer(email) {
  return createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY)
    .update('desinscription:' + email.toLowerCase())
    .digest('base64url')
}

export function signatureValide(email, sig) {
  if (!email || !sig) return false
  const attendu = Buffer.from(signer(email))
  const recu = Buffer.from(String(sig))
  return attendu.length === recu.length && timingSafeEqual(attendu, recu)
}

export function lienDesinscription(email) {
  const params = `email=${encodeURIComponent(email.toLowerCase())}&sig=${signer(email)}`
  return {
    page: `${SITE_URL}/desinscription?${params}`,
    oneClick: `${SITE_URL}/api/desinscription?${params}`,
  }
}

// En-têtes pour le bouton « Se désabonner » de Gmail / Outlook
export function entetesDesinscription(email) {
  const { oneClick } = lienDesinscription(email)
  return {
    'List-Unsubscribe': `<${oneClick}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
  }
}

// Adresses désinscrites (en minuscules)
export async function adressesDesinscrites(supabase) {
  const { data, error } = await supabase.from('desinscriptions').select('email')
  if (error) { console.error('Lecture désinscriptions:', error.message); return new Set() }
  return new Set(data.map(d => d.email.toLowerCase()))
}

export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

function emailLayout(content, desinscription = null) {
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
        ${desinscription ? `
        <p style="font-size: 11px; color: #bbb; text-align: center; margin: 12px 0 0; line-height: 1.6;">
          Vous recevez cet email hebdomadaire car vous participez au suivi d'un proche sur Holiris.<br/>
          <a href="${desinscription}" style="color: #aaa;">Ne plus recevoir ces emails</a>
        </p>` : ''}
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

function paragraphe(html, marginBottom = 20) {
  return `<p style="font-size: 14px; color: #555; line-height: 1.7; margin-bottom: ${marginBottom}px;">${html}</p>`
}

function bonjour(prenom) {
  return `<p style="font-size: 16px; color: #1E2820; margin-bottom: 16px;">Bonjour ${prenom} 👋</p>`
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

// Les paramètres texte (prenom, role, seniorName…) doivent déjà être échappés avec escapeHtml

export function emailNouveauCompte({ prenom, role, seniorName, token, email, type, relance = false, desinscription = null }) {
  const lien = `${SITE_URL}/rejoindre?token=${token}&type=${type}&email=${encodeURIComponent(email)}`
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`${relance ? 'Petit rappel : vous' : 'Vous'} avez été invité(e) à rejoindre <strong>Holiris</strong> pour le suivi de <strong>${seniorName}</strong> en tant que <strong>${role}</strong>.`)}
    ${paragraphe(`Pour accéder à l'espace de ${seniorName}, commencez par créer votre compte Holiris avec cette adresse email. Votre accès sera activé automatiquement.`, 24)}
    ${bouton(lien, 'Créer mon compte →')}
    ${type === 'intervenant' ? rappelIntervenant : ''}
  `, desinscription)
}

export function emailCompteExistant({ prenom, role, seniorName, type }) {
  const espace = type === 'intervenant' ? '/espace-intervenant' : '/app'
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`Vous avez été ajouté(e) au suivi de <strong>${seniorName}</strong> en tant que <strong>${role}</strong>.`)}
    ${paragraphe(`Ce nouvel espace est déjà rattaché à votre compte Holiris. Connectez-vous puis sélectionnez <strong>${seniorName}</strong> dans le menu « Dossier actif » pour passer d'un senior à l'autre.`, 24)}
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent(espace)}`, 'Accéder à l\'espace →')}
    ${type === 'intervenant' ? rappelIntervenant : ''}
  `)
}

export function emailRelanceIntervenant({ prenom, seniorNames, desinscription }) {
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`Vous êtes intervenu(e) cette semaine auprès de <strong>${seniorNames.join('</strong>, <strong>')}</strong>. Nous n'avons pas encore reçu de vos nouvelles.`)}
    ${paragraphe(`Quelques mots suffisent : moral, activités, ce que vous avez remarqué. Vous pouvez envoyer un message ou une note vocale au numéro WhatsApp Holiris, ou écrire directement depuis votre espace.`, 24)}
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent('/espace-intervenant')}`, 'Donner des nouvelles →')}
    ${rappelIntervenant}
  `, desinscription)
}

export function emailResumeFamille({ prenom, resumes, desinscription }) {
  const blocs = resumes.map(({ seniorName, resume }) => `
    <div style="background: #f0f9f4; border: 1px solid #b8d8bc; border-radius: 8px; padding: 18px 20px; margin-bottom: 16px;">
      <p style="font-size: 12px; color: #5a8a6a; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 8px;">${seniorName}</p>
      <p style="font-size: 14px; color: #333; line-height: 1.7; margin: 0;">${resume}</p>
    </div>
  `).join('')
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe('Voici les nouvelles de la semaine, d\'après les notes des intervenants et de la famille.')}
    ${blocs}
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent('/app')}`, 'Voir le détail →')}
  `, desinscription)
}

export function emailContactMedical({ prenom, seniorName, auteurNom, auteurRole, telephone, email, sansPersonneConfiance }) {
  const coordonnees = [
    telephone && `📞 <a href="tel:${telephone}" style="color: #4A8870;">${telephone}</a>`,
    email && `✉️ <a href="mailto:${email}" style="color: #4A8870;">${email}</a>`,
  ].filter(Boolean).join('<br/>')
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`<strong>${auteurNom}</strong>${auteurRole ? ` (${auteurRole})` : ''} a transmis une information médicale concernant <strong>${seniorName}</strong> et l'a jugée essentielle.`)}
    ${paragraphe(`Pour protéger ${seniorName}, cette information n'est pas enregistrée sur Holiris. ${sansPersonneConfiance
      ? `Aucune personne de confiance n'étant désignée pour ${seniorName}, merci de prendre contact vous-même, puis de désigner une personne de confiance dans la page Famille.`
      : `En tant que personne de confiance, merci de prendre contact directement pour en savoir plus.`}`, 24)}
    <div style="background: #f0f9f4; border: 1px solid #b8d8bc; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; font-size: 15px; line-height: 1.9; color: #1E2820;">
      <strong>${auteurNom}</strong><br/>
      ${coordonnees || 'Coordonnées non renseignées'}
    </div>
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent('/app')}`, 'Marquer comme fait →')}
  `)
}

// Envoi groupé via Resend (100 emails maximum par appel)
export async function envoyerEnLots(resend, messages) {
  let envoyes = 0
  for (let i = 0; i < messages.length; i += 100) {
    const lot = messages.slice(i, i + 100)
    const { error } = await resend.batch.send(lot)
    if (error) console.error('Erreur envoi groupé:', error)
    else envoyes += lot.length
  }
  return envoyes
}
