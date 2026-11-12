// Passages réguliers sans planning : un intervenant qui laisse ses notes chez un senior les mêmes jours,
// vers la même heure, sans aucun passage à l'agenda, reçoit de Holiris un message privé lui proposant
// d'ajouter ces passages à l'agenda. Il accepte ou refuse en un clic dans la messagerie.
// Intervenants qui se relaient (deux infirmières en alternance) ou sans compte : leurs notes sont regroupées
// par corps de métier, et la proposition va aux proches qui ont un compte.
import { supabaseAdmin } from '@/lib/serveur'
import { envoyerPush } from '@/lib/push'
import { EXPEDITEUR_HOLIRIS } from '@/lib/expediteurHoliris'
import { joursEnClair, heureEnClair } from '@/lib/horairesEnClair'

const JOUR = 24 * 3600 * 1000
const FENETRE = 28 * JOUR       // notes des 4 dernières semaines
const MIN_SEMAINES = 3          // un jour est régulier s'il revient au moins 3 semaines sur 4
const ECART = 60                // minutes autour de l'heure habituelle
const SANS_REPETER = 60 * JOUR  // une proposition, acceptée ou non, n'est pas répétée avant 60 jours
const MOIS = 3                  // passages créés sur 3 mois, comme une récurrence saisie dans l'agenda

const deux = n => String(n).padStart(2, '0')
const mediane = t => { const s = [...t].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)] }

