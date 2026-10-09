// Notifications sur téléphone (web push), en plus des emails. Sans clés VAPID configurées, rien n'est envoyé.
import webpush from 'web-push'
import { supabaseAdmin } from '@/lib/serveur'

const actif = !!(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
if (actif) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@holiris.fr',
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY)
}

// cibles : { userIds?: string[], jetons?: string[] } ; contenu : { title, body, url, tag }
// Une notification n'empêche jamais l'action qui la déclenche : les erreurs sont seulement journalisées.
export async function envoyerPush({ userIds = [], jetons = [] }, contenu) {
  if (!actif) return 0
  try {
    const ids = [...new Set(userIds.filter(Boolean))]
    const jts = [...new Set(jetons.filter(Boolean))]
    if (!ids.length && !jts.length) return 0
    const filtres = []
    if (ids.length) filtres.push(`user_id.in.(${ids.join(',')})`)
    if (jts.length) filtres.push(`jeton_mobile.in.(${jts.map(j => `"${j}"`).join(',')})`)
    const { data: abonnements } = await supabaseAdmin.from('push_abonnements')
      .select('id, endpoint, p256dh, auth').or(filtres.join(','))
    if (!abonnements?.length) return 0

    const charge = JSON.stringify(contenu)
    let envoyes = 0
    await Promise.all(abonnements.map(async a => {
      try {
        await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } }, charge, { TTL: 24 * 3600 })
        envoyes++
      } catch (e) {
        // Abonnement expiré ou retiré par le téléphone : on l'oublie
        if (e.statusCode === 404 || e.statusCode === 410) await supabaseAdmin.from('push_abonnements').delete().eq('id', a.id)
        else console.error('Notification téléphone:', e.statusCode, e.body || e.message)
      }
    }))
    return envoyes
  } catch (e) {
    console.error('Notifications téléphone:', e.message)
    return 0
  }
}

// Diagnostic : notification de test vers les appareils d'un compte, avec le détail de ce qui bloque
export async function testerPush(userId) {
  const config = {
    clePublique: !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    clePrivee: !!process.env.VAPID_PRIVATE_KEY,
    sujet: process.env.VAPID_SUBJECT || null,
  }
  if (!actif) return { actif: false, config }
  const { data: abonnements } = await supabaseAdmin.from('push_abonnements').select('id, endpoint, p256dh, auth').eq('user_id', userId)
  const resultats = await Promise.all((abonnements || []).map(async a => {
    try {
      const r = await webpush.sendNotification({ endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
        JSON.stringify({ title: '🔔 Test Holiris', body: 'Les notifications fonctionnent sur cet appareil.', url: '/' }), { TTL: 3600 })
      return { service: new URL(a.endpoint).host, statut: r.statusCode }
    } catch (e) {
      return { service: new URL(a.endpoint).host, statut: e.statusCode || null, erreur: String(e.body || e.message).slice(0, 200) }
    }
  }))
  return { actif: true, config, abonnements: resultats }
}

// Comptes qui suivent un senior : proches, intervenants avec compte, gestionnaires de sa structure
export async function comptesDuSenior(seniorId, { famille = true, intervenants = true, structure = true } = {}) {
  const { data: senior } = await supabaseAdmin.from('seniors').select('structure_id').eq('id', seniorId).maybeSingle()
  const [{ data: fam }, { data: interv }, { data: gest }] = await Promise.all([
    famille ? supabaseAdmin.from('famille').select('user_id').eq('senior_id', seniorId).is('archived_at', null).not('user_id', 'is', null) : { data: [] },
    intervenants ? supabaseAdmin.from('intervenants').select('user_id').eq('senior_id', seniorId).is('archived_at', null).not('user_id', 'is', null) : { data: [] },
    structure && senior?.structure_id ? supabaseAdmin.from('structure_membres').select('user_id').eq('structure_id', senior.structure_id).not('user_id', 'is', null) : { data: [] },
  ])
  return [...(fam || []), ...(interv || []), ...(gest || [])].map(p => p.user_id)
}
