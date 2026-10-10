import { NextResponse } from 'next/server'

// Version en ligne : la borne, toujours ouverte, se recharge d'elle-même quand elle change
export const dynamic = 'force-dynamic'

export function GET() {
  const version = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'local'
  // heure : l'heure du serveur, pour recaler l'horloge des tablettes déréglées
  return NextResponse.json({ version, heure: Date.now() }, { headers: { 'Cache-Control': 'no-store' } })
}
