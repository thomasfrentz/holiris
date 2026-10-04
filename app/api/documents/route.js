import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant } from '@/lib/serveur'
import { TYPES, composerDocument, peutGererDocuments, empreinte, nouveauJeton } from '@/lib/documents'

// Documents du dossier d'un senior : liste, préparation d'une signature (lien à usage unique), annulation
export async function GET(request) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  const seniorId = new URL(request.url).searchParams.get('seniorId')
  if (!seniorId || !await peutGererDocuments(user.id, seniorId)) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { data } = await supabaseAdmin.from('documents_signes')
    .select('id, type, version, statut, choix, signataire_nom, signataire_qualite, signe_at, expire_at, created_at')
    .eq('senior_id', seniorId).neq('statut', 'annule').order('created_at', { ascending: false })
  return NextResponse.json({ documents: data || [] })
}

export async function POST(request) {
  try {
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    const { action, seniorId, type, id } = await request.json()

    if (action === 'preparer') {
      if (!TYPES.includes(type)) return NextResponse.json({ success: false, error: 'Type inconnu' }, { status: 400 })
      if (!seniorId || !await peutGererDocuments(user.id, seniorId)) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
      const { contenu, erreur } = await composerDocument(type, seniorId)
      if (erreur) return NextResponse.json({ success: false, error: erreur }, { status: 400 })
      // Une seule demande en attente par document
      await supabaseAdmin.from('documents_signes').update({ statut: 'annule', jeton_hash: null })
        .eq('senior_id', seniorId).eq('type', type).eq('statut', 'en_attente')
      const jeton = nouveauJeton()
      const { error } = await supabaseAdmin.from('documents_signes').insert({
        senior_id: seniorId, type, version: contenu.version, contenu, demande_par: user.id,
        jeton_hash: empreinte(jeton), expire_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      if (error) throw error
      return NextResponse.json({ success: true, lien: '/signer?t=' + jeton })
    }

    if (action === 'annuler') {
      const { data: d } = await supabaseAdmin.from('documents_signes').select('senior_id, statut').eq('id', id).maybeSingle()
      if (!d || d.statut !== 'en_attente' || !await peutGererDocuments(user.id, d.senior_id)) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
      await supabaseAdmin.from('documents_signes').update({ statut: 'annule', jeton_hash: null }).eq('id', id)
      return NextResponse.json({ success: true })
    }
    return NextResponse.json({ success: false, error: 'Action inconnue' }, { status: 400 })
  } catch (error) {
    console.error('Erreur documents:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
