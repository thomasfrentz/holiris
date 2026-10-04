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
