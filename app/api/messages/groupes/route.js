import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { comptesDuSenior } from '@/lib/push'

// Groupes de discussion d'un dossier : création, nom, membres. La lecture se fait depuis le navigateur
// (règles d'accès : seuls les membres voient le groupe et ses messages).

const nomValide = n => String(n || '').trim().slice(0, 60)

// Le compte suit-il ce senior (proche, intervenant, gestionnaire, admin) ?
async function suitLeSenior(userId, seniorId) {
  return (await comptesDuSenior(seniorId)).includes(userId) || await peutGererSenior(userId, seniorId)
}

// Membres retenus : comptes qui suivent ce senior, plus le créateur
async function membresValides(seniorId, ids, createur) {
  const comptes = new Set(await comptesDuSenior(seniorId))
  return [...new Set([createur, ...(Array.isArray(ids) ? ids : []).filter(id => comptes.has(id))])]
}

export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    const body = await request.json()

    if (body.action === 'creer') {
      const nom = nomValide(body.nom)
      if (!body.seniorId || !nom) return NextResponse.json({ success: false, error: 'Nom du groupe requis' }, { status: 400 })
      if (!await suitLeSenior(user.id, body.seniorId)) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
      const membres = await membresValides(body.seniorId, body.membres, user.id)
      if (membres.length < 2) return NextResponse.json({ success: false, error: 'Choisissez au moins une personne' }, { status: 400 })

      const { data: groupe, error } = await supabaseAdmin.from('groupes_discussion')
        .insert({ senior_id: body.seniorId, nom, cree_par: user.id }).select().single()
      if (error) throw error
      const { error: errM } = await supabaseAdmin.from('groupes_membres').insert(membres.map(user_id => ({ groupe_id: groupe.id, user_id })))
      if (errM) { await supabaseAdmin.from('groupes_discussion').delete().eq('id', groupe.id); throw errM }
      return NextResponse.json({ success: true, groupe: { ...groupe, membres } })
    }

    // Renommer ou changer les membres : réservé au créateur du groupe
    const { data: groupe } = await supabaseAdmin.from('groupes_discussion').select('*').eq('id', body.groupeId).maybeSingle()
    if (!groupe) return NextResponse.json({ success: false, error: 'Groupe introuvable' }, { status: 404 })
    if (groupe.cree_par !== user.id) return NextResponse.json({ success: false, error: 'Seul le créateur du groupe peut le modifier' }, { status: 403 })

    if (body.action === 'modifier') {
      const nom = nomValide(body.nom) || groupe.nom
      const membres = await membresValides(groupe.senior_id, body.membres, user.id)
      if (membres.length < 2) return NextResponse.json({ success: false, error: 'Choisissez au moins une personne' }, { status: 400 })
      await supabaseAdmin.from('groupes_discussion').update({ nom }).eq('id', groupe.id)
      await supabaseAdmin.from('groupes_membres').delete().eq('groupe_id', groupe.id).not('user_id', 'in', `(${membres.join(',')})`)
      await supabaseAdmin.from('groupes_membres').upsert(membres.map(user_id => ({ groupe_id: groupe.id, user_id })), { ignoreDuplicates: true })
      return NextResponse.json({ success: true, groupe: { ...groupe, nom, membres } })
    }

    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Erreur groupe de discussion:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
