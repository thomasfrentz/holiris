import { NextResponse } from 'next/server'
import { utiliserLienVisio, terminerVisio, serveursIce } from '@/lib/visio'

// Côté proche : le lien reçu après un SOS (sans compte). Le jeton n'est consommé qu'au clic sur « Activer »,
// jamais à l'ouverture de la page (les aperçus de liens des messageries ne doivent pas l'utiliser).
export async function POST(request) {
  try {
    const { jeton, canal, fin } = await request.json()
    if (fin && canal) {
      await terminerVisio(String(canal))
      return NextResponse.json({ success: true })
    }
    if (!jeton) return NextResponse.json({ success: false, error: 'Lien invalide.' }, { status: 400 })

    const resultat = await utiliserLienVisio(String(jeton))
    if (resultat.erreur) return NextResponse.json({ success: false, error: resultat.erreur }, { status: 410 })
    return NextResponse.json({ success: true, ...resultat, iceServers: await serveursIce() })
  } catch (error) {
    console.error('Erreur visio:', error.message)
    return NextResponse.json({ success: false, error: 'La visio n\'a pas pu démarrer.' }, { status: 500 })
  }
}
