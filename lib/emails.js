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
      <a href="${href}" target="_blank" rel="noopener" style="display: inline-block; max-width: 100%; box-sizing: border-box; background: #6B8F71; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-size: 15px; font-weight: 500; line-height: 1.4; letter-spacing: 0.02em;">
        ${label}
      </a>
    </div>
  `
}

function paragraphe(html, marginBottom = 20) {
  return `<p style="font-size: 14px; color: #555; line-height: 1.7; margin-bottom: ${marginBottom}px;">${html}</p>`
}

// « en tant qu'aide à domicile », « en tant que fille »
function enTantQue(role) {
  const r = String(role || '').replace(/(^|\/\s*)(\p{Lu})/gu, (_, avant, lettre) => avant + lettre.toLowerCase())
  return (/^[aeiouyàâéèêëîïôûü]/i.test(r) ? 'en tant qu’' : 'en tant que ') + `<strong>${r}</strong>`
}

function bonjour(prenom) {
  return `<p style="font-size: 16px; color: #1E2820; margin-bottom: 16px;">Bonjour${prenom ? ' ' + prenom : ''} 👋</p>`
}

// Numéro WhatsApp sur lequel les intervenants envoient leurs notes (affiché aussi dans la page Intervenants)
const WHATSAPP_HOLIRIS = '+1 218-443-9755'

const rappelIntervenant = `
  <div style="background: #fef9ec; border-left: 3px solid #c4844a; padding: 14px 16px; border-radius: 0 4px 4px 0; margin-bottom: 20px;">
    <p style="font-size: 13px; color: #c4844a; margin: 0; font-weight: 500;">⚠️ Informations médicales</p>
    <p style="font-size: 13px; color: #888; margin: 6px 0 0; line-height: 1.6;">
      Parlez du moral, de l'état général et des activités. Une information médicale (diagnostic, traitement,
      résultat d'examen) n'est jamais enregistrée sur Holiris : si vous en transmettez une, nous vous demanderons
      si elle est essentielle, et la personne de confiance de la famille vous contactera si besoin.
    </p>
  </div>
