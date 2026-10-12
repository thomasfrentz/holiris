// Modèles de documents à signer par le senior (côté serveur uniquement).
// ⚠️ Textes types, à faire relire par un juriste avant usage réel. Changer le texte → changer la version.
import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin, peutGererSenior } from '@/lib/serveur'

export const AUTORISATIONS = [
  { cle: 'partage', libelle: 'Partager mes nouvelles (notes, agenda, alertes) avec les proches et les intervenants inscrits sur mon dossier Holiris.' },
  { cle: 'borne', libelle: 'Installer une borne Holiris à mon domicile, sur laquelle mes proches et intervenants enregistrent des notes vocales.' },
  { cle: 'visio', libelle: 'Après une alerte SOS, permettre à un proche d’activer à distance la caméra et le micro de la borne pendant 15 minutes au plus, pour me voir et m’entendre.' },
  { cle: 'whatsapp', libelle: 'Permettre à mes proches et intervenants d’envoyer leurs nouvelles me concernant par WhatsApp.' },
]

const MODELES = {
  cgu: {
    titre: 'Conditions générales d’utilisation de Holiris',
    version: '1.0',
    sections: ({ senior }) => [
      { titre: 'Objet', texte: `Holiris est un service qui permet aux proches et aux intervenants à domicile de ${senior} de partager des nouvelles de son quotidien (moral, repas, activités, visites), afin que toute la famille reste informée.` },
      { titre: 'Données concernées', texte: 'Holiris enregistre les notes laissées après les visites, l’agenda des passages, les alertes et les messages échangés entre les proches et les intervenants. Holiris n’a pas vocation à recevoir d’informations médicales (diagnostic, traitement, résultat d’examen) : elles sont filtrées et ne sont pas publiées.' },
      { titre: 'Qui y a accès', texte: 'Seules les personnes inscrites sur le dossier (proches, intervenants et, le cas échéant, la structure d’aide à domicile) peuvent consulter ces informations. Elles ne sont jamais vendues ni transmises à des tiers à des fins commerciales.' },
      { titre: 'Notes vocales', texte: 'Les messages vocaux sont transformés en texte par un service de transcription automatique. L’enregistrement audio n’est pas conservé après la transcription.' },
      { titre: 'Durée et arrêt', texte: 'Le service peut être arrêté à tout moment, à la demande de la personne suivie ou de son représentant. Les données du dossier sont alors supprimées.' },
      { titre: 'Vos droits', texte: 'Conformément au RGPD, vous pouvez accéder à vos données, les faire rectifier ou supprimer, et vous opposer à leur traitement, en écrivant à thomas.frentz@holiris.fr. Vous pouvez aussi adresser une réclamation à la CNIL.' },
      { titre: 'Responsable', texte: 'Holiris — Thomas Frentz, thomas.frentz@holiris.fr, 06 71 78 52 31.' },
    ],
    engagement: 'J’ai lu les conditions générales d’utilisation de Holiris et je les accepte.',
  },
  autorisations: {
    titre: 'Autorisations',
    version: '1.0',
    sections: ({ senior }) => [
      { texte: `Pour chacun des points ci-dessous, ${senior} indique s’il ou elle donne son accord. Chaque autorisation peut être retirée à tout moment, sur simple demande à thomas.frentz@holiris.fr ou en signant de nouvelles autorisations.` },
    ],
    autorisations: AUTORISATIONS,
    engagement: 'Je confirme les choix indiqués ci-dessus.',
  },
  convention_pret: {
    titre: 'Convention de prêt de la borne Holiris',
    version: '1.0',
    sections: ({ senior }) => [
      { texte: `Entre Thomas Frentz, porteur du projet Holiris (thomas.frentz@holiris.fr, 06 71 78 52 31), ci-après « Holiris », et ${senior}, ci-après « le bénéficiaire ». Prêt à usage gratuit (articles 1875 et suivants du Code civil) pendant la phase pilote.` },
      { titre: '1. Objet', texte: 'Holiris prête gratuitement au bénéficiaire une borne Holiris installée à son domicile. La borne reste la propriété de Holiris ; le bénéficiaire en a l’usage, il n’en devient pas propriétaire.' },
      { titre: '2. Matériel prêté', texte: 'Une tablette tactile Nakalzz 10 pouces (modèle « Tablette-2025 », wifi), avec sa coque de protection, son chargeur et son câble. Valeur indicative : 85 € TTC. Le numéro de série et l’état du matériel sont relevés le jour de l’installation.' },
      { titre: '3. Durée', texte: 'Le prêt commence le jour de l’installation, pour une durée de deux mois. À l’issue du pilote, Holiris communiquera ses conditions pour la suite ; le bénéficiaire reste libre de ne pas poursuivre, sans frais ni engagement. Chacun peut mettre fin au prêt à tout moment, par simple message.' },
      { titre: '4. Installation et accompagnement', texte: 'Holiris installe et configure la borne, explique son fonctionnement au bénéficiaire et à ses proches, et reste joignable pendant toute la durée du prêt. L’installation, le déplacement et l’accompagnement sont gratuits. Le bénéficiaire fournit une prise électrique et l’accès à sa connexion internet (wifi). La borne reste branchée en permanence ; sa consommation électrique est faible.' },
      { titre: '5. Ce que permet la borne', texte: 'Les intervenants y enregistrent une courte note vocale après leur passage, retranscrite en texte et transmise à la famille ; le micro ne s’active que lorsqu’une personne appuie sur « Enregistrer une note ». Les proches peuvent envoyer des messages écrits ou vocaux, lus ou écoutés sur l’écran. Le bouton SOS prévient les proches inscrits.' },
      { titre: '6. Limites du bouton SOS', texte: 'La borne Holiris n’est pas un service de téléassistance : aucun plateau d’écoute ne surveille les alertes 24 heures sur 24. Le bouton SOS prévient uniquement les proches inscrits, qui peuvent ne pas être disponibles immédiatement. En cas de coupure d’électricité ou d’internet, l’alerte peut ne pas partir. En cas d’urgence, appelez le 15, le 112 ou le 114 (par SMS).' },
      { titre: '7. Caméra et micro après un SOS', texte: 'Si le bénéficiaire l’a accepté dans le document « Autorisations », un proche prévenu peut, dans les 30 minutes qui suivent un SOS, activer la caméra et le micro de la borne pour le voir et l’entendre. Un bandeau « Caméra et micro activés » reste affiché, un bouton permet d’arrêter à tout moment, et l’appel s’arrête de lui-même au bout de 15 minutes. Rien n’est enregistré.' },
      { titre: '8. Données personnelles', texte: 'Les informations ne sont visibles que par les personnes invitées dans le dossier. Les messages vocaux des proches sont supprimés après écoute, ou au plus tard après 7 jours. Le détail figure dans les conditions générales d’utilisation de Holiris. Le bénéficiaire ou ses proches informent les intervenants de la présence de la borne.' },
      { titre: '9. Engagements du bénéficiaire', texte: 'Utiliser la borne à son domicile pour l’usage prévu et en prendre soin raisonnablement ; ne pas la prêter, la vendre ni la déplacer hors du domicile ; ne pas y installer d’autres applications ; prévenir Holiris rapidement en cas de panne, de casse, de perte ou de vol.' },
      { titre: '10. Pannes, casse, perte', texte: 'Les pannes et l’usure normale sont à la charge de Holiris, qui répare ou remplace la borne. Pendant la phase pilote, aucune somme n’est demandée en cas de casse accidentelle. En cas de perte, de vol ou de dégradation volontaire, Holiris pourra demander le remboursement de la valeur indiquée à l’article 2.' },
      { titre: '11. Fin du prêt', texte: 'À la fin du prêt, Holiris reprend gratuitement la borne au domicile dans un délai de 15 jours, à une date convenue ensemble. La borne est déconnectée du dossier et réinitialisée : aucune information personnelle n’y reste.' },
      { titre: '12. Responsabilité', texte: 'Holiris fait ses meilleurs efforts pour assurer le bon fonctionnement de la borne. Holiris ne peut être tenu responsable d’une interruption due à une coupure d’électricité ou d’internet, ni d’une mauvaise utilisation du matériel. Holiris ne remplace ni un avis médical, ni les services d’urgence, ni une téléassistance.' },
    ],
    engagement: 'J’ai lu la convention de prêt de la borne Holiris et je l’accepte.',
  },
  personne_confiance: {
    titre: 'Désignation de la personne de confiance',
    version: '1.0',
    sections: ({ senior, pdc }) => [
      { texte: `${senior} désigne ${pdc.nom}${pdc.lien ? ` (${pdc.lien})` : ''} comme personne de confiance dans le cadre du service Holiris.` },
      { titre: 'Rôle', texte: `Si une information médicale concernant ${senior} est transmise à Holiris par un proche ou un intervenant, elle n’est pas publiée : c’est la personne de confiance qui est prévenue et qui prend contact avec l’auteur pour en savoir plus.` },
      { titre: 'Révocation', texte: 'Cette désignation peut être modifiée ou révoquée à tout moment, sur simple demande.' },
    ],
    engagement: 'Je confirme cette désignation.',
  },
}