// Jour de la semaine, minutes et date d'un instant, à l'heure de Paris
export function enParis(instant) {
  const d = new Date(new Date(instant).toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  return { jour: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes(), date: `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}` }
}

// Instant d'une date et d'une heure de Paris (heure d'été comprise)
export function instantParis(date, heure) {
  const naif = new Date(date + 'T' + heure + ':00Z')
  const decalage = new Date(naif.toLocaleString('en-US', { timeZone: 'Europe/Paris' })) - new Date(naif.toLocaleString('en-US', { timeZone: 'UTC' }))
  return new Date(naif.getTime() - decalage)
}

// Heures des notes → { jours: [2, 4], heure: '09:00' } si des jours reviennent chaque semaine à la même heure.
// Une note par jour (la première, laissée en fin de passage) ; l'heure proposée est arrondie à la demi-heure inférieure.
export function motifRegulier(instants) {
  const parDate = new Map()
  for (const t of instants) {
    const p = enParis(t)
    if (!parDate.has(p.date) || p.minutes < parDate.get(p.date).minutes) parDate.set(p.date, p)
  }
  const reguliers = []
  for (let jour = 0; jour < 7; jour++) {
    const minutes = [...parDate.values()].filter(p => p.jour === jour).map(p => p.minutes)
    if (minutes.length < MIN_SEMAINES) continue
    const proches = minutes.filter(m => Math.abs(m - mediane(minutes)) <= ECART)
    if (proches.length >= MIN_SEMAINES) reguliers.push({ jour, minutes: mediane(proches) })
  }
  // Jours réguliers à la même heure, à une heure près : le groupe le plus fourni
  let groupe = []
  for (const r of reguliers) {
    const memeHeure = reguliers.filter(x => Math.abs(x.minutes - r.minutes) <= ECART)
    if (memeHeure.length > groupe.length) groupe = memeHeure
  }
  if (!groupe.length) return null
  const minutes = Math.floor(mediane(groupe.map(r => r.minutes)) / 30) * 30
  return { jours: groupe.map(r => r.jour), heure: deux(Math.floor(minutes / 60)) + ':' + deux(minutes % 60) }
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

// Métier d'un groupe : nom dans le message aux proches, libellé et type des passages créés
const METIERS = {
  soins: { nom: 'soins infirmiers', libelle: 'Passage infirmier', type: 'care' },
  aide: { nom: 'aide à domicile', libelle: 'Aide à domicile', type: 'care' },
  kine: { nom: 'kinésithérapie', libelle: 'Kinésithérapie', type: 'kine' },
  // Jamais « medical » : ce type envoie un compte rendu au médecin traitant la veille
  medecin: { nom: 'médecin', libelle: 'Passage du médecin', type: 'care' },
  pharmacie: { nom: 'pharmacie', libelle: 'Pharmacie', type: 'care' },
}

// Passages d'un seul intervenant
export const passagesDe = fiche => ({
  ids: [fiche.id], libelle: 'Passage de ' + fiche.name.trim().split(' ')[0],
  type: /kin/i.test(fiche.role || '') ? 'kine' : 'care',
})
// Passages d'une proposition faite à un groupe (même corps de métier)
export const passagesDuGroupe = p => ({ ids: p.intervenant_ids, libelle: METIERS[p.metier]?.libelle || 'Passage', type: METIERS[p.metier]?.type || 'care' })

// Des passages de ces intervenants sont-ils déjà à l'agenda de ce senior (récents ou à venir) ?
async function dejaPlanifies(seniorId, ids, depuis) {
  const { count } = await supabaseAdmin.from('events').select('id', { count: 'exact', head: true })
    .eq('senior_id', seniorId).gte('scheduled_at', depuis)
    .or(ids.flatMap(id => [`intervenant_id.eq.${id}`, `intervenant_ids.cs.{${id}}`]).join(','))
  return count > 0
}

// Tâche quotidienne : une proposition par intervenant et par senior concernés, puis par métier. Renvoie le nombre envoyé.
export async function proposerPassagesReguliers() {
  const depuis = new Date(Date.now() - FENETRE).toISOString()
  const notes = await toutesLesLignes(() => supabaseAdmin.from('notes').select('intervenant_id, senior_id, metier, created_at')
    .not('intervenant_id', 'is', null).gte('created_at', depuis).order('created_at'))
  const parFiche = new Map()
  for (const n of notes) parFiche.set(n.intervenant_id, [...(parFiche.get(n.intervenant_id) || []), n.created_at])

  let envoyees = 0
  for (const [ficheId, instants] of parFiche) {
    const motif = instants.length >= MIN_SEMAINES && motifRegulier(instants)
    if (!motif) continue
    const { data: fiche } = await supabaseAdmin.from('intervenants')
      .select('id, name, role, user_id, senior_id, archived_at, seniors!intervenants_senior_id_fkey(name)').eq('id', ficheId).maybeSingle()
    // Seul un intervenant qui a un compte lit la messagerie
    if (!fiche || fiche.archived_at || !fiche.user_id || !fiche.seniors) continue

    // Des passages de cet intervenant sont déjà à l'agenda de ce senior (récents ou à venir) : rien à proposer
    if (await dejaPlanifies(fiche.senior_id, [fiche.id], depuis)) continue
    const { data: deja } = await supabaseAdmin.from('propositions_passages').select('id')
      .eq('intervenant_id', fiche.id).gte('created_at', new Date(Date.now() - SANS_REPETER).toISOString()).limit(1)
    if (deja?.length) continue

    await envoyerProposition(fiche, motif)
    envoyees++
  }
  return envoyees + await proposerParMetier(notes, depuis)
}

// Notes d'un même corps de métier chez un senior, tous intervenants confondus : régulières ensemble,
// sans passage à l'agenda → proposition aux proches qui ont un compte
async function proposerParMetier(notes, depuis) {
  const groupes = new Map()
  for (const n of notes) {
    if (!n.metier || !METIERS[n.metier]) continue
    const cle = n.senior_id + '|' + n.metier
    if (!groupes.has(cle)) groupes.set(cle, { seniorId: n.senior_id, metier: n.metier, ids: new Set(), instants: [] })
    const g = groupes.get(cle)
    g.ids.add(n.intervenant_id)
    g.instants.push(n.created_at)
  }

  let envoyees = 0
  for (const g of groupes.values()) {
    const motif = g.instants.length >= MIN_SEMAINES && motifRegulier(g.instants)
    if (!motif) continue
    const { data: fiches } = await supabaseAdmin.from('intervenants').select('id, name, user_id, archived_at').in('id', [...g.ids])
    const actives = (fiches || []).filter(f => !f.archived_at && f.name?.trim())
    // Un seul intervenant, avec un compte : la proposition lui est faite à lui (ci-dessus)
    if (!actives.length || (actives.length === 1 && actives[0].user_id)) continue
    const ids = actives.map(f => f.id)
    if (await dejaPlanifies(g.seniorId, ids, depuis)) continue

    const ilYA60Jours = new Date(Date.now() - SANS_REPETER).toISOString()
    const [{ data: dejaMetier }, { data: dejaFiche }] = await Promise.all([
      supabaseAdmin.from('propositions_passages').select('id').eq('senior_id', g.seniorId).eq('metier', g.metier).gte('created_at', ilYA60Jours).limit(1),
      supabaseAdmin.from('propositions_passages').select('id').in('intervenant_id', ids).gte('created_at', ilYA60Jours).limit(1),
    ])
    if (dejaMetier?.length || dejaFiche?.length) continue

    const [{ data: senior }, { data: proches }] = await Promise.all([
      supabaseAdmin.from('seniors').select('name').eq('id', g.seniorId).maybeSingle(),
      supabaseAdmin.from('famille').select('id, name, user_id').eq('senior_id', g.seniorId).is('archived_at', null).not('user_id', 'is', null),
    ])
    if (!senior || !proches?.length) continue

    await envoyerPropositionAuxProches({ seniorId: g.seniorId, senior, metier: g.metier, fiches: actives, proches, motif })
    envoyees++
  }
  return envoyees
}

async function envoyerPropositionAuxProches({ seniorId, senior, metier, fiches, proches, motif }) {
  const { data: proposition, error } = await supabaseAdmin.from('propositions_passages').insert({
    intervenant_id: null, intervenant_ids: fiches.map(f => f.id), metier, senior_id: seniorId,
    jours: motif.jours.join(','), heure: motif.heure,
  }).select().single()
  if (error) throw error

  const prenoms = fiches.map(f => f.name.trim().split(' ')[0])
  const qui = (prenoms.length > 1 ? prenoms.slice(0, -1).join(', ') + ' et ' + prenoms[prenoms.length - 1] : prenoms[0]) + ' (' + METIERS[metier].nom + ')'
  const plusieurs = prenoms.length > 1
  const prenomSenior = senior.name.split(' ')[0]
  const quand = joursEnClair(motif.jours) + ' vers ' + heureEnClair(motif.heure)
  const { error: e } = await supabaseAdmin.from('messages').insert(proches.map(p => ({
    senior_id: seniorId,
    auteur_user_id: EXPEDITEUR_HOLIRIS, auteur_nom: 'Holiris', auteur_role: 'Message automatique', auteur_type: 'holiris',
    destinataire_type: 'famille', destinataire_id: p.id, destinataire_nom: p.name,
    contenu: `Bonjour ${p.name.split(' ')[0]}, ${qui} ${plusieurs ? 'laissent' : 'laisse'} régulièrement ${plusieurs ? 'leurs' : 'ses'} notes pour ${prenomSenior} ${quand}, mais ces passages ne sont pas dans son agenda.\n\nVoulez-vous les y ajouter ? Tout le monde saura quand ${plusieurs ? 'ils passent' : 'il passe'}.`,
    proposition_id: proposition.id,
  })))
  if (e) throw e
  await envoyerPush({ userIds: [...new Set(proches.map(p => p.user_id))] }, {
    title: 'Holiris',
    body: `Ajouter les passages ${METIERS[metier].nom} chez ${prenomSenior} (${quand}) à son agenda ?`,
    url: '/messages',
    tag: 'proposition-' + proposition.id,
  })
}

async function envoyerProposition(fiche, motif) {
  const { data: proposition, error } = await supabaseAdmin.from('propositions_passages').insert({
    intervenant_id: fiche.id, senior_id: fiche.senior_id, jours: motif.jours.join(','), heure: motif.heure,
  }).select().single()
  if (error) throw error

  const prenom = fiche.name.split(' ')[0]
  const prenomSenior = fiche.seniors.name.split(' ')[0]
  const quand = joursEnClair(motif.jours) + ' vers ' + heureEnClair(motif.heure)
  const { error: e } = await supabaseAdmin.from('messages').insert({
    senior_id: fiche.senior_id,
    auteur_user_id: EXPEDITEUR_HOLIRIS, auteur_nom: 'Holiris', auteur_role: 'Message automatique', auteur_type: 'holiris',
    destinataire_type: 'intervenant', destinataire_id: fiche.id, destinataire_nom: fiche.name,
    contenu: `Bonjour ${prenom}, vous laissez régulièrement vos notes pour ${prenomSenior} ${quand}, mais ces passages ne sont pas dans son agenda.\n\nVoulez-vous les y ajouter ? Ses proches sauront quand vous venez.`,
    proposition_id: proposition.id,
  })
  if (e) throw e
  await envoyerPush({ userIds: [fiche.user_id] }, {
    title: 'Holiris',
    body: `Ajouter vos passages chez ${prenomSenior} (${quand}) à son agenda ?`,
    url: '/messages',
    tag: 'proposition-' + proposition.id,
  })
}

// Passages hebdomadaires de la proposition, de demain à dans 3 mois. Renvoie le nombre créé.
// qui : { ids, libelle, type } (passagesDe ou passagesDuGroupe)
export async function creerPassages(proposition, qui) {
  const jours = proposition.jours.split(',')
  const curseur = new Date(enParis(Date.now()).date + 'T12:00:00Z')
  const fin = new Date(curseur)
  fin.setUTCMonth(fin.getUTCMonth() + MOIS)
  const base = {
    senior_id: proposition.senior_id, intervenant_id: qui.ids[0] || null, intervenant_ids: qui.ids,
    label: qui.libelle, type: qui.type,
    status: 'a_venir', recurrence: 'weekly', recurrence_days: proposition.jours,
  }
  const passages = []
  for (curseur.setUTCDate(curseur.getUTCDate() + 1); curseur <= fin; curseur.setUTCDate(curseur.getUTCDate() + 1)) {
    if (jours.includes(String(curseur.getUTCDay()))) {
      passages.push({ ...base, scheduled_at: instantParis(curseur.toISOString().slice(0, 10), proposition.heure).toISOString() })
    }
  }
  if (passages.length) {
    const { error } = await supabaseAdmin.from('events').insert(passages)
    if (error) throw error
  }
  return passages.length
}