`

function etape(icone, titre, texte) {
  return `
    <tr>
      <td style="width: 36px; vertical-align: top; font-size: 20px; padding: 0 0 14px;">${icone}</td>
      <td style="vertical-align: top; padding: 0 0 14px; font-size: 14px; color: #555; line-height: 1.6;">
        <strong style="color: #1E2820;">${titre}</strong><br/>${texte}
      </td>
    </tr>
  `
}

// Les trois moyens de transmettre une note
function moyensNote(type) {
  const puce = (titre, texte) => `<br/>• <strong style="color: #1E2820;">${titre}</strong> : ${texte}`
  return puce('WhatsApp', `message vocal ou écrit au numéro Holiris <strong>${WHATSAPP_HOLIRIS}</strong>, depuis le numéro que vous nous avez communiqué`)
    + puce('La borne Holiris', 'si une borne est installée au domicile, touchez votre nom et enregistrez un message vocal')
    + puce('Le site holiris.fr', type === 'intervenant' ? 'depuis votre espace intervenant, une fois votre compte créé' : 'depuis le carnet de suivi de votre espace')
}

// Comment installer l'application sur le téléphone (page /note)
function blocApplication() {
  return `
    <div style="background: #f3edf7; border: 1px solid #e0d0ec; border-radius: 8px; padding: 16px 18px; margin-bottom: 24px; font-size: 13px; color: #555; line-height: 1.7;">
      <p style="margin: 0 0 6px; font-size: 14px; color: #1E2820;"><strong>📲 Installez l'application sur votre téléphone</strong></p>
      Ouvrez <a href="${SITE_URL}/note" style="color: #8B6FAA; font-weight: 600;">holiris.fr/note</a> sur votre téléphone et connectez-vous, puis :<br/>
      • <strong>iPhone</strong> : dans <strong>Safari</strong> (pas depuis votre messagerie), touchez le bouton <strong>Partager</strong> (le carré avec une flèche vers le haut, en bas de l'écran ; sinon touchez d'abord <strong>⋯</strong> en bas à droite). Faites glisser la liste vers le haut, choisissez <strong>« Sur l'écran d'accueil »</strong>, puis <strong>« Ajouter »</strong>.<br/>
      • <strong>Android</strong> : dans <strong>Chrome</strong>, touchez les trois points <strong>⋮</strong> en haut à droite, puis <strong>« Installer l'application »</strong> (ou « Ajouter à l'écran d'accueil »), puis <strong>« Installer »</strong>.<br/>
      Le guide illustré, pas à pas : <a href="${SITE_URL}/installer" style="color: #8B6FAA; font-weight: 600;">holiris.fr/installer</a>
    </div>
  `
}

// Présentation de Holiris pour les nouveaux membres
function commentCaMarche(type, seniorName) {
  const intro = type === 'intervenant'
    ? `Holiris permet à la famille de ${seniorName} de suivre son quotidien grâce à vos retours, sans multiplier les appels.`
    : `Holiris réunit en un seul endroit les nouvelles de ${seniorName} : les intervenants à domicile partagent leurs observations après chaque passage, et toute la famille reste informée.`
  const etapes = type === 'intervenant'
    ? etape('🎙', 'Après chaque passage, une note', `Quelques secondes suffisent : moral, repas, activités, ce que vous avez remarqué. Trois façons de la transmettre :${moyensNote('intervenant')}`)
      + etape('✨', 'L\'IA s\'occupe du reste', 'Votre message est transformé en note claire que la famille retrouve sur son tableau de bord. Un signal inquiétant déclenche une alerte.')
      + etape('🔔', 'Un rappel bienveillant', 'Si nous n\'avons pas eu de nouvelles après un passage, vous recevez un petit rappel le vendredi.')
    : etape('📋', 'Suivez le fil des nouvelles', 'Notes des intervenants, agenda des passages et alertes en cas de signal inquiétant (moral, alimentation, chute…).')
      + etape('✍️', 'Partagez vos propres nouvelles', `Après une visite ou un appel, ajoutez une note : toute la famille est informée. Trois façons de le faire :${moyensNote('famille')}`)
      + etape('📬', 'Un résumé chaque semaine', 'Chaque dimanche, un résumé de la semaine vous est envoyé par email.')
  return `
    <div style="border-top: 1px solid #eee; padding-top: 24px; margin-bottom: 8px;">
      <p style="font-size: 12px; color: #5a8a6a; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 12px;">Holiris, comment ça marche ?</p>
      ${paragraphe(intro)}
      <table role="presentation" cellpadding="0" cellspacing="0" style="width: 100%; border-collapse: collapse;">
        ${etapes}
      </table>
    </div>
  `
}

// Les paramètres texte (prenom, role, seniorName…) doivent déjà être échappés avec escapeHtml

export function emailNouveauCompte({ prenom, role, seniorName, token, email, type, relance = false, desinscription = null }) {
  const lien = `${SITE_URL}/rejoindre?token=${token}&type=${type}&email=${encodeURIComponent(email)}`
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`${relance ? 'Petit rappel : vous' : 'Vous'} avez été invité(e) à rejoindre <strong>Holiris</strong> pour le suivi de <strong>${seniorName}</strong> ${enTantQue(role)}.`)}
    ${paragraphe(type === 'intervenant'
      ? `Créez votre compte Holiris avec cette adresse email pour accéder à l'agenda et à l'espace de ${seniorName}. Votre accès sera activé automatiquement.`
      : `Pour accéder à l'espace de ${seniorName}, commencez par créer votre compte Holiris avec cette adresse email. Votre accès sera activé automatiquement.`, 24)}
    ${bouton(lien, 'Créer mon compte →')}
    ${commentCaMarche(type, seniorName)}
    ${blocApplication()}
    ${type === 'intervenant' ? rappelIntervenant : ''}
  `, desinscription)
}

export function emailCompteExistant({ prenom, role, seniorName, type }) {
  const espace = type === 'intervenant' ? '/espace-intervenant' : '/app'
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`Vous avez été ajouté(e) au suivi de <strong>${seniorName}</strong> ${enTantQue(role)}.`)}
    ${paragraphe(`Ce nouvel espace est déjà rattaché à votre compte Holiris. Connectez-vous puis sélectionnez <strong>${seniorName}</strong> dans le menu « Dossier actif » pour passer d'un senior à l'autre.`, 24)}
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent(espace)}`, 'Accéder à l\'espace →')}
    ${blocApplication()}
    ${type === 'intervenant' ? rappelIntervenant : ''}
  `)
}

export function emailRelanceIntervenant({ prenom, seniorNames, desinscription }) {
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`Vous êtes intervenu(e) cette semaine auprès de <strong>${seniorNames.join('</strong>, <strong>')}</strong>. Nous n'avons pas encore reçu de vos nouvelles.`)}
    ${paragraphe(`Quelques mots suffisent : moral, activités, ce que vous avez remarqué. Au choix :${moyensNote('intervenant')}`, 24)}
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent('/espace-intervenant')}`, 'Donner des nouvelles →')}
    ${rappelIntervenant}
  `, desinscription)
}

