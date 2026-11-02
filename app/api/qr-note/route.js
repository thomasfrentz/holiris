import { NextResponse } from 'next/server'
import { randomInt } from 'crypto'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { enregistrerNote } from '@/lib/notesMedicales'
import { inviterMembre } from '@/lib/invitations'

// QR code Holiris (le même partout) : n'importe qui peut laisser une note, sans compte,
// en tapant le code du senior affiché chez lui. Le code ne donne accès qu'au prénom du senior
// et à la liste des personnes du dossier (prénom, initiale, rôle), jamais aux notes, au résumé ni aux alertes.

// 8 caractères sans O/0, I/1/L : facile à recopier, impossible à deviner
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const champ = (v, max) => String(v || '').trim().slice(0, max)
const abrege = nom => { const [prenom, ...reste] = String(nom || '').trim().split(/\s+/); return prenom + (reste.length ? ' ' + reste[reste.length - 1][0].toUpperCase() + '.' : '') }
const normaliserCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

async function seniorDuCode(code) {
  const c = normaliserCode(code)
  if (c.length !== 8) return null
  const { data } = await supabaseAdmin.from('seniors').select('id, name').eq('code_note', c).maybeSingle()
  return data
}

export async function GET(request) {
  const senior = await seniorDuCode(new URL(request.url).searchParams.get('code'))
  if (!senior) return NextResponse.json({ error: 'Code inconnu' }, { status: 404 })

  const [{ data: intervenants }, { data: famille }] = await Promise.all([
    supabaseAdmin.from('intervenants').select('id, name, role').eq('senior_id', senior.id).is('archived_at', null),
    supabaseAdmin.from('famille').select('id, name, role').eq('senior_id', senior.id).is('archived_at', null),
  ])
  const personnes = [
    ...(intervenants || []).map(p => ({ id: p.id, type: 'intervenant', nom: abrege(p.name), role: p.role || '' })),
    ...(famille || []).map(p => ({ id: p.id, type: 'famille', nom: abrege(p.name), role: p.role || '' })),
  ].sort((a, b) => a.nom.localeCompare(b.nom))

  return NextResponse.json({ senior: abrege(senior.name), personnes })
}

export async function POST(request) {
  try {
    const body = await request.json()

    // Note laissée depuis le QR code
    if (body.action === 'note') {
      const senior = await seniorDuCode(body.code)
      if (!senior) return NextResponse.json({ success: false, error: 'Code inconnu' }, { status: 404 })
      const texte = champ(body.note, 4000)
      if (!texte) return NextResponse.json({ success: false, error: 'Note vide' }, { status: 400 })

      let auteur
      if (body.personneId) {
        const table = body.personneType === 'famille' ? 'famille' : 'intervenants'
        const { data: p } = await supabaseAdmin.from(table).select('id, name, role, phone, whatsapp, email, senior_id')
          .eq('id', body.personneId).is('archived_at', null).maybeSingle()
        if (!p || p.senior_id !== senior.id) return NextResponse.json({ success: false, error: 'Personne introuvable' }, { status: 404 })
        auteur = { type: table === 'famille' ? 'famille' : 'intervenant', id: p.id, nom: p.name, role: p.role, telephone: p.phone || p.whatsapp, email: p.email }
      } else {
        // Personne absente du dossier (voisin, remplaçant…) : nom et rôle déclarés
        const nom = champ(body.nom, 60)
        if (!nom) return NextResponse.json({ success: false, error: 'Indiquez votre nom' }, { status: 400 })
        auteur = { type: 'intervenant', id: null, nom, role: champ(body.role, 60) || null, telephone: champ(body.telephone, 30) || null }
      }

      const result = await enregistrerNote({ seniorId: senior.id, texte, source: 'qr', auteur })
      return NextResponse.json({ success: true, medical: result.medical, signalementId: result.signalementId, notePartielle: !!result.note })
    }

    // Créer un compte depuis le QR code : l'invitation part à l'email déjà inscrit sur la fiche, jamais à une adresse saisie ici
    if (body.action === 'compte') {
      const senior = await seniorDuCode(body.code)
      if (!senior) return NextResponse.json({ success: false, error: 'Code inconnu' }, { status: 404 })
      const table = body.personneType === 'famille' ? 'famille' : 'intervenants'
      const fkey = table === 'famille' ? 'famille_senior_id_fkey' : 'intervenants_senior_id_fkey'
      const { data: membre } = await supabaseAdmin.from(table).select(`*, seniors!${fkey}(name)`)
        .eq('id', body.personneId).is('archived_at', null).maybeSingle()
      if (!membre || membre.senior_id !== senior.id) return NextResponse.json({ success: false, error: 'Personne introuvable' }, { status: 404 })
      if (membre.user_id) return NextResponse.json({ success: true, etat: 'compte' })
      if (!membre.email) return NextResponse.json({ success: true, etat: 'demande' })
      const result = await inviterMembre({ table, type: table === 'famille' ? 'famille' : 'intervenant', membre })
      if (!result.success) return NextResponse.json({ success: false, error: 'L\'email n\'a pas pu être envoyé.' }, { status: 500 })
      const [local, domaine] = membre.email.split('@')
      return NextResponse.json({ success: true, etat: result.linked ? 'compte' : 'envoye', email: local[0] + '•••@' + domaine })
    }

    // Lire ou changer le code d'un senior : mêmes droits que pour les invitations
    if (body.action === 'lire' || body.action === 'generer') {
      const user = await utilisateurCourant()
      if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
      const { data: acces } = await supabaseAdmin.from('famille').select('id')
        .eq('user_id', user.id).eq('senior_id', body.seniorId).is('archived_at', null).limit(1)
      if (!acces?.length && !await peutGererSenior(user.id, body.seniorId)) {
        return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
      }
      if (body.action === 'lire') {
        const { data } = await supabaseAdmin.from('seniors').select('code_note').eq('id', body.seniorId).maybeSingle()
        return NextResponse.json({ success: true, code: data?.code_note || null })
      }
      // Un nouveau code rend l'ancien inutilisable (affiche perdue, code diffusé)
      for (let essai = 0; essai < 5; essai++) {
        const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join('')
        const { error } = await supabaseAdmin.from('seniors').update({ code_note: code }).eq('id', body.seniorId)
        if (!error) return NextResponse.json({ success: true, code })
        if (error.code !== '23505') throw error // 23505 : code déjà pris par un autre senior, on en tire un autre
      }
      throw new Error('Aucun code disponible')
    }

    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Erreur qr-note:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
