import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant } from '@/lib/serveur'

// Création d'un dossier senior par un proche (accueil famille, profil) : le senior et la fiche
// famille du créateur sont créés ensemble, sinon le créateur n'aurait pas accès au dossier.
export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    const b = await request.json()
    const champ = (v, max = 80) => String(v ?? '').trim().slice(0, max)
    const senior = { prenom: champ(b.seniorPrenom), nom: champ(b.seniorNom), ville: champ(b.seniorVille), dateNaissance: b.seniorDateNaissance }
    const profil = { nom: champ(b.profilNom, 120), lien: champ(b.profilLien, 60) }
    if (!senior.prenom || !senior.nom || !senior.ville || !senior.dateNaissance || !profil.nom || !profil.lien) {
      return NextResponse.json({ success: false, error: 'Champs manquants' }, { status: 400 })
    }

    const age = Math.floor((new Date() - new Date(senior.dateNaissance)) / (365.25 * 24 * 60 * 60 * 1000))
    const { data: cree, error } = await supabaseAdmin.from('seniors').insert({
      name: senior.prenom + ' ' + senior.nom,
      age,
      date_naissance: senior.dateNaissance,
      city: senior.ville,
      status: 'stable',
    }).select('id').single()
    if (error) throw error

    const { error: errF } = await supabaseAdmin.from('famille').insert({
      senior_id: cree.id,
      user_id: user.id,
      name: profil.nom,
      role: profil.lien,
      email: user.email,
      selected_senior_id: cree.id,
    })
    if (errF) {
      await supabaseAdmin.from('seniors').delete().eq('id', cree.id)
      throw errF
    }

    return NextResponse.json({ success: true, seniorId: cree.id })
  } catch (error) {
    console.error('Erreur création dossier:', error.message)
    return NextResponse.json({ success: false, error: 'Erreur lors de la création du dossier.' }, { status: 500 })
  }
}
