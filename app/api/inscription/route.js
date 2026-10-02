import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/serveur'

// Création de compte contrôlée : uniquement avec un lien d'invitation ou une demande d'accès validée.
// Les inscriptions publiques sont désactivées dans Supabase ; seul ce serveur peut créer un compte.
export async function POST(request) {
  try {
    const { email, password, jeton, type } = await request.json()
    const adresse = String(email || '').trim().toLowerCase()
    if (!adresse || !jeton || !password) {
      return NextResponse.json({ success: false, error: 'Lien d\'inscription incomplet.' }, { status: 400 })
    }
    if (String(password).length < 6) {
      return NextResponse.json({ success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' }, { status: 400 })
    }

    // Vérifier le jeton et que l'email correspond à celui de l'invitation
    let demandeId = null
    let gestionnaireId = null
    if (type === 'structure') {
      const { data } = await supabaseAdmin.from('structure_membres')
        .select('id, email').eq('invite_token', jeton).maybeSingle()
      if (!data) return NextResponse.json({ success: false, error: 'Ce lien n\'est plus valide.' }, { status: 400 })
      if (data.email.toLowerCase() !== adresse) return NextResponse.json({ success: false, error: 'Utilisez l\'adresse email à laquelle vous avez reçu le lien.' }, { status: 400 })
      gestionnaireId = data.id
    } else if (type === 'demande') {
      const { data } = await supabaseAdmin.from('demandes_acces')
        .select('id, email, statut').eq('jeton', jeton).maybeSingle()
      if (!data || data.statut !== 'validee') return NextResponse.json({ success: false, error: 'Ce lien n\'est plus valide.' }, { status: 400 })
      if (data.email.toLowerCase() !== adresse) return NextResponse.json({ success: false, error: 'Utilisez l\'adresse email à laquelle vous avez reçu le lien.' }, { status: 400 })
      demandeId = data.id
    } else if (type === 'famille' || type === 'intervenant') {
      const table = type === 'famille' ? 'famille' : 'intervenants'
      const { data } = await supabaseAdmin.from(table)
        .select('email').eq('invite_token', jeton).is('archived_at', null).maybeSingle()
      if (!data) return NextResponse.json({ success: false, error: 'Ce lien d\'invitation n\'est plus valide.' }, { status: 400 })
      if (data.email?.toLowerCase() !== adresse) return NextResponse.json({ success: false, error: 'Utilisez l\'adresse email à laquelle vous avez reçu l\'invitation.' }, { status: 400 })
    } else {
      return NextResponse.json({ success: false, error: 'Lien d\'inscription invalide.' }, { status: 400 })
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: adresse,
      password,
      email_confirm: true,
    })
    if (error) {
      const existe = /already|registered|exists/i.test(error.message)
      return NextResponse.json({
        success: false,
        compteExistant: existe,
        error: existe ? 'Un compte existe déjà avec cet email : connectez-vous.' : error.message,
      }, { status: 400 })
    }

    // Invitation proche ou intervenant : accès activé tout de suite, pour toutes les invitations
    // en attente à cette adresse (le jeton a prouvé l'accès à la boîte mail)
    if (type === 'famille' || type === 'intervenant') {
      for (const table of ['famille', 'intervenants']) {
        await supabaseAdmin.from(table).update({ user_id: created.user.id, invite_token: null })
          .ilike('email', adresse).is('user_id', null).is('archived_at', null)
      }
    }

    // Gestionnaire de structure : rattaché directement (le jeton a prouvé l'accès à la boîte mail)
    if (gestionnaireId) {
      await supabaseAdmin.from('structure_membres')
        .update({ user_id: created.user.id, invite_token: null })
        .eq('id', gestionnaireId)
    }

    if (demandeId) {
      await supabaseAdmin.from('demandes_acces')
        .update({ statut: 'inscrite', jeton: null, user_id: created.user.id })
        .eq('id', demandeId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur inscription:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
