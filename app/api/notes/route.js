import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant } from '@/lib/serveur'
import { enregistrerNote } from '@/lib/notesMedicales'

// Ajout d'une note depuis le web (espace intervenant ou carnet famille), avec filtre médical
export async function POST(request) {
  try {
    const { seniorId, texte, source } = await request.json()
    if (!seniorId || !texte?.trim() || !['intervenant', 'famille'].includes(source)) {
      return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })
    }

    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    // L'auteur doit suivre ce senior (ou être admin côté famille)
    const table = source === 'intervenant' ? 'intervenants' : 'famille'
    const { data: lignes } = await supabaseAdmin.from(table)
      .select('*').eq('user_id', user.id).is('archived_at', null)
    const ligne = (lignes || []).find(l => l.senior_id === seniorId)
      || (source === 'famille' ? (lignes || []).find(l => l.is_admin) : null)
    if (!ligne) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })

    const result = await enregistrerNote({
      seniorId,
      texte: texte.trim(),
      source,
      auteur: {
        type: source,
        id: ligne.id,
        nom: ligne.name || ligne.email?.split('@')[0] || (source === 'famille' ? 'Famille' : 'Intervenant'),
        role: ligne.role,
        telephone: ligne.phone || ligne.whatsapp,
        email: ligne.email || user.email,
      },
    })

    return NextResponse.json({
      success: true,
      medical: result.medical,
      signalementId: result.signalementId,
      note: result.noteEnregistree,
    })
  } catch (error) {
    console.error('Erreur ajout note:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
