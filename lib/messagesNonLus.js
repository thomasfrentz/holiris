// Messages non lus d'une personne (côté serveur uniquement)
import { supabaseAdmin } from '@/lib/serveur'

const JOUR = 24 * 60 * 60 * 1000

// Seniors dont la personne peut lire le fil : proche, intervenant, gestionnaire de structure, admin
export async function seniorsSuivis(userId) {
  const [{ data: fam }, { data: interv }, { data: gest }] = await Promise.all([
    supabaseAdmin.from('famille').select('senior_id, is_admin').eq('user_id', userId).is('archived_at', null),
    supabaseAdmin.from('intervenants').select('senior_id').eq('user_id', userId).is('archived_at', null),
    supabaseAdmin.from('structure_membres').select('structure_id').eq('user_id', userId),
  ])
  if ((fam || []).some(f => f.is_admin)) {
    const { data } = await supabaseAdmin.from('seniors').select('id')
    return (data || []).map(s => s.id)
  }
  const ids = new Set([...(fam || []), ...(interv || [])].map(l => l.senior_id).filter(Boolean))
  const structures = (gest || []).map(g => g.structure_id)
  if (structures.length) {
    const { data } = await supabaseAdmin.from('seniors').select('id').in('structure_id', structures)
    for (const s of data || []) ids.add(s.id)
  }
  return [...ids]
}

// { total, parSenior: { <id>: { nombre, auteurs: [prénoms] } } }
// Sans lecture enregistrée, seuls les messages des 7 derniers jours comptent (pas tout l'historique)
export async function nonLusPour(userId, seniorIds) {
  const ids = seniorIds || await seniorsSuivis(userId)
  const resultat = { total: 0, parSenior: {} }
  if (!ids.length) return resultat

  const [{ data: lectures }, { data: messages }] = await Promise.all([
    supabaseAdmin.from('messages_lectures').select('senior_id, lu_jusqu_a').eq('user_id', userId).in('senior_id', ids),
    supabaseAdmin.from('messages').select('senior_id, auteur_nom, created_at').in('senior_id', ids)
      .neq('auteur_user_id', userId).gte('created_at', new Date(Date.now() - 30 * JOUR).toISOString()),
  ])
  const depuis = Object.fromEntries((lectures || []).map(l => [l.senior_id, new Date(l.lu_jusqu_a).getTime()]))
  const parDefaut = Date.now() - 7 * JOUR

  for (const m of messages || []) {
    if (new Date(m.created_at).getTime() <= (depuis[m.senior_id] ?? parDefaut)) continue
    const s = resultat.parSenior[m.senior_id] ||= { nombre: 0, auteurs: [] }
    s.nombre++
    const prenom = m.auteur_nom.split(' ')[0]
    if (!s.auteurs.includes(prenom)) s.auteurs.push(prenom)
    resultat.total++
  }
  return resultat
}

export async function marquerLu(userId, seniorId) {
  await supabaseAdmin.from('messages_lectures').upsert({ user_id: userId, senior_id: seniorId, lu_jusqu_a: new Date().toISOString() })
}
