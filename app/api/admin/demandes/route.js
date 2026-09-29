import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { randomBytes } from 'crypto'
import { supabaseAdmin, utilisateurCourant, lignesFamille } from '@/lib/serveur'
import { escapeHtml, emailDemandeValidee } from '@/lib/emails'

const resend = new Resend(process.env.RESEND_API_KEY)

async function estAdmin() {
  const user = await utilisateurCourant()
  if (!user) return false
  const lignes = await lignesFamille(user.id)
  return lignes.some(l => l.is_admin)
}

// Liste des demandes d'accès (admin connecté uniquement)
export async function GET() {
  if (!await estAdmin()) return NextResponse.json({ error: 'Réservé à l\'admin' }, { status: 403 })
  const { data, error } = await supabaseAdmin.from('demandes_acces')
    .select('id, prenom, nom, email, telephone, senior_nom, senior_ville, lien, message, statut, created_at, traitee_at')
    .order('created_at', { ascending: false })
    .limit(100)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ demandes: data })
}

// action : 'valider' (envoie le lien d'inscription) | 'refuser'
export async function POST(request) {
  try {
    if (!await estAdmin()) return NextResponse.json({ success: false, error: 'Réservé à l\'admin' }, { status: 403 })
    const { id, action } = await request.json()

    const { data: demande } = await supabaseAdmin.from('demandes_acces').select('*').eq('id', id).maybeSingle()
    if (!demande) return NextResponse.json({ success: false, error: 'Demande introuvable' }, { status: 404 })

    if (action === 'refuser') {
      await supabaseAdmin.from('demandes_acces')
        .update({ statut: 'refusee', jeton: null, traitee_at: new Date().toISOString() })
        .eq('id', id)
      return NextResponse.json({ success: true })
    }

    if (action === 'valider') {
      if (demande.statut === 'inscrite') return NextResponse.json({ success: false, error: 'Compte déjà créé' }, { status: 400 })
      // Validation (ou renvoi du lien si déjà validée)
      const jeton = demande.jeton || randomBytes(24).toString('base64url')
      await supabaseAdmin.from('demandes_acces')
        .update({ statut: 'validee', jeton, traitee_at: new Date().toISOString() })
        .eq('id', id)

      const { error } = await resend.emails.send({
        from: 'Holiris <contact@holiris.fr>',
        to: demande.email,
        subject: 'Votre accès Holiris est validé',
        html: emailDemandeValidee({ prenom: escapeHtml(demande.prenom), jeton, email: demande.email }),
      })
      if (error) {
        console.error('Erreur email validation:', error)
        return NextResponse.json({ success: false, error: 'Demande validée mais email non envoyé' }, { status: 500 })
      }
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Erreur traitement demande:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
