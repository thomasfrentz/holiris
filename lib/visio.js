// Visio après un SOS (côté serveur uniquement)
import { createHash, randomBytes } from 'crypto'
import { supabaseAdmin } from '@/lib/serveur'
import { SITE_URL } from '@/lib/emails'

export const VALIDITE_LIEN = 30 * 60 * 1000
export const DUREE_MAX = 15 * 60 * 1000

const empreinte = jeton => createHash('sha256').update(String(jeton)).digest('hex')

// Un lien par proche, créé au moment du SOS
export async function creerLienVisio(seniorId, prenom) {
  const jeton = randomBytes(24).toString('base64url')
  const { error } = await supabaseAdmin.from('visio_sos').insert({
    senior_id: seniorId,
    jeton_hash: empreinte(jeton),
    destinataire: prenom || 'Un proche',
    canal: randomBytes(16).toString('hex'),
    expire_at: new Date(Date.now() + VALIDITE_LIEN).toISOString(),
  })
  if (error) throw error
  return `${SITE_URL}/visio?t=${jeton}`
}

// Consomme le lien : une seule utilisation, avant expiration, une seule visio à la fois par senior
export async function utiliserLienVisio(jeton) {
  const { data: lien } = await supabaseAdmin.from('visio_sos')
    .select('id, senior_id, canal, destinataire, expire_at, utilise_at, seniors(name)')
    .eq('jeton_hash', empreinte(jeton)).maybeSingle()
  if (!lien) return { erreur: 'Lien invalide.' }
  if (lien.utilise_at) return { erreur: 'Ce lien a déjà été utilisé.' }
  if (new Date(lien.expire_at) < new Date()) return { erreur: 'Ce lien a expiré (30 minutes après l\'alerte).' }
  if (await visioEnCours(lien.senior_id)) return { erreur: 'Un autre proche est déjà en visio avec la borne.' }

  // Mise à jour conditionnelle : deux ouvertures simultanées du même lien ne passent pas toutes les deux
  const { data: pris } = await supabaseAdmin.from('visio_sos')
    .update({ utilise_at: new Date().toISOString() }).eq('id', lien.id).is('utilise_at', null).select('id')
  if (!pris?.length) return { erreur: 'Ce lien a déjà été utilisé.' }
  return { canal: lien.canal, seniorName: lien.seniors?.name || '', prenom: lien.destinataire }
}

export async function visioEnCours(seniorId) {
  const { data } = await supabaseAdmin.from('visio_sos')
    .select('canal, destinataire, utilise_at')
    .eq('senior_id', seniorId).is('termine_at', null).not('utilise_at', 'is', null)
    .gte('utilise_at', new Date(Date.now() - DUREE_MAX).toISOString())
    .order('utilise_at', { ascending: false }).limit(1)
  return data?.[0] || null
}

export async function terminerVisio(canal) {
  await supabaseAdmin.from('visio_sos').update({ termine_at: new Date().toISOString() }).eq('canal', canal).is('termine_at', null)
}

// Serveurs de connexion : relais Cloudflare si configuré (réseaux mobiles), sinon STUN public seul
export async function serveursIce() {
  const stun = [{ urls: 'stun:stun.l.google.com:19302' }]
  const { CLOUDFLARE_TURN_KEY_ID: id, CLOUDFLARE_TURN_API_TOKEN: token } = process.env
  if (!id || !token) return stun
  try {
    const res = await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${id}/credentials/generate`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ ttl: 3600 }),
    })
    const { iceServers } = await res.json()
    return iceServers ? [...stun, iceServers] : stun
  } catch (error) {
    console.error('Relais TURN indisponible:', error.message)
    return stun
  }
}
