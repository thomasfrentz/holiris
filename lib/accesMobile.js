// Borne sur téléphone : accès sans compte d'un intervenant, par un lien personnel (jeton).
// Un même lien couvre toutes les fiches du même numéro de téléphone (un salarié suivi chez plusieurs seniors).
// Le lien permet seulement de laisser des notes et de lire les messages adressés à l'intervenant.
import { randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/serveur'
import { numeroWhatsapp } from '@/lib/whatsapp'

const numeroDe = f => numeroWhatsapp(f.whatsapp || f.phone)
const nouveauJeton = () => randomBytes(24).toString('base64url')

// Fiches actives dont le numéro correspond (les numéros sont saisis dans des formats variés)
async function fichesDesNumeros(numeros) {
  if (!numeros.length) return []
  const { data } = await supabaseAdmin.from('intervenants').select('id, phone, whatsapp, jeton_mobile, user_id')
    .is('archived_at', null).or('phone.not.is.null,whatsapp.not.is.null')
  return (data || []).filter(f => numeros.includes(numeroDe(f)))
}

// Choix « Utiliser sans compte » depuis le lien d'invitation : renvoie le jeton de la borne sur téléphone
export async function jetonDepuisInvitation(invitation) {
  const { data: fiche } = await supabaseAdmin.from('intervenants').select('id, phone, whatsapp, jeton_mobile')
    .eq('invite_token', invitation).is('archived_at', null).maybeSingle()
  if (!fiche) return null
  const numero = numeroDe(fiche)
  const groupe = numero ? await fichesDesNumeros([numero]) : []
  const jeton = fiche.jeton_mobile || groupe.find(f => f.jeton_mobile)?.jeton_mobile || nouveauJeton()
  const ids = [...new Set([fiche.id, ...groupe.filter(f => !f.jeton_mobile || f.jeton_mobile === jeton).map(f => f.id)])]
  await supabaseAdmin.from('intervenants').update({ jeton_mobile: jeton }).in('id', ids)
  return jeton
}

// Fiches couvertes par un jeton ; les nouvelles fiches du même numéro y sont rattachées au passage
export async function fichesDuJeton(jeton) {
  if (!jeton || jeton.length < 24) return []
  const lire = () => supabaseAdmin.from('intervenants')
    .select('id, name, role, phone, whatsapp, senior_id, seniors!intervenants_senior_id_fkey(name)')
    .eq('jeton_mobile', jeton).is('archived_at', null).order('created_at')
  let { data: fiches } = await lire()
  if (!fiches?.length) return []
  const numeros = [...new Set(fiches.map(numeroDe).filter(Boolean))]
  const nouvelles = (await fichesDesNumeros(numeros)).filter(f => !f.jeton_mobile)
  if (nouvelles.length) {
    await supabaseAdmin.from('intervenants').update({ jeton_mobile: jeton }).in('id', nouvelles.map(f => f.id))
    fiches = (await lire()).data || fiches
  }
  return fiches
}

// La fiche appartient-elle bien à ce jeton et à ce senior ?
export async function ficheAutorisee(jeton, ficheId, seniorId) {
  if (!jeton || !ficheId) return false
  const { data } = await supabaseAdmin.from('intervenants').select('id')
    .eq('id', ficheId).eq('jeton_mobile', jeton).eq('senior_id', seniorId).is('archived_at', null).maybeSingle()
  return !!data
}

// Téléphone perdu : le lien de la borne sur téléphone et le lien WhatsApp d'invitation cessent de fonctionner
// pour toutes les fiches qui partagent ce jeton
export async function couperAcces(ficheId) {
  const { data: fiche } = await supabaseAdmin.from('intervenants').select('jeton_mobile').eq('id', ficheId).maybeSingle()
  if (!fiche?.jeton_mobile) return
  const { data: groupe } = await supabaseAdmin.from('intervenants').select('id, user_id, email')
    .eq('jeton_mobile', fiche.jeton_mobile)
  for (const f of groupe || []) {
    await supabaseAdmin.from('intervenants').update({
      jeton_mobile: null,
      // Fiche sans compte ni email : l'invitation WhatsApp changera au prochain envoi
      ...(!f.user_id && !f.email ? { invite_token: null } : {}),
    }).eq('id', f.id)
  }
}
