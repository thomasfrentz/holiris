// Outils côté serveur : client Supabase admin et utilisateur connecté
import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Client Supabase avec les droits de l'utilisateur connecté (règles d'accès appliquées)
export async function clientUtilisateur() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookies: { getAll() { return cookieStore.getAll() }, setAll() {} } }
  )
}

export async function utilisateurCourant() {
  const supabase = await clientUtilisateur()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

// Lignes famille actives de l'utilisateur (une par senior suivi)
export async function lignesFamille(userId) {
  const { data } = await supabaseAdmin
    .from('famille').select('*')
    .eq('user_id', userId)
    .is('archived_at', null)
  return data || []
}

// L'utilisateur connecté est-il admin Holiris ? Renvoie { user, admin }
export async function verifierAdmin() {
  const user = await utilisateurCourant()
  if (!user) return { user: null, admin: false }
  const lignes = await lignesFamille(user.id)
  return { user, admin: lignes.some(l => l.is_admin) }
}

// Structures dont l'utilisateur est gestionnaire (identifiants)
export async function structuresGerees(userId) {
  const { data } = await supabaseAdmin.from('structure_membres').select('structure_id').eq('user_id', userId)
  return (data || []).map(m => m.structure_id)
}

// L'utilisateur peut-il gérer ce senior ? Admin Holiris, ou gestionnaire de la structure du senior
export async function peutGererSenior(userId, seniorId) {
  const lignes = await lignesFamille(userId)
  if (lignes.some(l => l.is_admin)) return true
  const structures = await structuresGerees(userId)
  if (!structures.length || !seniorId) return false
  const { data } = await supabaseAdmin.from('seniors').select('structure_id').eq('id', seniorId).maybeSingle()
  return !!data?.structure_id && structures.includes(data.structure_id)
}

// Structure gérée par l'utilisateur connecté (la première), ou null
export async function verifierGestionnaire() {
  const user = await utilisateurCourant()
  if (!user) return { user: null, structureId: null }
  const structures = await structuresGerees(user.id)
  return { user, structureId: structures[0] || null }
}

// L'utilisateur connecté peut-il lire le texte d'une note de ce corps de métier (notes.metier) sur ce dossier ?
// Même règle que la base : famille, admin, ou intervenant du même corps de métier ; note sans métier : tout le monde
export async function peutLireNote(seniorId, metier) {
  if (!metier) return true
  const supabase = await clientUtilisateur()
  const { data } = await supabase.rpc('peut_lire_note', { sid: seniorId, m: metier })
  return data === true
}

// Senior suivi par l'utilisateur connecté (règles d'accès appliquées), avec son âge ; null sinon.
// Pour l'IA : l'accès est vérifié ici, puis les notes sont lues en entier par le serveur
export async function seniorAccessible(seniorId) {
  if (!seniorId) return null
  const supabase = await clientUtilisateur()
  const { data } = await supabase.from('seniors').select('id, name, age, city, date_naissance').eq('id', seniorId).maybeSingle()
  if (!data) return null
  const age = data.date_naissance ? Math.floor((new Date() - new Date(data.date_naissance)) / (365.25 * 24 * 60 * 60 * 1000)) : data.age
  return { ...data, age }
}
