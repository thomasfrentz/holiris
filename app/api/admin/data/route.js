import { NextResponse } from 'next/server'
import { supabaseAdmin, verifierAdmin } from '@/lib/serveur'

export const runtime = 'nodejs'

// Une personne peut avoir plusieurs fiches (proche de plusieurs seniors, intervenant, gestionnaire) :
// elles sont regroupées par compte, sinon par email, sinon par téléphone
function regrouperParPersonne({ famille, intervenants, gestionnaires, demandes }) {
  const personnes = new Map()
  const cleDe = f => f.user_id ? 'u:' + f.user_id : f.email ? 'e:' + f.email.toLowerCase() : (f.whatsapp || f.phone) ? 't:' + String(f.whatsapp || f.phone).replace(/\D/g, '').slice(-9) : 'f:' + f.id
  const personne = f => {
    const cle = cleDe(f)
    if (!personnes.has(cle)) personnes.set(cle, { cle, nom: null, email: null, telephone: null, compte: false, sansCompte: false, invitation: false, admin: false, roles: [], created_at: f.created_at })
    const p = personnes.get(cle)
    p.nom = p.nom || f.name || f.nom || null
    p.email = p.email || f.email || null
    p.telephone = p.telephone || f.whatsapp || f.phone || null
    p.compte = p.compte || !!f.user_id
    if (f.created_at && f.created_at > (p.created_at || '')) p.created_at = f.created_at
    return p
  }

  for (const f of famille) {
    const p = personne(f)
    p.admin = p.admin || (f.is_admin && !f.archived_at)
    p.invitation = p.invitation || (!f.user_id && !!f.invite_token && !f.archived_at)
    p.roles.push({ type: 'famille', libelle: 'Proche de ' + (f.seniors?.name || '?') + (f.role ? ' · ' + f.role : ''), archive: !!f.archived_at, fiche: f })
  }
  for (const i of intervenants) {
    const p = personne(i)
    p.sansCompte = p.sansCompte || (!i.user_id && !!i.jeton_mobile && !i.archived_at)
    p.invitation = p.invitation || (!i.user_id && !!i.invite_token && !i.archived_at)
    p.roles.push({ type: 'intervenant', libelle: 'Intervenant chez ' + (i.seniors?.name || '?') + (i.role ? ' · ' + i.role : ''), archive: !!i.archived_at })
  }
  for (const g of gestionnaires) {
    const p = personne(g)
    p.invitation = p.invitation || (!g.user_id && !!g.invite_token)
    p.roles.push({ type: 'gestionnaire', libelle: 'Gestionnaire de ' + (g.structures?.nom || '?'), archive: false })
  }
  // Compte créé après une demande d'accès, sans dossier encore
  for (const d of demandes) {
    const cle = 'u:' + d.user_id
    if (personnes.has(cle)) continue
    const p = personne({ ...d, name: [d.prenom, d.nom].filter(Boolean).join(' '), phone: d.telephone })
    p.roles.push({ type: 'famille', libelle: 'Compte créé, dossier de ' + (d.senior_nom || 'son proche') + ' pas encore créé', archive: false })
  }

  return [...personnes.values()].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
}

// Données de la page Admin (admin connecté uniquement)
export async function GET() {
  const { user, admin } = await verifierAdmin()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!admin) return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 })

  const [seniorsRes, familleRes, intervenantsRes, gestionnairesRes, demandesRes] = await Promise.all([
    supabaseAdmin.from('seniors').select('*, famille!famille_senior_id_fkey(name, email, is_admin)').order('created_at', { ascending: false }),
    supabaseAdmin.from('famille').select('*, seniors!famille_senior_id_fkey(name)').order('created_at', { ascending: false }),
    supabaseAdmin.from('intervenants').select('id, name, role, email, phone, whatsapp, user_id, invite_token, jeton_mobile, archived_at, created_at, seniors!intervenants_senior_id_fkey(name)'),
    supabaseAdmin.from('structure_membres').select('id, nom, email, user_id, invite_token, created_at, structures(nom)'),
    supabaseAdmin.from('demandes_acces').select('id, prenom, nom, email, telephone, senior_nom, user_id, created_at').eq('statut', 'inscrite').not('user_id', 'is', null),
  ])

  return NextResponse.json({
    seniors: seniorsRes.data || [],
    utilisateurs: familleRes.data || [],
    personnes: regrouperParPersonne({
      famille: familleRes.data || [],
      intervenants: intervenantsRes.data || [],
      gestionnaires: gestionnairesRes.data || [],
      demandes: demandesRes.data || [],
    }),
  })
}
