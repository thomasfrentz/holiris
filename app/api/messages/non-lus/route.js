import { NextResponse } from 'next/server'
import { utilisateurCourant } from '@/lib/serveur'
import { nonLusPour, seniorsSuivis, marquerLu } from '@/lib/messagesNonLus'

// Nombre de messages non lus de l'utilisateur connecté, par senior
export async function GET() {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ total: 0, parSenior: {} }, { status: 401 })
  return NextResponse.json(await nonLusPour(user.id))
}

// Marque le fil d'un senior comme lu (ouverture de la page Messages)
export async function POST(request) {
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ success: false }, { status: 401 })
  const { seniorId } = await request.json()
  if (!seniorId || !(await seniorsSuivis(user.id)).includes(seniorId)) {
    return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
  }
  await marquerLu(user.id, seniorId)
  return NextResponse.json({ success: true })
}
