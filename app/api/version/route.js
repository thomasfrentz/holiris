import { NextResponse } from 'next/server'

// Version en ligne : la borne, toujours ouverte, se recharge d'elle-même quand elle change
export const dynamic = 'force-dynamic'

export function GET() {
  const version = process.env.VERCEL_DEPLOYMENT_ID || process.env.VERCEL_GIT_COMMIT_SHA || 'local'
  return NextResponse.json({ version }, { headers: { 'Cache-Control': 'no-store' } })
}
