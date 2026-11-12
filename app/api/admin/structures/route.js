import { NextResponse } from 'next/server'
import { supabaseAdmin, verifierAdmin } from '@/lib/serveur'
import { inviterGestionnaire } from '@/lib/invitations'

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const telephone = v => String(v || '').trim().slice(0, 30) || null

// Structures (admin Holiris uniquement), avec les coordonnées de leurs gestionnaires
export async function GET() {
  const { user, admin } = await verifierAdmin()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!admin) return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 })

  const [structures, membres, seniors] = await Promise.all([
    supabaseAdmin.from('structures').select('id, nom, adresse, created_at').order('nom'),
    supabaseAdmin.from('structure_membres').select('id, structure_id, nom, email, telephone, user_id, created_at').order('created_at'),
    supabaseAdmin.from('seniors').select('id, structure_id'),
  ])
  if (structures.error) return NextResponse.json({ error: structures.error.message }, { status: 500 })

  // Téléphone du gestionnaire ; à défaut, celui laissé ailleurs avec le même email (demande d'accès,
  // fiche proche ou intervenant). Dernière connexion : celle de son compte.
  const emails = [...new Set((membres.data || []).map(m => m.email.toLowerCase()))]
  const [demandes, proches, intervenants, comptes] = emails.length ? await Promise.all([
    supabaseAdmin.from('demandes_acces').select('email, telephone').in('email', emails).not('telephone', 'is', null),
    supabaseAdmin.from('famille').select('email, phone').in('email', emails).not('phone', 'is', null),
    supabaseAdmin.from('intervenants').select('email, phone').in('email', emails).not('phone', 'is', null),
    Promise.all((membres.data || []).filter(m => m.user_id).map(m => supabaseAdmin.auth.admin.getUserById(m.user_id)
      .then(({ data }) => [m.user_id, data?.user?.last_sign_in_at || null]).catch(() => [m.user_id, null]))),
  ]) : [{}, {}, {}, []]
  const telephones = new Map()
  for (const [liste, champ] of [[demandes.data, 'telephone'], [proches.data, 'phone'], [intervenants.data, 'phone']]) {
    for (const x of liste || []) if (!telephones.has(x.email.toLowerCase())) telephones.set(x.email.toLowerCase(), x[champ])
  }
  const connexions = new Map(comptes)

  return NextResponse.json({
    structures: structures.data.map(s => ({
      ...s,
      gestionnaires: (membres.data || []).filter(m => m.structure_id === s.id).map(m => ({
        id: m.id, nom: m.nom, email: m.email, compteActif: !!m.user_id, inviteLe: m.created_at,
        telephone: m.telephone || null, telephoneAilleurs: m.telephone ? null : telephones.get(m.email.toLowerCase()) || null, derniereConnexion: connexions.get(m.user_id) || null,
      })),
      nbSeniors: (seniors.data || []).filter(x => x.structure_id === s.id).length,
    })),
  })
}

// action : 'creer' (structure + invitation du responsable) | 'renvoyer' (invitation d'un gestionnaire, même lien)
//        | 'modifier' (nom de la structure, noms et emails des gestionnaires) | 'rattacher' (senior existant ↔ structure)
export async function POST(request) {
  try {
    const { admin } = await verifierAdmin()
    if (!admin) return NextResponse.json({ success: false, error: 'Réservé à l\'admin' }, { status: 403 })
    const body = await request.json()

    if (body.action === 'creer') {
      const nom = String(body.nom || '').trim().slice(0, 120)
      const email = String(body.email || '').trim().toLowerCase()
      if (!nom || !EMAIL_VALIDE.test(email)) return NextResponse.json({ success: false, error: 'Nom de structure et email valide requis' }, { status: 400 })

      const { data: structure, error } = await supabaseAdmin.from('structures').insert({ nom }).select().single()
      if (error) throw error
      const { data: gestionnaire, error: errM } = await supabaseAdmin.from('structure_membres')
        .insert({ structure_id: structure.id, email, nom: String(body.nomResponsable || '').trim().slice(0, 80) || null, telephone: telephone(body.telephone) })
        .select().single()
      if (errM) throw errM

      const result = await inviterGestionnaire(gestionnaire, structure.nom)
      return NextResponse.json({ success: result.success, linked: result.linked })
    }

    if (body.action === 'renvoyer') {
      const { data: gestionnaire } = await supabaseAdmin.from('structure_membres')
        .select('*, structures(nom)').eq('id', body.membreId).maybeSingle()
      if (!gestionnaire) return NextResponse.json({ success: false, error: 'Gestionnaire introuvable' }, { status: 404 })
      const result = await inviterGestionnaire(gestionnaire, gestionnaire.structures?.nom || 'Holiris')
      if (!result.success) return NextResponse.json({ success: false, error: 'L’email n’a pas pu être envoyé' }, { status: 502 })
      return NextResponse.json({ success: true, linked: result.linked })
    }

    // Nom de la structure, nom, email et téléphone de ses gestionnaires. L'email d'un compte déjà actif ne change pas ici :
    // c'est son identifiant de connexion
    if (body.action === 'modifier') {
      const nom = String(body.nom || '').trim().slice(0, 120)
      if (!nom) return NextResponse.json({ success: false, error: 'Nom de structure requis' }, { status: 400 })
      const { data: membres } = await supabaseAdmin.from('structure_membres').select('id, email, user_id').eq('structure_id', body.structureId)
      const modifs = []
      for (const g of body.gestionnaires || []) {
        const membre = (membres || []).find(m => m.id === g.id)
        if (!membre) return NextResponse.json({ success: false, error: 'Gestionnaire introuvable' }, { status: 404 })
        const email = String(g.email || '').trim().toLowerCase()
        if (email !== membre.email && membre.user_id) return NextResponse.json({ success: false, error: 'L’email d’un compte déjà actif ne peut pas être changé ici' }, { status: 400 })
        if (!EMAIL_VALIDE.test(email)) return NextResponse.json({ success: false, error: 'Email invalide : ' + email }, { status: 400 })
        modifs.push({ id: membre.id, nom: String(g.nom || '').trim().slice(0, 80) || null, email, telephone: telephone(g.telephone) })
      }
      const { error } = await supabaseAdmin.from('structures').update({ nom }).eq('id', body.structureId)
      if (error) throw error
      for (const m of modifs) {
        const { error: e } = await supabaseAdmin.from('structure_membres').update({ nom: m.nom, email: m.email, telephone: m.telephone }).eq('id', m.id)
        if (e) throw e
      }
      return NextResponse.json({ success: true })
    }

    if (body.action === 'rattacher') {
      const { error } = await supabaseAdmin.from('seniors')
        .update({ structure_id: body.structureId || null })
        .eq('id', body.seniorId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Erreur admin structures:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
