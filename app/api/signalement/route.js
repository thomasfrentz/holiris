import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, lignesFamille, structuresGerees, peutGererSenior } from '@/lib/serveur'
import { repondreSignalement } from '@/lib/notesMedicales'

// Signalements « à contacter » visibles par l'utilisateur connecté :
// ceux dont il est la personne de confiance, et ceux sans personne de confiance
// qui lui reviennent : seniors de sa structure (gestionnaire), ou hors structure (admin)
export async function GET() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ signalements: [] }, { status: 401 })

  const lignes = await lignesFamille(user.id)
  const idsFamille = lignes.map(l => l.id)
  const estAdmin = lignes.some(l => l.is_admin)
  const structures = await structuresGerees(user.id)

  let query = supabaseAdmin.from('signalements_medicaux')
    .select('id, senior_id, auteur_nom, auteur_role, auteur_telephone, auteur_email, repondu_at, destinataire_famille_id, seniors(name, structure_id)')
    .eq('statut', 'a_contacter')
    .order('repondu_at', { ascending: false })

  const filtres = []
  if (idsFamille.length) filtres.push(`destinataire_famille_id.in.(${idsFamille.join(',')})`)
  if (estAdmin || structures.length) filtres.push('destinataire_famille_id.is.null')
  if (!filtres.length) return NextResponse.json({ signalements: [] })
  query = query.or(filtres.join(','))

  const { data, error } = await query
  if (error) {
    console.error('Lecture signalements:', error.message)
    return NextResponse.json({ signalements: [] })
  }
  const pourMoi = data.filter(s => s.destinataire_famille_id
    ? idsFamille.includes(s.destinataire_famille_id)
    : (s.seniors?.structure_id ? structures.includes(s.seniors.structure_id) : estAdmin))
  return NextResponse.json({ signalements: pourMoi })
}

// action : 'essentiel' | 'non_essentiel' (réponse de l'auteur) ou 'contacte' (personne de confiance)
export async function POST(request) {
  try {
    const { id, action } = await request.json()
    if (!id) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })

    if (action === 'essentiel' || action === 'non_essentiel') {
      // L'identifiant du signalement n'est connu que de l'écran de l'auteur
      const result = await repondreSignalement(id, action === 'essentiel')
      if (!result.ok) return NextResponse.json({ success: false, error: result.error }, { status: 400 })
      return NextResponse.json({ success: true, destinataire: result.destinataire, auteurEstDestinataire: result.auteurEstDestinataire })
    }

    if (action === 'contacte') {
      const user = await utilisateurCourant()
      if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
      const lignes = await lignesFamille(user.id)
      const { data: sig } = await supabaseAdmin.from('signalements_medicaux')
        .select('destinataire_famille_id, senior_id').eq('id', id).single()
      const autorise = sig && (lignes.some(l => l.id === sig.destinataire_famille_id)
        || (!sig.destinataire_famille_id && await peutGererSenior(user.id, sig.senior_id)))
      if (!autorise) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })

      await supabaseAdmin.from('signalements_medicaux')
        .update({ statut: 'contacte', contacte_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Erreur signalement:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