export function emailRelanceFamille({ prenom, seniorNames, desinscription }) {
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`Avez-vous eu des nouvelles de <strong>${seniorNames.join('</strong>, <strong>')}</strong> cette semaine ? Une visite, un appel, un moment partagé… Partagez-le avec la famille et l'équipe qui l'accompagne.`)}
    ${paragraphe(`Quelques mots suffisent. Au choix :${moyensNote('famille')}`, 24)}
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent('/note')}`, 'Donner des nouvelles →')}
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

// ── Demandes d'accès ──

export function emailNouvelleDemande({ prenom, nom, email, telephone, seniorNom, seniorVille, lien, message }) {
  const ligne = (label, valeur) => valeur ? `<strong style="color: #1E2820;">${label}</strong> : ${valeur}<br/>` : ''
  return emailLayout(`
    ${bonjour('')}
    ${paragraphe(`Une nouvelle demande d'accès à Holiris attend votre validation.`)}
    <div style="background: #f0f9f4; border: 1px solid #b8d8bc; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px; font-size: 14px; line-height: 1.8; color: #555;">
      ${ligne('Demandeur', `${prenom} ${nom}`)}
      ${ligne('Email', email)}
      ${ligne('Téléphone', telephone)}
      ${ligne('Proche concerné', [seniorNom, seniorVille].filter(Boolean).join(', '))}
      ${ligne('Lien', lien)}
      ${ligne('Message', message)}
    </div>
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent('/admin')}`, 'Voir les demandes →')}
  `)
}

