import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/serveur'
import { escapeHtml, emailCompteRendu, lienNoteMedecin, lienDesinscription, entetesDesinscription, adressesDesinscrites } from '@/lib/emails'

// Chaque matin : compte rendu au médecin traitant la veille de chaque consultation
// (rendez-vous « Médical » de l'agenda), couvrant la période depuis la consultation précédente.

export const maxDuration = 60

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })
const resend = new Resend(process.env.RESEND_API_KEY)
const JOUR = 24 * 60 * 60 * 1000
const FUSEAU = 'Europe/Paris'

const jourParis = d => new Date(d).toLocaleDateString('fr-CA', { timeZone: FUSEAU }) // AAAA-MM-JJ
const dateCourte = d => new Date(d).toLocaleDateString('fr-FR', { timeZone: FUSEAU, day: 'numeric', month: 'long' })

async function resumer(seniorName, notes, alertes) {
  if (!notes.length) return 'Aucune note n\'a été partagée sur cette période.'
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b', // modèle plus précis : synthèse destinée au médecin
      reasoning_effort: 'low',
      max_completion_tokens: 1200,
      messages: [
        { role: 'system', content: 'Tu rédiges une synthèse factuelle pour le médecin traitant d\'une personne âgée suivie à domicile. Les notes sont écrites par ses aides à domicile et ses proches : l\'auteur est indiqué avant les deux-points, mais chaque note décrit la personne suivie. Ne confonds jamais un auteur avec la personne suivie. N\'évoque que ce qui figure dans les notes : n\'invente ni ne déduis rien, et ne mentionne pas un sujet absent des notes (sommeil, chutes…). Sois précis, neutre et concis. Ne pose aucun diagnostic et ne propose aucun traitement. Réponds en français.' },
        { role: 'user', content: `Personne suivie : ${seniorName}.\n\nNotes (auteur : contenu) :\n${notes.map(n => `[${dateCourte(n.created_at)}] ${n.intervenant_name || 'Proche'} : ${n.content}`).join('\n')}\n\nAlertes :\n${alertes.map(a => '- ' + a.message).join('\n') || 'Aucune.'}\n\nRédige un paragraphe de 3 à 6 phrases sur ${seniorName}, sans liste, en t\'appuyant uniquement sur ces notes : état général et moral, alimentation, mobilité, faits marquants et évolution sur la période.` },
      ],
    })
    return (completion.choices[0]?.message?.content || '').replace(/\s+/g, ' ').trim() || 'Synthèse indisponible.'
  } catch (e) {
    console.error('Erreur synthèse compte rendu:', e.message)
    return 'Synthèse indisponible : voir les dernières notes ci-dessous.'
  }
}

export async function GET(request) {
  if (request.headers.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const maintenant = Date.now()
    const demain = jourParis(maintenant + JOUR)

    // Consultations de demain (heure de Paris) pas encore annoncées
    const { data: candidats } = await supabaseAdmin.from('events')
      .select('id, senior_id, label, scheduled_at, seniors(name, medecin_traitant_id)')
      .eq('type', 'medical').is('compte_rendu_envoye_at', null)
      .gte('scheduled_at', new Date(maintenant).toISOString())
      .lte('scheduled_at', new Date(maintenant + 2 * JOUR).toISOString())
    const consultations = (candidats || []).filter(e => jourParis(e.scheduled_at) === demain && e.seniors?.medecin_traitant_id)
    if (!consultations.length) return NextResponse.json({ success: true, envoyes: 0 })

    const desinscrits = await adressesDesinscrites(supabaseAdmin)
    let envoyes = 0

    for (const rdv of consultations) {
      const { data: medecin } = await supabaseAdmin.from('intervenants')
        .select('id, name, email, archived_at').eq('id', rdv.seniors.medecin_traitant_id).maybeSingle()
      if (!medecin?.email || medecin.archived_at || desinscrits.has(medecin.email.toLowerCase())) continue

      // Période : depuis la consultation précédente, sinon les 30 derniers jours (60 au plus)
      const { data: precedente } = await supabaseAdmin.from('events').select('scheduled_at')
        .eq('senior_id', rdv.senior_id).eq('type', 'medical').lt('scheduled_at', new Date(maintenant).toISOString())
        .order('scheduled_at', { ascending: false }).limit(1)
      const debut = precedente?.[0] ? Math.max(new Date(precedente[0].scheduled_at).getTime(), maintenant - 60 * JOUR) : maintenant - 30 * JOUR
      const depuis = precedente?.[0] ? 'depuis la dernière consultation du ' + dateCourte(precedente[0].scheduled_at) : 'ces 30 derniers jours'

      const [{ data: notes }, { data: alertes }] = await Promise.all([
        supabaseAdmin.from('notes').select('content, intervenant_name, created_at').eq('senior_id', rdv.senior_id)
          .gte('created_at', new Date(debut).toISOString()).order('created_at', { ascending: true }),
        supabaseAdmin.from('alertes').select('message, niveau, created_at').eq('senior_id', rdv.senior_id)
          .gte('created_at', new Date(debut).toISOString()).order('created_at', { ascending: false }),
      ])

      const seniorName = rdv.seniors.name
      const resume = await resumer(seniorName, notes || [], alertes || [])
      const expire = new Date(rdv.scheduled_at).getTime() + 3 * JOUR
      const email = medecin.email.toLowerCase()

      const { error } = await resend.emails.send({
        from: 'Holiris <contact@holiris.fr>',
        to: email,
        subject: 'Consultation de demain — ' + seniorName,
        headers: entetesDesinscription(email),
        html: emailCompteRendu({
          prenomMedecin: escapeHtml(medecin.name?.split(' ').slice(-1)[0]),
          seniorName: escapeHtml(seniorName),
          dateConsultation: escapeHtml(new Date(rdv.scheduled_at).toLocaleString('fr-FR', { timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })),
          depuis: escapeHtml(depuis),
          resume: escapeHtml(resume),
          alertes: (alertes || []).slice(0, 8).map(a => ({ urgent: a.niveau === 'danger', date: escapeHtml(dateCourte(a.created_at)), message: escapeHtml(a.message) })),
          notes: (notes || []).slice(-6).reverse().map(n => ({ date: escapeHtml(dateCourte(n.created_at)), auteur: escapeHtml(n.intervenant_name || 'Proche'), contenu: escapeHtml(n.content) })),
          lienNote: lienNoteMedecin(medecin.id, rdv.senior_id, expire),
          desinscription: lienDesinscription(email).page,
        }),
      })
      if (error) { console.error('Erreur envoi compte rendu:', error); continue }

      await supabaseAdmin.from('events').update({ compte_rendu_envoye_at: new Date().toISOString() }).eq('id', rdv.id)
      envoyes++
    }

    return NextResponse.json({ success: true, envoyes })
  } catch (error) {
    console.error('Erreur comptes rendus:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
