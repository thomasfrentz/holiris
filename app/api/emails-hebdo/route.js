import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { escapeHtml, emailResumeFamille, emailNouveauCompte, envoyerEnLots, lienDesinscription, entetesDesinscription, adressesDesinscrites } from '@/lib/emails'

// Envois du dimanche : résumé de la semaine aux familles + rappel des invitations en attente

export const maxDuration = 60

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const JOUR = 24 * 60 * 60 * 1000

async function genererResume(seniorName, notes, alertes) {
  const notesText = notes.map(n =>
    `[${new Date(n.created_at).toLocaleDateString('fr-FR')}] ${n.intervenant_name || 'Proche'} : ${n.content}`
  ).join('\n')
  const alertesText = alertes.length ? alertes.map(a => `- ${a.message}`).join('\n') : 'Aucune alerte.'

  const completion = await groq.chat.completions.create({
    model: 'openai/gpt-oss-20b',
    reasoning_effort: 'low',
    max_completion_tokens: 800,
    messages: [
      {
        role: 'system',
        content: 'Tu écris aux proches d\'une personne âgée. Ton chaleureux, simple et rassurant sans minimiser. Ne mentionne jamais de diagnostic ni de traitement.'
      },
      {
        role: 'user',
        content: `Voici les notes de suivi de ${seniorName} cette semaine.

NOTES :
${notesText}

ALERTES :
${alertesText}

Rédige un seul paragraphe de 3 à 5 phrases, sans liste ni titre : le moral et l'état général, les visites et activités, et ce qui mérite l'attention de la famille.`
      }
    ]
  })
  return (completion.choices[0]?.message?.content || '').replace(/\s+/g, ' ').trim()
}

// Résumé hebdomadaire aux proches ayant un compte actif
async function resumesFamilles(desinscrits) {
  const { data: tousProches } = await supabase
    .from('famille')
    .select('name, email, senior_id, seniors!famille_senior_id_fkey(name)')
    .not('user_id', 'is', null)
    .not('email', 'is', null)
    .not('senior_id', 'is', null)
    .is('archived_at', null)
  const proches = (tousProches || []).filter(p => !desinscrits.has(p.email.toLowerCase()))
  if (!proches.length) return 0

  // Un résumé par senior, seulement s'il y a eu des notes cette semaine
  const depuis = new Date(Date.now() - 7 * JOUR).toISOString()
  const resumes = {}
  for (const seniorId of new Set(proches.map(p => p.senior_id))) {
    const [notesRes, alertesRes] = await Promise.all([
      supabase.from('notes').select('*').eq('senior_id', seniorId).gte('created_at', depuis).order('created_at', { ascending: true }),
      supabase.from('alertes').select('message').eq('senior_id', seniorId).eq('lu', false),
    ])
    if (!notesRes.data?.length) continue
    const seniorName = proches.find(p => p.senior_id === seniorId).seniors?.name || ''
    try {
      const resume = await genererResume(seniorName, notesRes.data, alertesRes.data || [])
      if (resume) resumes[seniorId] = { seniorName: escapeHtml(seniorName), resume: escapeHtml(resume) }
    } catch (e) { console.error('Erreur résumé', seniorId, e.message) }
  }

  // Un seul email par adresse, regroupant tous les seniors suivis
  const parEmail = new Map()
  for (const p of proches) {
    if (!resumes[p.senior_id]) continue
    const email = p.email.toLowerCase()
    const entree = parEmail.get(email) || { prenom: p.name?.split(' ')[0] || '', resumes: [] }
    if (!entree.resumes.includes(resumes[p.senior_id])) entree.resumes.push(resumes[p.senior_id])
    parEmail.set(email, entree)
  }

  const messages = [...parEmail].map(([email, e]) => ({
    from: 'Holiris <contact@holiris.fr>',
    to: email,
    subject: 'Les nouvelles de la semaine — ' + e.resumes.map(r => r.seniorName).join(', '),
    headers: entetesDesinscription(email),
    html: emailResumeFamille({ prenom: escapeHtml(e.prenom), resumes: e.resumes, desinscription: lienDesinscription(email).page }),
  }))
  return envoyerEnLots(resend, messages)
}

// Rappel aux invités qui n'ont pas encore créé leur compte (pendant 30 jours)
async function rappelsInvitations(desinscrits) {
  const maintenant = Date.now()
  const messages = []

  for (const [table, type] of [['famille', 'famille'], ['intervenants', 'intervenant']]) {
    const fkey = table === 'famille' ? 'famille_senior_id_fkey' : 'intervenants_senior_id_fkey'
    const { data } = await supabase
      .from(table)
      .select(`name, email, role, invite_token, created_at, seniors!${fkey}(name)`)
      .is('user_id', null)
      .is('archived_at', null)
      .not('email', 'is', null)
      .not('invite_token', 'is', null)
      .gte('created_at', new Date(maintenant - 30 * JOUR).toISOString())
      // Pas de rappel pour une invitation envoyée il y a moins de 3 jours
      .lte('created_at', new Date(maintenant - 3 * JOUR).toISOString())

    for (const m of data || []) {
      if (desinscrits.has(m.email.toLowerCase())) continue
      messages.push({
        from: 'Holiris <contact@holiris.fr>',
        to: m.email,
        headers: entetesDesinscription(m.email),
        subject: 'Rappel — Votre accès Holiris pour le suivi de ' + (m.seniors?.name || ''),
        html: emailNouveauCompte({
          prenom: escapeHtml(m.name?.split(' ')[0]),
          role: escapeHtml(m.role),
          seniorName: escapeHtml(m.seniors?.name),
          token: m.invite_token,
          email: m.email,
          type,
          relance: true,
          desinscription: lienDesinscription(m.email).page,
        }),
      })
    }
  }
  return envoyerEnLots(resend, messages)
}

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const desinscrits = await adressesDesinscrites(supabase)
    const resumes = await resumesFamilles(desinscrits)
    const rappels = await rappelsInvitations(desinscrits)
    return NextResponse.json({ success: true, resumes_envoyes: resumes, rappels_envoyes: rappels })
  } catch (error) {
    console.error('Erreur emails hebdo:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