export function emailDemandeValidee({ prenom, jeton, email }) {
  const lien = `${SITE_URL}/login?signup=true&type=demande&jeton=${jeton}&email=${encodeURIComponent(email)}`
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`Bonne nouvelle : votre demande d'accès à <strong>Holiris</strong> a été validée.`)}
    ${paragraphe(`Créez votre compte avec cette adresse email, puis créez le dossier de votre proche. Vous pourrez ensuite inviter les membres de la famille et les intervenants à domicile.`, 24)}
    ${bouton(lien, 'Créer mon compte →')}
    ${commentCaMarche('famille', 'votre proche')}
    ${blocApplication()}
  `)
}

// ── Structures ──

export function emailGestionnaire({ prenom, structureNom, jeton, email }) {
  const lien = jeton
    ? `${SITE_URL}/login?signup=true&type=structure&jeton=${jeton}&email=${encodeURIComponent(email)}`
    : `${SITE_URL}/login?redirect=${encodeURIComponent('/structure')}`
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`Vous êtes désormais gestionnaire de <strong>${structureNom}</strong> sur Holiris.`)}
    ${paragraphe(`Depuis l'espace « Ma structure », vous créez le dossier de chaque client accompagné, la fiche de chaque salarié intervenant, et vous suivez les notes et les alertes de tous vos clients au même endroit.`, 24)}
    ${bouton(lien, jeton ? 'Créer mon compte →' : 'Accéder à ma structure →')}
    ${jeton ? paragraphe('Créez votre compte avec cette adresse email : votre accès sera activé automatiquement.') : ''}
  `)
}

// ── Médecin traitant ──

// Lien personnel pour qu'un médecin laisse une note sans compte (signé, avec date d'expiration)
export function lienNoteMedecin(intervenantId, seniorId, expire) {
  const charge = Buffer.from(JSON.stringify({ i: intervenantId, s: seniorId, e: expire })).toString('base64url')
  const sig = createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update('note-medecin:' + charge).digest('base64url')
  return `${SITE_URL}/note-medecin?t=${charge}.${sig}`
}

// Renvoie { intervenantId, seniorId } si le lien est authentique et encore valable, sinon null
export function lireJetonMedecin(jeton) {
  const [charge, sig] = String(jeton || '').split('.')
  if (!charge || !sig) return null
  const attendu = Buffer.from(createHmac('sha256', process.env.SUPABASE_SERVICE_ROLE_KEY).update('note-medecin:' + charge).digest('base64url'))
  const recu = Buffer.from(sig)
  if (attendu.length !== recu.length || !timingSafeEqual(attendu, recu)) return null
  try {
    const { i, s, e } = JSON.parse(Buffer.from(charge, 'base64url').toString())
    if (!i || !s || Date.now() > e) return null
    return { intervenantId: i, seniorId: s }
  } catch { return null }
}

// Les paramètres texte doivent déjà être échappés avec escapeHtml
export function emailCompteRendu({ prenomMedecin, seniorName, dateConsultation, depuis, resume, alertes, notes, lienNote, desinscription }) {
  const blocAlertes = alertes.length ? `
    <p style="font-size: 12px; color: #c4844a; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 8px;">Alertes de la période</p>
    <div style="margin-bottom: 20px;">
      ${alertes.map(a => `<p style="font-size: 14px; color: #555; margin: 0 0 6px; line-height: 1.5;"><strong style="color: ${a.urgent ? '#C4606A' : '#c4844a'};">${a.urgent ? 'Urgent' : 'À surveiller'}</strong> · ${a.date} · ${a.message}</p>`).join('')}
    </div>` : ''
  const blocNotes = notes.length ? `
    <p style="font-size: 12px; color: #5a8a6a; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 8px;">Dernières notes</p>
    <div style="margin-bottom: 24px;">
      ${notes.map(n => `<p style="font-size: 13px; color: #555; margin: 0 0 8px; line-height: 1.5;"><span style="color: #999;">${n.date} · ${n.auteur}</span><br/>${n.contenu}</p>`).join('')}
    </div>` : ''
  return emailLayout(`
    <p style="font-size: 16px; color: #1E2820; margin-bottom: 16px;">Bonjour Docteur${prenomMedecin ? ' ' + prenomMedecin : ''},</p>
    ${paragraphe(`Vous voyez <strong>${seniorName}</strong> demain, <strong>${dateConsultation}</strong>. Voici ce que ses proches et ses intervenants ont partagé sur Holiris ${depuis}.`)}
    <div style="background: #f0f9f4; border: 1px solid #b8d8bc; border-radius: 8px; padding: 18px 20px; margin-bottom: 24px;">
      <p style="font-size: 12px; color: #5a8a6a; letter-spacing: 0.15em; text-transform: uppercase; margin: 0 0 8px;">En résumé</p>
      <p style="font-size: 14px; color: #333; line-height: 1.7; margin: 0;">${resume}</p>
    </div>
    ${blocAlertes}
    ${blocNotes}
    <div style="border-top: 1px solid #eee; padding-top: 22px; margin-bottom: 8px;">
      ${paragraphe(`<strong>Après la consultation, pourriez-vous laisser une courte note pour rassurer la famille ?</strong> Quelques mots suffisent : l'état général, le moral, ce qu'il faut surveiller. Aucun compte n'est nécessaire.`)}
      ${bouton(lienNote, 'Enregistrer une note →')}
      <div style="background: #fef9ec; border-left: 3px solid #c4844a; padding: 12px 14px; border-radius: 0 4px 4px 0; margin-bottom: 16px;">
        <p style="font-size: 13px; color: #555; line-height: 1.6; margin: 0;"><strong style="color: #c4844a;">Merci de ne pas communiquer d'information médicale</strong> (diagnostic, traitement, résultats), sauf si elle est essentielle. Dans ce cas, elle ne sera pas enregistrée sur Holiris : la personne de confiance de la famille vous recontactera pour en parler.</p>
      </div>
      <p style="font-size: 12px; color: #999; line-height: 1.6; margin: 0 0 20px;">Ce lien vous est personnel et reste valable quelques jours après la consultation.</p>
    </div>
  `, desinscription)
}

// ── Messages ──

export function emailNouveauMessage({ prenom, auteurNom, auteurRole, seniorName, extrait, desinscription }) {
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`<strong>${auteurNom}</strong>${auteurRole ? ` (${auteurRole})` : ''} a écrit dans le fil de <strong>${seniorName}</strong> :`)}
    <div style="background: #f0f9f4; border-left: 3px solid #7FAF9B; border-radius: 0 8px 8px 0; padding: 14px 18px; margin-bottom: 24px;">
      <p style="font-size: 14px; color: #333; line-height: 1.7; margin: 0; font-style: italic;">« ${extrait} »</p>
    </div>
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent('/messages')}`, 'Lire et répondre →')}
    ${paragraphe(`<span style="font-size: 12px; color: #999;">Pour ne pas vous déranger à chaque message, vous recevez au plus un email par heure pour ce fil.</span>`)}
  `, desinscription)
}

// Bouton SOS de la borne : envoyé à toute la famille, sans tenir compte des désinscriptions (urgence)
export function emailSos({ prenom, seniorName, heure, auto, lienVisio }) {
  return emailLayout(`
    ${bonjour(prenom)}
    <div style="background: #fdecee; border-left: 3px solid #C4606A; border-radius: 0 8px 8px 0; padding: 16px 18px; margin-bottom: 24px;">
      <p style="font-size: 16px; color: #8E2F38; margin: 0; font-weight: 600;">🆘 ${seniorName} a demandé de l'aide depuis la borne à ${heure}.</p>
      ${auto ? `<p style="font-size: 13px; color: #8E2F38; margin: 8px 0 0;">La demande n'a été ni confirmée ni annulée sur la borne : l'alerte est partie automatiquement.</p>` : ''}
    </div>
    ${paragraphe(`Appelez ${seniorName} ou rendez-vous sur place dès que possible.`)}
    ${lienVisio ? `
    ${bouton(lienVisio, `📹 Voir et entendre ${seniorName}`)}
    ${paragraphe(`<span style="font-size: 13px; color: #666;">Ce lien active la caméra et le micro de la borne, et vous permet de parler à ${seniorName}. Il est personnel, ne fonctionne qu'une seule fois et expire 30 minutes après l'alerte.</span>`)}` : ''}
    ${paragraphe(`<strong>Si ${seniorName} ne répond pas et que la situation semble grave, appelez le 15 (SAMU) ou le 112.</strong>`)}
    ${paragraphe(`<a href="${SITE_URL}/login?redirect=${encodeURIComponent('/app')}" style="color: #4A8870;">Ouvrir le tableau de bord</a>`)}
    ${paragraphe(`<span style="font-size: 12px; color: #999;">Toute la famille a reçu ce message. Holiris ne prévient pas les secours.</span>`)}
  `)
}

export function emailDocumentSigne({ prenom, titre, seniorName, signataire, date }) {
  return emailLayout(`
    ${bonjour(prenom)}
    ${paragraphe(`Le document <strong>« ${titre} »</strong> a été signé électroniquement pour <strong>${seniorName}</strong> par ${signataire}, le ${date}.`)}
    ${paragraphe('Vous le trouverez en pièce jointe. Il reste aussi consultable dans la page Documents de votre espace Holiris.')}
    ${bouton(`${SITE_URL}/login?redirect=${encodeURIComponent('/documents')}`, 'Voir les documents →')}
  `)
}

export function emailMotDePasse({ lien }) {
  return emailLayout(`
    ${bonjour('')}
    ${paragraphe('Vous avez demandé à réinitialiser votre mot de passe Holiris. Cliquez sur le bouton ci-dessous pour en choisir un nouveau.')}
    ${bouton(lien, 'Choisir un nouveau mot de passe →')}
    ${paragraphe(`<span style="font-size: 12px; color: #999;">Ce lien est valable une heure. Si vous n'êtes pas à l'origine de cette demande, ignorez simplement cet email : votre mot de passe reste inchangé.</span>`)}
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
