import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { supabaseAdmin, verifierGestionnaire } from '@/lib/serveur'
import { escapeHtml, emailDemandeRattachement } from '@/lib/emails'
import { empreinte } from '@/lib/documents'
import { inviterMembre, inviterGestionnaire } from '@/lib/invitations'
import { envoyerBienvenue } from '@/lib/whatsapp'

// Import d'un planning : une affectation par nouveau couple salarié → client
export const maxDuration = 60

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

// Affecte un salarié au dossier d'un senior (une ligne intervenants par senior).
// prevenir: false (import du planning) : le salarié a déjà été prévenu pour un autre client du même import,
// son compte est rattaché sans nouvel email ni WhatsApp.
async function affecterSalarie(salarie, seniorId, { prevenir = true } = {}) {
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

  if (!prevenir) {
    const { data: compte } = await supabaseAdmin.from('intervenants')
      .select('user_id').eq('salarie_id', salarie.id).not('user_id', 'is', null).limit(1)
    if (compte?.length) {
      await supabaseAdmin.from('intervenants').update({ user_id: compte[0].user_id, invite_token: null }).eq('id', ligne.id)
      return
    }
  }

  // Une invitation est déjà en attente pour ce salarié : à la création de son compte,
  // tous ses dossiers sont rattachés d'un coup (même email). Pas de nouvel email.
  const { data: enAttente } = await supabaseAdmin.from('intervenants')
    .select('id').eq('salarie_id', salarie.id).is('user_id', null).not('invite_token', 'is', null).neq('id', ligne.id).limit(1)
  if (!enAttente?.length) await inviterMembre({ table: 'intervenants', type: 'intervenant', membre: ligne })
  if (telephone && prevenir) await envoyerBienvenue('intervenants', ligne.id)
}

// Archive des salariés : ils perdent l'accès aux dossiers des clients de la structure
async function archiverSalaries(ids) {
  const maintenant = new Date().toISOString()
  await supabaseAdmin.from('salaries').update({ archived_at: maintenant }).in('id', ids)
  await supabaseAdmin.from('intervenants').update({ archived_at: maintenant }).in('salarie_id', ids).is('archived_at', null)
}

// Toutes les lignes d'une requête, par pages de 1000 (limite de Supabase)
async function toutesLesLignes(requete) {
  const lignes = []
  for (let debut = 0; ; debut += 1000) {
    const { data, error } = await requete().range(debut, debut + 999)
    if (error) throw error
    lignes.push(...(data || []))
    if (!data || data.length < 1000) return lignes
  }
}

// Planning global de la structure sur une période : passages de tous ses clients. Un passage écoulé
// est « note reçue » si l'un de ses intervenants a laissé une note sur ce client dans les 24 h.
async function planning(ids, debut, fin) {
  if (!ids.length) return []
  const events = await toutesLesLignes(() => supabaseAdmin.from('events')
    .select('id, senior_id, label, type, scheduled_at, intervenant_id, intervenant_ids, importe')
    .in('senior_id', ids).gte('scheduled_at', debut.toISOString()).lt('scheduled_at', fin.toISOString()).order('scheduled_at'))
  const idsDe = e => e.intervenant_ids?.length ? e.intervenant_ids : e.intervenant_id ? [e.intervenant_id] : []
  const idsIntervenants = [...new Set(events.flatMap(idsDe))]
  const maintenant = new Date()
  const [fiches, notes] = await Promise.all([
    idsIntervenants.length ? toutesLesLignes(() => supabaseAdmin.from('intervenants').select('id, name, salarie_id').in('id', idsIntervenants)) : [],
    events.some(e => new Date(e.scheduled_at) < maintenant)
      ? toutesLesLignes(() => supabaseAdmin.from('notes').select('senior_id, intervenant_id, created_at').in('senior_id', ids)
        .gte('created_at', debut.toISOString()).lt('created_at', new Date(Math.min(fin.getTime() + 24 * 3600 * 1000, maintenant.getTime())).toISOString()))
      : [],
  ])
  const parId = new Map(fiches.map(f => [f.id, f]))
  return events.map(e => {
    const equipe = idsDe(e).map(id => parId.get(id)).filter(Boolean)
    const quand = new Date(e.scheduled_at).getTime()
    const passe = quand < maintenant.getTime()
    return {
      id: e.id, seniorId: e.senior_id, label: e.label, type: e.type, scheduledAt: e.scheduled_at, importe: e.importe,
      intervenants: equipe.map(f => f.name), salarieIds: equipe.map(f => f.salarie_id).filter(Boolean),
      noteRecue: passe && equipe.length
        ? notes.some(n => n.senior_id === e.senior_id && idsDe(e).includes(n.intervenant_id)
          && new Date(n.created_at).getTime() >= quand && new Date(n.created_at).getTime() < quand + 24 * 3600 * 1000)
        : null,
    }
  })
}

