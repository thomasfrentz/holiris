import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { supabaseAdmin, verifierGestionnaire } from '@/lib/serveur'
import { escapeHtml, emailDemandeRattachement } from '@/lib/emails'
import { empreinte } from '@/lib/documents'
import { inviterMembre, inviterGestionnaire } from '@/lib/invitations'
import { envoyerBienvenue } from '@/lib/whatsapp'

const resend = new Resend(process.env.RESEND_API_KEY)
const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const champ = (v, max = 120) => String(v ?? '').trim().slice(0, max)

// Nom comparé sans accents, majuscules ni espaces en trop, dans les deux ordres (« Jeanne Martin » / « Martin Jeanne »)
const normaliser = n => String(n || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]+/g, ' ').trim()
const memeNom = (a, b) => {
  const x = normaliser(a), y = normaliser(b)
  return x === y || x === y.split(' ').reverse().join(' ')
}

function calculerAge(dateNaissance) {
  return Math.floor((new Date() - new Date(dateNaissance)) / (365.25 * 24 * 60 * 60 * 1000))
}

async function seniorDeLaStructure(seniorId, structureId) {
  const { data } = await supabaseAdmin.from('seniors').select('id, name').eq('id', seniorId).eq('structure_id', structureId).maybeSingle()
  return data
}

// Affecte un salarié au dossier d'un senior (une ligne intervenants par senior)
async function affecterSalarie(salarie, seniorId) {
  const { data: existante } = await supabaseAdmin.from('intervenants')
    .select('id, archived_at').eq('salarie_id', salarie.id).eq('senior_id', seniorId).maybeSingle()
  if (existante) {
    if (existante.archived_at) await supabaseAdmin.from('intervenants').update({ archived_at: null }).eq('id', existante.id)
    return
  }

  const telephone = salarie.telephone || null
  const { data: ligne, error } = await supabaseAdmin.from('intervenants').insert({
    name: salarie.prenom + ' ' + salarie.nom,
    role: salarie.role || null,
    phone: telephone,
    whatsapp: telephone ? telephone.replace(/\s/g, '').replace(/^0/, '+33') : null,
    email: salarie.email,
    senior_id: seniorId,
    salarie_id: salarie.id,
  }).select('*, seniors!intervenants_senior_id_fkey(name)').single()
  if (error) throw error

  // Une invitation est déjà en attente pour ce salarié : à la création de son compte,
  // tous ses dossiers sont rattachés d'un coup (même email). Pas de nouvel email.
  const { data: enAttente } = await supabaseAdmin.from('intervenants')
    .select('id').eq('salarie_id', salarie.id).is('user_id', null).not('invite_token', 'is', null).neq('id', ligne.id).limit(1)
  if (!enAttente?.length) await inviterMembre({ table: 'intervenants', type: 'intervenant', membre: ligne })
  if (telephone) await envoyerBienvenue('intervenants', ligne.id)
}

// Données de l'espace « Ma structure »
export async function GET() {
  const { user, structureId } = await verifierGestionnaire()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!structureId) return NextResponse.json({ error: 'Réservé aux gestionnaires de structure' }, { status: 403 })

  const [structure, seniors, salaries, gestionnaires, demandes] = await Promise.all([
    supabaseAdmin.from('structures').select('id, nom, adresse, adresse_facturation').eq('id', structureId).single(),
    supabaseAdmin.from('seniors').select('id, name, city, age, date_naissance').eq('structure_id', structureId).order('name'),
    supabaseAdmin.from('salaries').select('*').eq('structure_id', structureId).is('archived_at', null).order('nom'),
    supabaseAdmin.from('structure_membres').select('id, nom, email, user_id, created_at').eq('structure_id', structureId).order('created_at'),
    supabaseAdmin.from('demandes_rattachement').select('id, senior_nom, email_proche, statut, created_at')
      .eq('structure_id', structureId).order('created_at', { ascending: false }).limit(20),
  ])

  // Affectations actives de chaque salarié
  const idsSalaries = (salaries.data || []).map(s => s.id)
  const { data: affectations } = idsSalaries.length
    ? await supabaseAdmin.from('intervenants').select('salarie_id, senior_id, user_id').in('salarie_id', idsSalaries).is('archived_at', null)
    : { data: [] }

  return NextResponse.json({
    structure: structure.data,
    seniors: seniors.data || [],
    salaries: (salaries.data || []).map(s => ({
      ...s,
      seniorIds: (affectations || []).filter(a => a.salarie_id === s.id).map(a => a.senior_id),
      compteActif: (affectations || []).some(a => a.salarie_id === s.id && a.user_id),
    })),
    demandes: demandes.data || [],
    gestionnaires: (gestionnaires.data || []).map(g => ({ id: g.id, nom: g.nom, email: g.email, compteActif: !!g.user_id, moi: g.user_id === user.id })),
  })
}

