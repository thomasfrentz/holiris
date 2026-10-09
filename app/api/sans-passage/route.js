import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { escapeHtml, emailSansPassage, envoyerEnLots, lienDesinscription, entetesDesinscription, adressesDesinscrites } from '@/lib/emails'
import { envoyerPush, comptesDuSenior } from '@/lib/push'

// Tâche quotidienne : un senior sans aucune note depuis 3 jours (ni intervenant, ni proche) déclenche une alerte
// sur le tableau de bord et un email aux proches. Une seule fois par période de silence.
// L'alerte n'est pas affichée sur la borne, pour ne pas inquiéter la personne suivie.

const resend = new Resend(process.env.RESEND_API_KEY)
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const TROIS_JOURS = 3 * 24 * 3600 * 1000

const dateLongue = d => new Date(d).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Paris' })

export async function GET(request) {
  if (request.headers.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { data: seniors } = await supabase.from('seniors').select('id, name')
    const silencieux = []

    for (const senior of seniors || []) {
      const { data: derniere } = await supabase.from('notes').select('created_at')
        .eq('senior_id', senior.id).order('created_at', { ascending: false }).limit(1)
      // Dossier sans aucune note : pas encore en service
      if (!derniere?.length) continue
      const depuis = derniere[0].created_at
      if (Date.now() - new Date(depuis).getTime() < TROIS_JOURS) continue

      // Déjà signalé pour ce silence ?
      const { data: deja } = await supabase.from('alertes').select('id')
        .eq('senior_id', senior.id).eq('type', 'sans_passage').gt('created_at', depuis).limit(1)
      if (deja?.length) continue

      const prenom = senior.name.split(' ')[0]
      await supabase.from('alertes').insert({
        senior_id: senior.id, type: 'sans_passage', niveau: 'warning',
        message: `Aucun passage enregistré pour ${prenom} depuis le ${dateLongue(depuis)}`,
      })
      silencieux.push({ ...senior, prenom, depuis })
      await envoyerPush({ userIds: await comptesDuSenior(senior.id, { intervenants: false }) }, {
        title: `⚠️ Pas de nouvelles de ${prenom}`,
        body: `Aucun passage enregistré depuis le ${dateLongue(depuis)}. Avez-vous des nouvelles ?`,
        url: '/note',
        tag: 'sans-passage-' + senior.id,
      })
    }

    if (!silencieux.length) return NextResponse.json({ success: true, alertes: 0, emails: 0 })

    // Un email par adresse, listant les seniors concernés
    const { data: proches } = await supabase.from('famille').select('name, email, senior_id')
      .in('senior_id', silencieux.map(s => s.id)).is('archived_at', null).not('email', 'is', null)
    const desinscrits = await adressesDesinscrites(supabase)
    const parEmail = new Map()
    for (const p of proches || []) {
      const email = p.email.toLowerCase()
      if (desinscrits.has(email)) continue
      const s = silencieux.find(x => x.id === p.senior_id)
      const entree = parEmail.get(email) || { prenom: p.name.split(' ')[0], seniors: [] }
      if (!entree.seniors.some(x => x.id === s.id)) entree.seniors.push(s)
      parEmail.set(email, entree)
    }

    const envois = [...parEmail].map(([email, e]) => ({
      from: 'Holiris <contact@holiris.fr>',
      to: email,
      subject: 'Pas de nouvelles de ' + e.seniors.map(s => s.prenom).join(' et ') + ' depuis 3 jours',
      headers: entetesDesinscription(email),
      html: emailSansPassage({
        prenom: escapeHtml(e.prenom),
        seniors: e.seniors.map(s => ({ nom: escapeHtml(s.name), prenom: escapeHtml(s.prenom), depuis: dateLongue(s.depuis) })),
        desinscription: lienDesinscription(email).page,
      }),
    }))
    const emails = await envoyerEnLots(resend, envois)
    return NextResponse.json({ success: true, alertes: silencieux.length, emails })
  } catch (error) {
    console.error('Erreur sans-passage:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
