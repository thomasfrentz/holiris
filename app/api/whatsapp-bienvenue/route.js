import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { envoyerBienvenue } from '@/lib/whatsapp'

// Message WhatsApp de bienvenue, demandé par le site quand un numéro est renseigné sur une fiche
export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    const { type, id } = await request.json()
    const table = type === 'famille' ? 'famille' : type === 'intervenant' ? 'intervenants' : null
    if (!table || !id) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })

    const { data: fiche } = await supabaseAdmin.from(table).select('senior_id').eq('id', id).maybeSingle()
    if (!fiche) return NextResponse.json({ success: false, error: 'Fiche introuvable' }, { status: 404 })

    // Mêmes droits que pour les invitations : suivre ce senior, ou pouvoir le gérer
    const { data: acces } = await supabaseAdmin.from('famille').select('id')
      .eq('user_id', user.id).eq('senior_id', fiche.senior_id).is('archived_at', null).limit(1)
    if (!acces?.length && !await peutGererSenior(user.id, fiche.senior_id)) {
      return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
    }

    return NextResponse.json({ success: await envoyerBienvenue(table, id) })
  } catch (error) {
    console.error('Erreur bienvenue WhatsApp:', error.message)
    return NextResponse.json({ success: false }, { status: 500 })
  }
}