export async function POST(request) {
  try {
    const { user, structureId } = await verifierGestionnaire()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    if (!structureId) return NextResponse.json({ success: false, error: 'Réservé aux gestionnaires de structure' }, { status: 403 })

    const body = await request.json()

    if (body.action === 'creer_senior') {
      const prenom = champ(body.prenom, 60), nom = champ(body.nom, 60), ville = champ(body.ville, 80)
      if (!prenom || !nom || !body.dateNaissance || !ville) return NextResponse.json({ success: false, error: 'Champs manquants' }, { status: 400 })
      const { data, error } = await supabaseAdmin.from('seniors').insert({
        name: prenom + ' ' + nom,
        age: calculerAge(body.dateNaissance),
        date_naissance: body.dateNaissance,
        city: ville,
        status: 'stable',
        structure_id: structureId,
      }).select('id').single()
      if (error) throw error
      return NextResponse.json({ success: true, seniorId: data.id })
    }

    if (body.action === 'creer_salarie') {
      const salarie = {
        structure_id: structureId,
        prenom: champ(body.prenom, 60),
        nom: champ(body.nom, 60),
        role: champ(body.role, 60) || null,
        telephone: champ(body.telephone, 30) || null,
        email: champ(body.email, 200).toLowerCase(),
      }
      if (!salarie.prenom || !salarie.nom || !EMAIL_VALIDE.test(salarie.email)) {
        return NextResponse.json({ success: false, error: 'Prénom, nom et email valide requis' }, { status: 400 })
      }
      const { data: cree, error } = await supabaseAdmin.from('salaries').insert(salarie).select().single()
      if (error) throw error
      for (const seniorId of body.seniorIds || []) {
        if (await seniorDeLaStructure(seniorId, structureId)) await affecterSalarie(cree, seniorId)
      }
      return NextResponse.json({ success: true })
    }

    // Import d'une liste de salariés (copiée depuis Excel ou exportée du logiciel métier).
    // Aucune invitation à ce stade : elle part quand le salarié est affecté à un client.
    if (body.action === 'importer_salaries') {
      const lignes = Array.isArray(body.lignes) ? body.lignes.slice(0, 500) : []
      const { data: existants } = await supabaseAdmin.from('salaries').select('email').eq('structure_id', structureId).is('archived_at', null)
      const emails = new Set((existants || []).map(s => s.email.toLowerCase()))
      const aCreer = [], ignores = []
      lignes.forEach((l, i) => {
        const salarie = {
          structure_id: structureId,
          prenom: champ(l.prenom, 60),
          nom: champ(l.nom, 60),
          role: champ(l.role, 60) || null,
          telephone: champ(l.telephone, 30) || null,
          email: champ(l.email, 200).toLowerCase(),
        }
        if (!salarie.prenom || !salarie.nom) ignores.push({ ligne: i + 1, nom: (salarie.prenom + ' ' + salarie.nom).trim(), raison: 'prénom ou nom manquant' })
        else if (!EMAIL_VALIDE.test(salarie.email)) ignores.push({ ligne: i + 1, nom: (salarie.prenom + ' ' + salarie.nom).trim(), raison: 'email manquant ou invalide' })
        else if (emails.has(salarie.email)) ignores.push({ ligne: i + 1, nom: (salarie.prenom + ' ' + salarie.nom).trim(), raison: 'déjà dans vos salariés' })
        else { emails.add(salarie.email); aCreer.push(salarie) }
      })
      if (aCreer.length) {
        const { error } = await supabaseAdmin.from('salaries').insert(aCreer)
        if (error) throw error
      }
      return NextResponse.json({ success: true, ajoutes: aCreer.length, ignores })
    }

    if (body.action === 'affecter') {
      const { data: salarie } = await supabaseAdmin.from('salaries').select('*').eq('id', body.salarieId).eq('structure_id', structureId).maybeSingle()
      const senior = await seniorDeLaStructure(body.seniorId, structureId)
      if (!salarie || !senior) return NextResponse.json({ success: false, error: 'Salarié ou client introuvable' }, { status: 404 })
      if (body.affecte) await affecterSalarie(salarie, senior.id)
      else await supabaseAdmin.from('intervenants').update({ archived_at: new Date().toISOString() })
        .eq('salarie_id', salarie.id).eq('senior_id', senior.id).is('archived_at', null)
      return NextResponse.json({ success: true })
    }

    if (body.action === 'archiver_salarie') {
      const { data: salarie } = await supabaseAdmin.from('salaries').select('id').eq('id', body.salarieId).eq('structure_id', structureId).maybeSingle()
      if (!salarie) return NextResponse.json({ success: false, error: 'Salarié introuvable' }, { status: 404 })
      const maintenant = new Date().toISOString()
      await supabaseAdmin.from('salaries').update({ archived_at: maintenant }).eq('id', salarie.id)
      await supabaseAdmin.from('intervenants').update({ archived_at: maintenant }).eq('salarie_id', salarie.id).is('archived_at', null)
      return NextResponse.json({ success: true })
    }

    // Rattacher un senior existant : un proche qui suit ce senior doit accepter.
    // La réponse est la même que le senior existe ou non, pour ne rien révéler des dossiers.
    if (body.action === 'demander_rattachement') {
      const seniorNom = champ(body.seniorNom, 120), email = champ(body.emailProche, 200).toLowerCase()
      if (!seniorNom || !EMAIL_VALIDE.test(email)) return NextResponse.json({ success: false, error: 'Nom du client et email d\'un proche requis' }, { status: 400 })

      const { count } = await supabaseAdmin.from('demandes_rattachement').select('id', { count: 'exact', head: true })
        .eq('structure_id', structureId).eq('statut', 'en_attente')
      if (count >= 20) return NextResponse.json({ success: false, error: 'Trop de demandes en attente : attendez les réponses des familles.' }, { status: 429 })

      const { data: fiches } = await supabaseAdmin.from('famille')
        .select('id, name, senior_id, seniors!famille_senior_id_fkey(name, structure_id)')
        .ilike('email', email).is('archived_at', null)
      const fiche = (fiches || []).find(f => f.seniors && memeNom(f.seniors.name, seniorNom))
      if (fiche?.seniors.structure_id === structureId) return NextResponse.json({ success: true, dejaRattache: true })

      const jeton = fiche ? randomBytes(24).toString('base64url') : null
      const { error } = await supabaseAdmin.from('demandes_rattachement').insert({
        structure_id: structureId, demandeur_user_id: user.id, senior_nom: seniorNom, email_proche: email,
        senior_id: fiche?.senior_id || null, famille_id: fiche?.id || null, jeton_hash: jeton ? empreinte(jeton) : null,
      })
      if (error) throw error

      if (fiche) {
        const { data: structure } = await supabaseAdmin.from('structures').select('nom').eq('id', structureId).single()
        const { error: errMail } = await resend.emails.send({
          from: 'Holiris <contact@holiris.fr>',
          to: email,
          replyTo: 'thomas.frentz@holiris.fr',
          subject: `${structure.nom} demande à suivre le dossier de ${fiche.seniors.name}`,
          html: emailDemandeRattachement({ prenom: escapeHtml(fiche.name.split(' ')[0]), structureNom: escapeHtml(structure.nom), seniorName: escapeHtml(fiche.seniors.name), jeton }),
        })
        if (errMail) console.error('Erreur email rattachement:', errMail)
      }
      return NextResponse.json({ success: true })
    }

    if (body.action === 'modifier_structure') {
      const adresse = champ(body.adresse, 300) || null
      const { error } = await supabaseAdmin.from('structures').update({
        adresse,
        adresse_facturation: body.facturationIdentique ? adresse : (champ(body.adresseFacturation, 300) || null),
      }).eq('id', structureId)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

    if (body.action === 'inviter_gestionnaire') {
      const email = champ(body.email, 200).toLowerCase()
      if (!EMAIL_VALIDE.test(email)) return NextResponse.json({ success: false, error: 'Email invalide' }, { status: 400 })
      const { data: structure } = await supabaseAdmin.from('structures').select('nom').eq('id', structureId).single()
      const { data: gestionnaire, error } = await supabaseAdmin.from('structure_membres')
        .upsert({ structure_id: structureId, email, nom: champ(body.nom, 80) || null }, { onConflict: 'structure_id,email' })
        .select().single()
      if (error) throw error
      const result = await inviterGestionnaire(gestionnaire, structure.nom)
      return NextResponse.json({ success: result.success, linked: result.linked })
    }

    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Erreur structure:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
