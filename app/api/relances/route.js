import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { escapeHtml, emailRelanceIntervenant, emailRelanceFamille, envoyerEnLots, lienDesinscription, entetesDesinscription, adressesDesinscrites } from '@/lib/emails'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // tâche serveur : les tables ne sont pas lisibles avec la clé publique
)

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const maintenant = new Date()
    const ilYa7j = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000)

    const { data: events } = await supabase
      .from('events')
      .select('*, intervenants(*), seniors(*)')
      .gte('scheduled_at', ilYa7j.toISOString())
      .lte('scheduled_at', maintenant.toISOString())
      .not('intervenant_id', 'is', null)

    // Proches sans nouvelles depuis 7 jours : envoyée chaque semaine, qu'il y ait eu des passages ou non
    const famillesRelancees = await relancerFamilles(ilYa7j)

    if (!events?.length) {
      return NextResponse.json({ success: true, message: 'Aucun intervenant actif cette semaine', relances: 0, familles_relancees: famillesRelancees })
    }

    const intervenantsVus = new Set()
    let relancesEnvoyees = 0

    for (const event of events) {
      const intervenant = event.intervenants
      if (!intervenant?.whatsapp) continue
      if (intervenantsVus.has(intervenant.id)) continue
      intervenantsVus.add(intervenant.id)

      const senior = event.seniors
      const phoneNumber = intervenant.whatsapp.replace('+', '').replace(/\s/g, '')
      const prenom = intervenant.name.split(' ')[0]
      const seniorName = senior?.name || 'votre patient'

      const response = await fetch(
        'https://graph.facebook.com/v18.0/' + process.env.META_PHONE_NUMBER_ID + '/messages',
        {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: phoneNumber,
            type: 'template',
            template: {
              name: 'relance_intervenant',
              language: { code: 'en' },
              components: [{
                type: 'body',
                parameters: [
                  { type: 'text', text: prenom },
                  { type: 'text', text: seniorName },
                ]
              }]
            }
          })
        }
      )

      const responseText = await response.text()
      let data
      try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }
      console.log('Relance envoyée à', intervenant.name, ':', JSON.stringify(data))

      if (response.ok) {
        await supabase.from('relances').insert({
          event_id: event.id,
          channel: 'whatsapp_meta',
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        relancesEnvoyees++
      }
    }

    const emailsEnvoyes = await relancerParEmail(events, ilYa7j)

    return NextResponse.json({
      success: true,
      relances: relancesEnvoyees,
      intervenants_contactes: intervenantsVus.size,
      emails_envoyes: emailsEnvoyes,
      familles_relancees: famillesRelancees,
    })

  } catch (error) {
    console.error('Erreur relances:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Email aux intervenants passés cette semaine qui n'ont envoyé aucune note pour ce senior
async function relancerParEmail(events, depuis) {
  const { data: notes } = await supabase
    .from('notes')
    .select('senior_id, intervenant_name')
    .gte('created_at', depuis.toISOString())
    .not('intervenant_name', 'is', null)

  const aDonneDesNouvelles = (intervenant) => (notes || []).some(n =>
    n.senior_id === intervenant.senior_id && n.intervenant_name.startsWith(intervenant.name)
  )

  const desinscrits = await adressesDesinscrites(supabase)

  // Un seul email par adresse, listant les seniors concernés
  const parEmail = new Map()
  for (const event of events) {
    const intervenant = event.intervenants
    if (!intervenant?.email || intervenant.archived_at) continue
    if (aDonneDesNouvelles(intervenant)) continue
    const email = intervenant.email.toLowerCase()
    if (desinscrits.has(email)) continue
    const entree = parEmail.get(email) || { prenom: intervenant.name.split(' ')[0], seniors: new Set() }
    if (event.seniors?.name) entree.seniors.add(event.seniors.name)
    parEmail.set(email, entree)
  }

  const messages = [...parEmail].filter(([, e]) => e.seniors.size).map(([email, e]) => ({
    from: 'Holiris <contact@holiris.fr>',
    to: email,
    subject: 'Des nouvelles de ' + [...e.seniors].join(', ') + ' ?',
    headers: entetesDesinscription(email),
    html: emailRelanceIntervenant({ prenom: escapeHtml(e.prenom), seniorNames: [...e.seniors].map(escapeHtml), desinscription: lienDesinscription(email).page }),
  }))
  return envoyerEnLots(resend, messages)
}

// Email aux proches (compte créé) qui n'ont laissé ni note ni message depuis 7 jours pour un senior qu'ils suivent
async function relancerFamilles(depuis) {
  const [{ data: proches }, { data: notes }, { data: messages }] = await Promise.all([
    supabase.from('famille').select('name, email, user_id, senior_id, seniors!famille_senior_id_fkey(name)')
      .is('archived_at', null).not('user_id', 'is', null).not('email', 'is', null).not('is_admin', 'is', true),
    supabase.from('notes').select('senior_id, intervenant_name').gte('created_at', depuis.toISOString()).not('intervenant_name', 'is', null),
    supabase.from('messages').select('senior_id, auteur_user_id').gte('created_at', depuis.toISOString()),
  ])

  const aDonneDesNouvelles = p =>
    (notes || []).some(n => n.senior_id === p.senior_id && n.intervenant_name.startsWith(p.name)) ||
    (messages || []).some(m => m.senior_id === p.senior_id && m.auteur_user_id === p.user_id)

  const desinscrits = await adressesDesinscrites(supabase)

  // Un seul email par adresse, listant les seniors concernés
  const parEmail = new Map()
  for (const p of proches || []) {
    if (!p.seniors?.name || aDonneDesNouvelles(p)) continue
    const email = p.email.toLowerCase()
    if (desinscrits.has(email)) continue
    const entree = parEmail.get(email) || { prenom: p.name.split(' ')[0], seniors: new Set() }
    entree.seniors.add(p.seniors.name)
    parEmail.set(email, entree)
  }

  const envois = [...parEmail].map(([email, e]) => ({
    from: 'Holiris <contact@holiris.fr>',
    to: email,
    subject: 'Des nouvelles de ' + [...e.seniors].join(', ') + ' à partager ?',
    headers: entetesDesinscription(email),
    html: emailRelanceFamille({ prenom: escapeHtml(e.prenom), seniorNames: [...e.seniors].map(escapeHtml), desinscription: lienDesinscription(email).page }),
  }))
  return envoyerEnLots(resend, envois)
}
