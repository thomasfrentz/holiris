import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/serveur'
import { TYPES, titreDocument, composerDocument, empreinte, nouveauJeton } from '@/lib/documents'

// Documents à signer depuis la borne (configuration ou accueil) : le code de la borne sert de clé
async function borneParCode(code) {
  const { data } = await supabaseAdmin.from('bornes').select('senior_id, seniors(name, personne_confiance_id)')
    .eq('code', String(code || '').trim().toUpperCase()).maybeSingle()
  return data
}

export async function GET(request) {
  const borne = await borneParCode(new URL(request.url).searchParams.get('code'))
  if (!borne) return NextResponse.json({ error: 'Code borne invalide' }, { status: 404 })
  const { data: signes } = await supabaseAdmin.from('documents_signes').select('type, signe_at')
    .eq('senior_id', borne.senior_id).eq('statut', 'signe')
  const documents = TYPES.map(type => ({
    type,
    titre: titreDocument(type),
    signe: (signes || []).some(d => d.type === type),
    // La personne de confiance doit d'abord être choisie par la famille
    indisponible: type === 'personne_confiance' && !borne.seniors?.personne_confiance_id,
  }))
  return NextResponse.json({ documents, aSigner: documents.filter(d => !d.signe && !d.indisponible).length })
}

export async function POST(request) {
  try {
    const { code, type } = await request.json()
    const borne = await borneParCode(code)
    if (!borne) return NextResponse.json({ success: false, error: 'Code borne invalide' }, { status: 404 })
    if (!TYPES.includes(type)) return NextResponse.json({ success: false, error: 'Type inconnu' }, { status: 400 })
    const { contenu, erreur } = await composerDocument(type, borne.senior_id)
    if (erreur) return NextResponse.json({ success: false, error: erreur }, { status: 400 })
    await supabaseAdmin.from('documents_signes').update({ statut: 'annule', jeton_hash: null })
      .eq('senior_id', borne.senior_id).eq('type', type).eq('statut', 'en_attente')
    const jeton = nouveauJeton()
    const { error } = await supabaseAdmin.from('documents_signes').insert({
      senior_id: borne.senior_id, type, version: contenu.version, contenu,
      jeton_hash: empreinte(jeton), expire_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })
    if (error) throw error
    return NextResponse.json({ success: true, lien: '/signer?t=' + jeton + '&retour=borne' })
  } catch (error) {
    console.error('Erreur documents borne:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
