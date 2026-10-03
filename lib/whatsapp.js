// Envoi de modèles WhatsApp (API Meta) — côté serveur uniquement
import { supabaseAdmin } from '@/lib/serveur'
import { SITE_URL } from '@/lib/emails'

// « 06 12 34 56 78 » ou « +33 6 12… » → « 33612345678 » (format attendu par l'API WhatsApp)
export function numeroWhatsapp(numero) {
  const n = String(numero || '').replace(/[\s.-]/g, '')
  if (!n) return null
  if (n.startsWith('+')) return n.slice(1)
  if (n.startsWith('00')) return n.slice(2)
  if (n.startsWith('0')) return '33' + n.slice(1)
  return n
}

// Renvoie true si Meta accepte l'envoi ; sinon false, avec la raison dans derniereErreurWhatsapp
export let derniereErreurWhatsapp = null

export async function envoyerModele(numero, modele, variables) {
  try {
    const res = await fetch('https://graph.facebook.com/v18.0/' + process.env.META_PHONE_NUMBER_ID + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'template',
        template: {
          name: modele,
          language: { code: 'fr' },
          components: [{ type: 'body', parameters: variables.map(v => ({ type: 'text', text: String(v || '') })) }],
        },
      }),
    })
    if (!res.ok) {
      const texte = await res.text()
      console.error(`WhatsApp « ${modele} » refusé:`, texte)
      try { const e = JSON.parse(texte).error; derniereErreurWhatsapp = `${e.code} ${e.message}${e.error_data?.details ? ' — ' + e.error_data.details : ''}` }
      catch { derniereErreurWhatsapp = texte.slice(0, 200) }
    }
    return res.ok
  } catch (error) {
    console.error(`WhatsApp « ${modele} » erreur:`, error.message)
    return false
  }
}

// Lien d'accès, le même que dans l'email : création du compte (invitation en attente) ou connexion (compte existant)
async function lienAcces(table, p) {
  const type = table === 'famille' ? 'famille' : 'intervenant'
  if (p.user_id) return `${SITE_URL}/login?redirect=${encodeURIComponent(type === 'famille' ? '/app' : '/espace-intervenant')}`
  if (!p.email) return null
  let token = p.invite_token
  if (!token) {
    // Salarié affecté à plusieurs clients : l'invitation en attente porte sur une autre de ses fiches
    const { data } = await supabaseAdmin.from(table).select('invite_token').ilike('email', p.email)
      .is('user_id', null).not('invite_token', 'is', null).limit(1)
    token = data?.[0]?.invite_token
  }
  return token ? `${SITE_URL}/rejoindre?token=${token}&type=${type}&email=${encodeURIComponent(p.email)}` : null
}

// Dès qu'un numéro est renseigné pour un proche ou un intervenant, deux messages :
// 1. « lien_holiris » : {{1}} prénom de la personne, {{2}} nom du senior, {{3}} lien d'accès (seulement si la fiche a un email)
// 2. « bienvenue_holiris » : {{1}} prénom de la personne, {{2}} nom du senior, {{3}} prénom du senior
// À appeler après l'envoi de l'invitation par email, pour que le lien existe.
export async function envoyerBienvenue(table, id) {
  const fkey = table === 'famille' ? 'famille_senior_id_fkey' : 'intervenants_senior_id_fkey'
  const { data: p } = await supabaseAdmin.from(table)
    .select(`name, phone, whatsapp, email, user_id, invite_token, archived_at, seniors!${fkey}(name)`).eq('id', id).maybeSingle()
  const numero = numeroWhatsapp(p?.whatsapp || p?.phone)
  if (!p || p.archived_at || !numero) return false
  const prenom = p.name.split(' ')[0]
  const senior = p.seniors?.name || ''
  const lien = await lienAcces(table, p)
  if (lien) await envoyerModele(numero, 'lien_holiris', [prenom, senior, lien])
  return envoyerModele(numero, 'bienvenue_holiris', [prenom, senior, senior.split(' ')[0]])
}
