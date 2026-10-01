import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/serveur'
import { escapeHtml, emailSos, envoyerEnLots } from '@/lib/emails'

// Bouton SOS de la borne : alerte rouge sur le tableau de bord, email et WhatsApp à toute la famille.
// La borne n'a pas de compte connecté : son code sert de clé, comme pour les notes.

const resend = new Resend(process.env.RESEND_API_KEY)
const DELAI_DOUBLON = 2 * 60 * 1000

// « 06 12 34 56 78 » ou « +33 6 12… » → « 33612345678 » (format attendu par l'API WhatsApp)
function numeroWhatsapp(numero) {
  const n = String(numero || '').replace(/[\s.-]/g, '')
  if (!n) return null
  if (n.startsWith('+')) return n.slice(1)
  if (n.startsWith('00')) return n.slice(2)
  if (n.startsWith('0')) return '33' + n.slice(1)
  return n
}

// Modèle « alerte_sos » à faire approuver dans Meta (catégorie Utilité, langue français)
async function envoyerWhatsapp(numero, seniorName, heure) {
  try {
    const res = await fetch('https://graph.facebook.com/v18.0/' + process.env.META_PHONE_NUMBER_ID + '/messages', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: numero,
        type: 'template',
        template: {
          name: 'alerte_sos',
          language: { code: 'fr' },
          components: [{ type: 'body', parameters: [{ type: 'text', text: seniorName }, { type: 'text', text: heure }] }],
        },
      }),
    })
    if (!res.ok) console.error('SOS WhatsApp refusé:', await res.text())
    return res.ok
  } catch (error) {
    console.error('SOS WhatsApp erreur:', error.message)
    return false
  }
}

export async function POST(request) {
  try {
    const { code, auto } = await request.json()
    const { data: borne } = await supabaseAdmin.from('bornes')
      .select('senior_id, seniors(name)').eq('code', String(code || '').trim().toUpperCase()).maybeSingle()
    if (!borne) return NextResponse.json({ success: false, error: 'Code borne invalide' }, { status: 404 })
    const seniorName = borne.seniors?.name || 'Votre proche'

    // Un second appui dans les 2 minutes ne renvoie pas les messages (la famille est déjà prévenue)
    const { data: recente } = await supabaseAdmin.from('alertes').select('id')
      .eq('senior_id', borne.senior_id).eq('type', 'sos')
      .gte('created_at', new Date(Date.now() - DELAI_DOUBLON).toISOString()).limit(1)
    if (recente?.length) return NextResponse.json({ success: true, dejaPrevenus: true })

    const heure = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
    await supabaseAdmin.from('alertes').insert({
      senior_id: borne.senior_id, type: 'sos', niveau: 'danger',
      message: `🆘 SOS déclenché depuis la borne à ${heure}` + (auto ? ' (sans réponse à la confirmation)' : ''),
    })

    const { data: famille } = await supabaseAdmin.from('famille')
      .select('name, email, phone, whatsapp').eq('senior_id', borne.senior_id).is('archived_at', null)

    const emails = new Map()
    const numeros = new Set()
    for (const f of famille || []) {
      if (f.email && !emails.has(f.email.toLowerCase())) emails.set(f.email.toLowerCase(), f)
      const numero = numeroWhatsapp(f.whatsapp || f.phone)
      if (numero) numeros.add(numero)
    }

    const [emailsEnvoyes, ...whatsapp] = await Promise.all([
      envoyerEnLots(resend, [...emails].map(([email, f]) => ({
        from: 'Holiris <contact@holiris.fr>',
        to: email,
        subject: `🆘 SOS — ${seniorName} a demandé de l'aide`,
        html: emailSos({ prenom: escapeHtml(f.name?.split(' ')[0]), seniorName: escapeHtml(seniorName), heure, auto: !!auto }),
      }))),
      ...[...numeros].map(n => envoyerWhatsapp(n, seniorName, heure)),
    ])

    return NextResponse.json({ success: true, emails: emailsEnvoyes, whatsapp: whatsapp.filter(Boolean).length })
  } catch (error) {
    console.error('Erreur SOS borne:', error.message)
    return NextResponse.json({ success: false, error: 'L\'alerte n\'a pas pu être envoyée.' }, { status: 500 })
  }
}
