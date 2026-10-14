import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin, utilisateurCourant } from '@/lib/serveur'
import { escapeHtml, emailBienvenueFamille } from '@/lib/emails'
import { envoyerBienvenue } from '@/lib/whatsapp'

const resend = new Resend(process.env.RESEND_API_KEY)

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

    // Premier dossier de ce compte : message de bienvenue (pas pour un proche à suivre ajouté ensuite)
    const { count: dejaSuivis } = await supabaseAdmin.from('famille').select('id', { count: 'exact', head: true }).eq('user_id', user.id)

    // Téléphone du profil : celui d'une fiche déjà remplie par ce compte, sinon celui de la demande d'accès
    const { data: fiches } = await supabaseAdmin.from('famille').select('whatsapp')
      .eq('user_id', user.id).not('whatsapp', 'is', null).limit(1)
    let whatsapp = fiches?.[0]?.whatsapp || null
    if (!whatsapp) {
      const { data: demande } = await supabaseAdmin.from('demandes_acces').select('telephone')
        .eq('user_id', user.id).not('telephone', 'is', null).limit(1).maybeSingle()
      whatsapp = String(demande?.telephone || '').replace(/[\s.-]/g, '').replace(/^0/, '+33') || null
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

    const { data: fiche, error: errF } = await supabaseAdmin.from('famille').insert({
      senior_id: cree.id,
      user_id: user.id,
      name: profil.nom,
      role: profil.lien,
      email: user.email,
      whatsapp,
      selected_senior_id: cree.id,
    }).select('id').single()
    if (errF) {
      await supabaseAdmin.from('seniors').delete().eq('id', cree.id)
      throw errF
    }

    // Bienvenue famille : email, et WhatsApp si un numéro est connu (un échec ne bloque pas la création)
    const seniorName = senior.prenom + ' ' + senior.nom
    if (!dejaSuivis) try {
      await resend.emails.send({
        from: 'Holiris <contact@holiris.fr>',
        to: user.email,
        replyTo: 'thomas.frentz@holiris.fr',
        subject: `Bienvenue sur Holiris, ${profil.nom.split(' ')[0]}`,
        html: emailBienvenueFamille({ prenom: escapeHtml(profil.nom.split(' ')[0]), seniorName: escapeHtml(seniorName), createur: true }),
      })
    } catch (e) { console.error('Erreur email bienvenue famille:', e.message) }
    if (!dejaSuivis && whatsapp) await envoyerBienvenue('famille', fiche.id, { lien: false }).catch(() => {})

    return NextResponse.json({ success: true, seniorId: cree.id })
  } catch (error) {
    console.error('Erreur création dossier:', error.message)
    return NextResponse.json({ success: false, error: 'Erreur lors de la création du dossier.' }, { status: 500 })
  }
}