export const TYPES = Object.keys(MODELES)
export const titreDocument = type => MODELES[type]?.titre

// Texte exact du document pour ce senior (figé au moment de la préparation, signé tel quel)
export async function composerDocument(type, seniorId) {
  const modele = MODELES[type]
  if (!modele) return { erreur: 'Type de document inconnu' }
  const { data: s } = await supabaseAdmin.from('seniors').select('name, personne_confiance_id').eq('id', seniorId).single()
  let pdc = null
  if (type === 'personne_confiance') {
    if (!s.personne_confiance_id) return { erreur: 'Désignez d’abord la personne de confiance dans la page Famille.' }
    const { data: f } = await supabaseAdmin.from('famille').select('id, name, role').eq('id', s.personne_confiance_id).single()
    pdc = { id: f.id, nom: f.name, lien: f.role }
  }
  return {
    contenu: {
      titre: modele.titre,
      version: modele.version,
      senior: s.name,
      sections: modele.sections({ senior: s.name, pdc }),
      autorisations: modele.autorisations || null,
      engagement: modele.engagement,
      ...(pdc ? { personneConfiance: pdc } : {}),
    },
  }
}

export const empreinte = valeur => createHash('sha256').update(typeof valeur === 'string' ? valeur : JSON.stringify(valeur)).digest('hex')
export const nouveauJeton = () => randomBytes(24).toString('base64url')

// Préparer une signature ou consulter les documents : proche du dossier, gestionnaire de la structure ou admin
export async function peutGererDocuments(userId, seniorId) {
  const { data } = await supabaseAdmin.from('famille').select('id').eq('user_id', userId).eq('senior_id', seniorId).is('archived_at', null).limit(1)
  return !!data?.length || await peutGererSenior(userId, seniorId)
}

// Dernières autorisations signées pour ce senior (null si aucune)
export async function autorisationsSignees(seniorId) {
  const { data } = await supabaseAdmin.from('documents_signes').select('choix')
    .eq('senior_id', seniorId).eq('type', 'autorisations').eq('statut', 'signe').order('signe_at', { ascending: false }).limit(1)
  return data?.[0]?.choix || null
}
