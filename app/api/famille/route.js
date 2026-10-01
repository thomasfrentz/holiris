import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { inviterMembre } from '@/lib/invitations'

const emailValide = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

// Modifier la fiche d'un proche : réservé à l'admin, aux gestionnaires de la structure
// et à la personne de confiance du senior
export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    const { id, prenom, nom, role, telephone, email, adresse } = await request.json()
    const { data: membre } = await supabaseAdmin.from('famille')
      .select('*, seniors!famille_senior_id_fkey(name, personne_confiance_id)').eq('id', id).maybeSingle()
    if (!membre) return NextResponse.json({ success: false, error: 'Proche introuvable' }, { status: 404 })

    const { data: maFiche } = await supabaseAdmin.from('famille').select('id')
      .eq('user_id', user.id).eq('senior_id', membre.senior_id).is('archived_at', null).maybeSingle()
    const estPersonneConfiance = !!maFiche && maFiche.id === membre.seniors?.personne_confiance_id
    if (!estPersonneConfiance && !await peutGererSenior(user.id, membre.senior_id)) {
      return NextResponse.json({ success: false, error: 'Réservé à la personne de confiance, à la structure et à l\'admin' }, { status: 403 })
    }

    const nouvelEmail = String(email || '').trim().toLowerCase()
    if (!String(prenom || '').trim() || !role) return NextResponse.json({ success: false, error: 'Prénom et lien obligatoires' }, { status: 400 })
    if (!emailValide(nouvelEmail)) return NextResponse.json({ success: false, error: 'Email invalide' }, { status: 400 })

    const tel = String(telephone || '').trim()
    const emailChange = nouvelEmail !== (membre.email || '').toLowerCase()
    const { error } = await supabaseAdmin.from('famille').update({
      name: (String(prenom).trim() + ' ' + String(nom || '').trim()).trim(),
      role,
      phone: tel || null,
      whatsapp: tel ? tel.replace(/\s/g, '').replace(/^0/, '+33') : null,
      email: nouvelEmail,
      adresse: String(adresse || '').trim() || null,
      // Sans compte, un nouvel email invalide l'ancien lien d'invitation (envoyé à l'ancienne adresse)
      ...(emailChange && !membre.user_id ? { invite_token: null } : {}),
    }).eq('id', id)
    if (error) throw error

    // Sans compte : invitation envoyée à la nouvelle adresse
    let invite = null
    if (emailChange && !membre.user_id) {
      const { data: aJour } = await supabaseAdmin.from('famille').select('*, seniors!famille_senior_id_fkey(name)').eq('id', id).single()
      invite = await inviterMembre({ table: 'famille', type: 'famille', membre: aJour })
    }
    return NextResponse.json({ success: true, invite: invite ? { success: invite.success, linked: invite.linked } : null })
  } catch (error) {
    console.error('Erreur modification famille:', error.message)
    return NextResponse.json({ success: false, error: 'La modification n\'a pas pu être enregistrée.' }, { status: 500 })
  }
}
