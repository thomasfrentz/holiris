import { NextResponse } from 'next/server'
import { supabaseAdmin, utilisateurCourant } from '@/lib/serveur'
import { fichesDuJeton } from '@/lib/accesMobile'
import { testerPush } from '@/lib/push'

// Abonnement d'un téléphone aux notifications : rattaché au compte connecté,
// ou au lien de la borne sur téléphone pour un intervenant sans compte
export async function POST(request) {
  try {
    const { abonnement, jeton } = await request.json()
    const endpoint = abonnement?.endpoint
    const p256dh = abonnement?.keys?.p256dh
    const auth = abonnement?.keys?.auth
    if (!endpoint || !p256dh || !auth || !/^https:\/\//.test(endpoint)) {
      return NextResponse.json({ success: false, error: 'Abonnement invalide' }, { status: 400 })
    }

    let proprietaire = null
    if (jeton) {
      if ((await fichesDuJeton(jeton)).length) proprietaire = { user_id: null, jeton_mobile: jeton }
    } else {
      const user = await utilisateurCourant()
      if (user) proprietaire = { user_id: user.id, jeton_mobile: null }
    }
    if (!proprietaire) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    const { error } = await supabaseAdmin.from('push_abonnements')
      .upsert({ endpoint, p256dh, auth, ...proprietaire }, { onConflict: 'endpoint' })
    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erreur abonnement notifications:', error.message)
    return NextResponse.json({ success: false, error: 'Abonnement impossible' }, { status: 500 })
  }
}

// Diagnostic : /api/push?test=1 envoie une notification de test aux appareils du compte connecté
export async function GET(request) {
  if (!new URL(request.url).searchParams.get('test')) return NextResponse.json({ error: 'Paramètre manquant' }, { status: 400 })
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  return NextResponse.json(await testerPush(user.id))
}

// Désactivation depuis le téléphone
export async function DELETE(request) {
  const { endpoint } = await request.json().catch(() => ({}))
  if (endpoint) await supabaseAdmin.from('push_abonnements').delete().eq('endpoint', endpoint)
  return NextResponse.json({ success: true })
}
