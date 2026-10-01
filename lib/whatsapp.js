// Envoi de modèles WhatsApp (API Meta) — côté serveur uniquement
import { supabaseAdmin } from '@/lib/serveur'

// « 06 12 34 56 78 » ou « +33 6 12… » → « 33612345678 » (format attendu par l'API WhatsApp)
export function numeroWhatsapp(numero) {
  const n = String(numero || '').replace(/[\s.-]/g, '')
  if (!n) return null
  if (n.startsWith('+')) return n.slice(1)
  if (n.startsWith('00')) return n.slice(2)
  if (n.startsWith('0')) return '33' + n.slice(1)
  return n
}

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
    if (!res.ok) console.error(`WhatsApp « ${modele} » refusé:`, await res.text())
    return res.ok
  } catch (error) {
    console.error(`WhatsApp « ${modele} » erreur:`, error.message)
    return false
  }
}

// Modèle « bienvenue_holiris », envoyé dès qu'un numéro est renseigné pour un proche ou un intervenant :
// {{1}} prénom de la personne, {{2}} nom du senior, {{3}} prénom du senior
export async function envoyerBienvenue(table, id) {
  const fkey = table === 'famille' ? 'famille_senior_id_fkey' : 'intervenants_senior_id_fkey'
  const { data: p } = await supabaseAdmin.from(table)
    .select(`name, phone, whatsapp, archived_at, seniors!${fkey}(name)`).eq('id', id).maybeSingle()
  const numero = numeroWhatsapp(p?.whatsapp || p?.phone)
  if (!p || p.archived_at || !numero) return false
  const senior = p.seniors?.name || ''
  return envoyerModele(numero, 'bienvenue_holiris', [p.name.split(' ')[0], senior, senior.split(' ')[0]])
}