// Données de l'espace « Ma structure ». Avec ?debut=…&fin=… : le planning de cette période.
export async function GET(request) {
  const { user, structureId } = await verifierGestionnaire()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  if (!structureId) return NextResponse.json({ error: 'Réservé aux gestionnaires de structure' }, { status: 403 })

  const { data: idsClients } = await supabaseAdmin.from('seniors').select('id').eq('structure_id', structureId)
  const ids = (idsClients || []).map(s => s.id)

  const params = new URL(request.url).searchParams
  if (params.has('debut')) {
    const debut = new Date(params.get('debut')), fin = new Date(params.get('fin'))
    if (isNaN(debut) || isNaN(fin) || fin <= debut || fin - debut > 93 * 24 * 3600 * 1000) {
      return NextResponse.json({ error: 'Période invalide' }, { status: 400 })
    }
    try {
      return NextResponse.json({ passages: await planning(ids, debut, fin) })
    } catch (error) {
      console.error('Erreur planning structure:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }
  const [structure, seniors, salaries, gestionnaires, demandes, reclamations, passages] = await Promise.all([
    supabaseAdmin.from('structures').select('id, nom, adresse, adresse_facturation').eq('id', structureId).single(),
    supabaseAdmin.from('seniors').select('id, name, city, age, date_naissance').eq('structure_id', structureId).order('name'),
    supabaseAdmin.from('salaries').select('*').eq('structure_id', structureId).is('archived_at', null).order('nom'),
    supabaseAdmin.from('structure_membres').select('id, nom, email, user_id, created_at').eq('structure_id', structureId).order('created_at'),
    supabaseAdmin.from('demandes_rattachement').select('id, senior_nom, email_proche, statut, created_at')
      .eq('structure_id', structureId).order('created_at', { ascending: false }).limit(20),
    // Réclamations à traiter, et celles traitées ces 30 derniers jours
    ids.length
      ? supabaseAdmin.from('reclamations').select('id, senior_id, auteur, resume, created_at, traitee_at, notes(content)')
        .in('senior_id', ids).or('traitee_at.is.null,traitee_at.gte.' + new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
        .order('created_at', { ascending: false }).limit(100)
      : { data: [] },
    // Passages à venir dans l'agenda des clients (étape « planning » de l'import)
    ids.length
      ? supabaseAdmin.from('events').select('id', { count: 'exact', head: true }).in('senior_id', ids).gte('scheduled_at', new Date().toISOString())
      : { count: 0 },
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
    passagesAVenir: passages.count || 0,
    reclamations: (reclamations.data || []).map(r => ({ id: r.id, seniorId: r.senior_id, auteur: r.auteur, resume: r.resume, createdAt: r.created_at, traiteeAt: r.traitee_at, note: r.notes?.content || null })),
    gestionnaires: (gestionnaires.data || []).map(g => ({ id: g.id, nom: g.nom, email: g.email, compteActif: !!g.user_id, moi: g.user_id === user.id })),
  })
}

export async function POST(request) {
  try {
    const { user, structureId } = await verifierGestionnaire()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    if (!structureId) return NextResponse.json({ success: false, error: 'Réservé aux gestionnaires de structure' }, { status: 403 })

    const body = await request.json()

    // Réclamation marquée traitée (ou de nouveau à traiter)
    if (body.action === 'traiter_reclamation') {
      const { data: r } = await supabaseAdmin.from('reclamations').select('id, seniors(structure_id)').eq('id', body.id).maybeSingle()
      if (!r || r.seniors?.structure_id !== structureId) return NextResponse.json({ success: false, error: 'Réclamation introuvable' }, { status: 404 })
      const { error } = await supabaseAdmin.from('reclamations')
        .update(body.traitee ? { traitee_at: new Date().toISOString(), traitee_par: user.id } : { traitee_at: null, traitee_par: null }).eq('id', r.id)
      if (error) throw error
      return NextResponse.json({ success: true })
    }

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

    // Import d'une liste de salariés (copiée depuis Excel ou exportée du logiciel métier), à chaque mise à jour.
    // Nouveaux salariés créés, sans invitation : elle part quand le salarié est affecté à un client.
    // Salariés déjà connus (même email) : fonction et téléphone mis à jour s'ils ont changé.
    // archiver : salariés absents de la liste que le gestionnaire a choisi d'archiver.
    if (body.action === 'importer_salaries') {
      const lignes = Array.isArray(body.lignes) ? body.lignes.slice(0, 500) : []
      const { data: existants } = await supabaseAdmin.from('salaries').select('id, email, role, telephone').eq('structure_id', structureId).is('archived_at', null)
      const parEmail = new Map((existants || []).map(s => [s.email.toLowerCase(), s]))
      const vus = new Set()
      const aCreer = [], aMettreAJour = [], ignores = []
      lignes.forEach((l, i) => {
        const salarie = {
          structure_id: structureId,
          prenom: champ(l.prenom, 60),
          nom: champ(l.nom, 60),
          role: champ(l.role, 60) || null,
          telephone: champ(l.telephone, 30) || null,
          email: champ(l.email, 200).toLowerCase(),
        }
        const nom = (salarie.prenom + ' ' + salarie.nom).trim()
        if (!salarie.prenom || !salarie.nom) ignores.push({ ligne: i + 1, nom, raison: 'prénom ou nom manquant' })
        else if (!EMAIL_VALIDE.test(salarie.email)) ignores.push({ ligne: i + 1, nom, raison: 'email manquant ou invalide' })
        else if (vus.has(salarie.email)) ignores.push({ ligne: i + 1, nom, raison: 'en double dans la liste' })
        else {
          vus.add(salarie.email)
          const connu = parEmail.get(salarie.email)
          if (!connu) { aCreer.push(salarie); return }
          // Une case vide dans le fichier n'efface pas l'information déjà connue
          const modif = {}
          if (salarie.role && salarie.role !== connu.role) modif.role = salarie.role
          if (salarie.telephone && salarie.telephone !== connu.telephone) modif.telephone = salarie.telephone
          if (Object.keys(modif).length) aMettreAJour.push({ id: connu.id, modif })
        }
      })
      if (aCreer.length) {
        const { error } = await supabaseAdmin.from('salaries').insert(aCreer)
        if (error) throw error
      }
      for (const { id, modif } of aMettreAJour) {
        const { error } = await supabaseAdmin.from('salaries').update(modif).eq('id', id)
        if (error) throw error
        // Ses fiches dans les dossiers de ses clients : le numéro sert à reconnaître ses notes WhatsApp
        const fiche = {}
        if (modif.role) fiche.role = modif.role
        if (modif.telephone) { fiche.phone = modif.telephone; fiche.whatsapp = modif.telephone.replace(/\s/g, '').replace(/^0/, '+33') }
        await supabaseAdmin.from('intervenants').update(fiche).eq('salarie_id', id)
      }
      const aArchiver = (Array.isArray(body.archiver) ? body.archiver : []).filter(id => (existants || []).some(s => s.id === id))
      if (aArchiver.length) await archiverSalaries(aArchiver)
      return NextResponse.json({ success: true, ajoutes: aCreer.length, misAJour: aMettreAJour.length, archives: aArchiver.length, ignores })
    }

    // Import d'une liste de clients exportée du logiciel métier, à chaque mise à jour. Un client déjà présent
    // (même nom, même date de naissance) n'est pas recréé : sa ville est mise à jour si elle a changé.
    if (body.action === 'importer_clients') {
      const lignes = Array.isArray(body.lignes) ? body.lignes.slice(0, 1000) : []
      const { data: existants } = await supabaseAdmin.from('seniors').select('id, name, date_naissance, city').eq('structure_id', structureId)
      const connus = (existants || []).map(s => ({ id: s.id, name: s.name, date: s.date_naissance, ville: s.city }))
      const aCreer = [], aMettreAJour = [], ignores = []
      lignes.forEach((l, i) => {
        const prenom = champ(l.prenom, 60), nom = champ(l.nom, 60), ville = champ(l.ville, 80), date = champ(l.dateNaissance, 10)
        const complet = prenom + ' ' + nom
        const raison = !prenom || !nom ? 'prénom ou nom manquant'
          : !/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date)) || new Date(date) > new Date() ? 'date de naissance invalide'
          : !ville ? 'ville manquante' : ''
        if (raison) { ignores.push({ ligne: i + 1, nom: complet.trim(), raison }); return }
        const connu = connus.find(c => memeNom(c.name, complet) && (!c.date || c.date === date))
        if (!connu) {
          connus.push({ name: complet, date, ville })
          aCreer.push({ name: complet, age: calculerAge(date), date_naissance: date, city: ville, status: 'stable', structure_id: structureId })
        } else if (!connu.id) ignores.push({ ligne: i + 1, nom: complet.trim(), raison: 'en double dans la liste' })
        else {
          const modif = {}
          if (ville !== connu.ville) modif.city = ville
          if (!connu.date) Object.assign(modif, { date_naissance: date, age: calculerAge(date) })
          if (Object.keys(modif).length) aMettreAJour.push({ id: connu.id, modif })
          connu.id = null // une deuxième ligne pour le même client est un doublon
        }
      })
      if (aCreer.length) {
        const { error } = await supabaseAdmin.from('seniors').insert(aCreer)
        if (error) throw error
      }
      for (const { id, modif } of aMettreAJour) {
        const { error } = await supabaseAdmin.from('seniors').update(modif).eq('id', id)
        if (error) throw error
      }
      return NextResponse.json({ success: true, ajoutes: aCreer.length, misAJour: aMettreAJour.length, ignores })
    }

    // Import du planning exporté du logiciel métier, à chaque mise à jour. Sur la période couverte par le fichier
    // (jamais dans le passé), le fichier fait référence pour les passages importés :
    // - passage absent de l'agenda : créé ; les salariés sont affectés au client au besoin ;
    // - passage importé à la même heure : intervenants et prestation mis à jour ;
    // - passage importé absent du fichier : supprimé si supprimerAbsents (annulé ou déplacé dans le logiciel).
    // Les passages saisis à la main dans l'agenda ne sont jamais modifiés ni supprimés.
    if (body.action === 'importer_planning') {
      const passages = Array.isArray(body.passages) ? body.passages.slice(0, 3000) : []
      const [{ data: clients }, { data: equipe }] = await Promise.all([
        supabaseAdmin.from('seniors').select('id').eq('structure_id', structureId),
        supabaseAdmin.from('salaries').select('*').eq('structure_id', structureId).is('archived_at', null),
      ])
      const idsClients = new Set((clients || []).map(c => c.id))
      const parId = new Map((equipe || []).map(s => [s.id, s]))
      const maintenant = Date.now()
      const valides = passages
        .map(p => ({
          seniorId: p.seniorId, quand: new Date(p.scheduledAt), label: champ(p.label, 120) || 'Passage',
          salaries: [...new Set(Array.isArray(p.salarieIds) ? p.salarieIds : [])].map(id => parId.get(id)).filter(Boolean),
        }))
        .filter(p => idsClients.has(p.seniorId) && !isNaN(p.quand) && p.quand.getTime() > maintenant)
      // Un fichier sans aucun passage à venir ne supprime rien (mauvais fichier, export vide)
      if (!valides.length) return NextResponse.json({ success: true, ajoutes: 0, modifies: 0, supprimes: 0, inchanges: 0, affectations: 0 })

      const heures = valides.map(p => p.quand.getTime())
      const debut = Math.max(maintenant, Math.min(new Date(body.periode?.debut).getTime() || Infinity, ...heures))
      const fin = Math.max(new Date(body.periode?.fin).getTime() || 0, Math.max(...heures) + 1)
      if (fin - debut > 93 * 24 * 3600 * 1000) return NextResponse.json({ success: false, error: 'Le planning importé ne peut pas dépasser 3 mois.' }, { status: 400 })

      const cle = (seniorId, quand) => seniorId + '|' + new Date(quand).getTime()
      const existants = await toutesLesLignes(() => supabaseAdmin.from('events')
        .select('id, senior_id, scheduled_at, label, intervenant_ids, importe')
        .in('senior_id', [...idsClients]).gte('scheduled_at', new Date(debut).toISOString()).lt('scheduled_at', new Date(fin).toISOString()))
      const parCle = new Map()
      for (const e of existants) if (!parCle.has(cle(e.senior_id, e.scheduled_at))) parCle.set(cle(e.senior_id, e.scheduled_at), e)

      const aCreer = [], aComparer = [], vus = new Set()
      let inchanges = 0
      for (const p of valides) {
        const c = cle(p.seniorId, p.quand)
        if (vus.has(c)) continue
        vus.add(c)
        const e = parCle.get(c)
        if (!e) aCreer.push(p)
        else if (e.importe) aComparer.push({ e, p })
        else inchanges++ // saisi à la main : on n'y touche pas
      }

      // Affectations manquantes : chaque salarié n'est prévenu qu'une fois, pour son premier nouveau client
      const lignesEquipe = async () => parId.size
        ? (await supabaseAdmin.from('intervenants').select('id, salarie_id, senior_id').in('salarie_id', [...parId.keys()]).is('archived_at', null)).data || []
        : []
      const affectes = new Set((await lignesEquipe()).map(a => a.salarie_id + '|' + a.senior_id))
      const prevenus = new Set()
      let affectations = 0
      for (const p of [...aCreer, ...aComparer.map(x => x.p)]) {
        for (const s of p.salaries) {
          if (affectes.has(s.id + '|' + p.seniorId)) continue
          affectes.add(s.id + '|' + p.seniorId)
          await affecterSalarie(s, p.seniorId, { prevenir: !prevenus.has(s.id) })
          prevenus.add(s.id)
          affectations++
        }
      }
      const ligneDe = new Map((await lignesEquipe()).map(a => [a.salarie_id + '|' + a.senior_id, a.id]))
      const champsPassage = p => {
        const ids = p.salaries.map(s => ligneDe.get(s.id + '|' + p.seniorId)).filter(Boolean)
        return {
          intervenant_id: ids[0] || null, intervenant_ids: ids, label: p.label,
          // Jamais « medical » : ce type envoie un compte rendu au médecin traitant la veille
          type: p.salaries.some(s => /kin/i.test(s.role || '')) ? 'kine' : 'care',
        }
      }

      const nouveaux = aCreer.map(p => ({ senior_id: p.seniorId, ...champsPassage(p), scheduled_at: p.quand.toISOString(), status: 'a_venir', importe: true }))
      for (let i = 0; i < nouveaux.length; i += 500) {
        const { error } = await supabaseAdmin.from('events').insert(nouveaux.slice(i, i + 500))
        if (error) throw error
      }

      let modifies = 0
      for (const { e, p } of aComparer) {
        const champs = champsPassage(p)
        const memeEquipe = [...champs.intervenant_ids].sort().join() === [...(e.intervenant_ids || [])].sort().join()
        if (memeEquipe && champs.label === e.label) { inchanges++; continue }
        const { error } = await supabaseAdmin.from('events').update(champs).eq('id', e.id)
        if (error) throw error
        modifies++
      }

      // Passages importés auparavant, à venir, absents du nouveau fichier
      const absents = body.supprimerAbsents === true ? existants.filter(e => e.importe && !vus.has(cle(e.senior_id, e.scheduled_at))).map(e => e.id) : []
      for (let i = 0; i < absents.length; i += 200) {
        const { error } = await supabaseAdmin.from('events').delete().in('id', absents.slice(i, i + 200))
        if (error) throw error
      }
      return NextResponse.json({ success: true, ajoutes: nouveaux.length, modifies, supprimes: absents.length, inchanges, affectations })
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
      await archiverSalaries([salarie.id])
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
