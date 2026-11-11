// Passages réguliers sans planning : un intervenant qui laisse ses notes chez un senior les mêmes jours,
// vers la même heure, sans aucun passage à l'agenda, reçoit de Holiris un message privé lui proposant
// d'ajouter ces passages à l'agenda. Il accepte ou refuse en un clic dans la messagerie.
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
function enParis(instant) {
  const d = new Date(new Date(instant).toLocaleString('en-US', { timeZone: 'Europe/Paris' }))
  return { jour: d.getDay(), minutes: d.getHours() * 60 + d.getMinutes(), date: `${d.getFullYear()}-${deux(d.getMonth() + 1)}-${deux(d.getDate())}` }
}

// Instant d'une date et d'une heure de Paris (heure d'été comprise)
function instantParis(date, heure) {
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

// Tâche quotidienne : une proposition par intervenant et par senior concernés. Renvoie le nombre envoyé.
export async function proposerPassagesReguliers() {
  const depuis = new Date(Date.now() - FENETRE).toISOString()
  const notes = await toutesLesLignes(() => supabaseAdmin.from('notes').select('intervenant_id, created_at')
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
    const { count } = await supabaseAdmin.from('events').select('id', { count: 'exact', head: true })
      .eq('senior_id', fiche.senior_id).gte('scheduled_at', depuis)
      .or(`intervenant_id.eq.${fiche.id},intervenant_ids.cs.{${fiche.id}}`)
    if (count) continue
    const { data: deja } = await supabaseAdmin.from('propositions_passages').select('id')
      .eq('intervenant_id', fiche.id).gte('created_at', new Date(Date.now() - SANS_REPETER).toISOString()).limit(1)
    if (deja?.length) continue

    await envoyerProposition(fiche, motif)
    envoyees++
  }
  return envoyees
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
export async function creerPassages(proposition, fiche) {
  const jours = proposition.jours.split(',')
  const curseur = new Date(enParis(Date.now()).date + 'T12:00:00Z')
  const fin = new Date(curseur)
  fin.setUTCMonth(fin.getUTCMonth() + MOIS)
  const base = {
    senior_id: proposition.senior_id, intervenant_id: fiche.id, intervenant_ids: [fiche.id],
    label: 'Passage de ' + fiche.name.split(' ')[0],
    // Jamais « medical » : ce type envoie un compte rendu au médecin traitant la veille
    type: /kin/i.test(fiche.role || '') ? 'kine' : 'care',
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
