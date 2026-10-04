import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { supabaseAdmin } from '@/lib/serveur'
import { empreinte } from '@/lib/documents'
import { genererPdf } from '@/lib/documentPdf'
import { escapeHtml, emailDocumentSigne } from '@/lib/emails'

const resend = new Resend(process.env.RESEND_API_KEY)

// Lien de signature (sans compte : il est ouvert devant le senior, sur la borne ou la tablette d'un proche)
async function documentDuJeton(jeton) {
  if (!jeton) return null
  const { data } = await supabaseAdmin.from('documents_signes').select('*').eq('jeton_hash', empreinte(String(jeton))).maybeSingle()
  if (!data || data.statut !== 'en_attente' || new Date(data.expire_at) < new Date()) return null
  return data
}

export async function GET(request) {
  const doc = await documentDuJeton(new URL(request.url).searchParams.get('t'))
  if (!doc) return NextResponse.json({ error: 'Ce lien de signature n’est plus valable.' }, { status: 404 })
  return NextResponse.json({ type: doc.type, contenu: doc.contenu })
}

export async function POST(request) {
  try {
    const { t, signataireNom, qualite, choix, signature, accepte } = await request.json()
    const doc = await documentDuJeton(t)
    if (!doc) return NextResponse.json({ success: false, error: 'Ce lien de signature n’est plus valable.' }, { status: 404 })

    const nom = String(signataireNom || '').trim().slice(0, 120)
    const q = qualite === 'personne' ? 'personne' : String(qualite || '').trim().slice(0, 60)
    if (!accepte || !nom || !q) return NextResponse.json({ success: false, error: 'Nom, qualité et accord sont nécessaires.' }, { status: 400 })
    if (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(signature || '') || signature.length > 400000) {
      return NextResponse.json({ success: false, error: 'Signature manquante.' }, { status: 400 })
    }
    // Autorisations : une réponse oui/non pour chacune
    let reponses = null
    if (doc.contenu.autorisations) {
      reponses = Object.fromEntries(doc.contenu.autorisations.map(a => [a.cle, choix?.[a.cle] === true]))
      if (doc.contenu.autorisations.some(a => typeof choix?.[a.cle] !== 'boolean')) {
        return NextResponse.json({ success: false, error: 'Répondez oui ou non à chaque autorisation.' }, { status: 400 })
      }
    }

    const signeAt = new Date().toISOString()
    const preuve = empreinte({ id: doc.id, contenu: doc.contenu, choix: reponses, signataire: nom, qualite: q, signature, signeAt })
    const { data: maj, error } = await supabaseAdmin.from('documents_signes').update({
      statut: 'signe', jeton_hash: null, choix: reponses, signataire_nom: nom, signataire_qualite: q, signature,
      empreinte: preuve, signe_at: signeAt,
      ip: (request.headers.get('x-forwarded-for') || '').split(',')[0].trim() || null,
      appareil: (request.headers.get('user-agent') || '').slice(0, 300),
    }).eq('id', doc.id).eq('statut', 'en_attente').select().single()
    if (error || !maj) return NextResponse.json({ success: false, error: 'Ce document vient déjà d’être signé.' }, { status: 409 })

    // Copie du document signé à la famille (comptes actifs)
    try {
      const { data: famille } = await supabaseAdmin.from('famille').select('name, email')
        .eq('senior_id', doc.senior_id).is('archived_at', null).not('user_id', 'is', null).not('email', 'is', null)
      if (famille?.length) {
        const pdf = await genererPdf(maj)
        const date = new Date(signeAt).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' })
        const signataire = q === 'personne' ? escapeHtml(nom) : `${escapeHtml(nom)} (${escapeHtml(q)})`
        await resend.batch.send(famille.map(f => ({
          from: 'Holiris <contact@holiris.fr>',
          to: f.email,
          subject: `Document signé — ${doc.contenu.titre} — ${doc.contenu.senior}`,
          html: emailDocumentSigne({ prenom: escapeHtml(f.name.split(' ')[0]), titre: escapeHtml(doc.contenu.titre), seniorName: escapeHtml(doc.contenu.senior), signataire, date }),
          attachments: [{ filename: `${doc.contenu.titre} - ${doc.contenu.senior}.pdf`.replace(/[\\/:*?"<>|’]/g, ''), content: pdf }],
        })))
      }
    } catch (e) { console.error('Envoi du document signé:', e.message) }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur signature:', error.message)
    return NextResponse.json({ success: false, error: 'La signature n’a pas pu être enregistrée.' }, { status: 500 })
  }
}
