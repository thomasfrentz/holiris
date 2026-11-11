import { NextResponse } from 'next/server'
import { proposerPassagesReguliers } from '@/lib/passagesReguliers'

// Tâche quotidienne : propose aux intervenants dont les notes sont régulières, sans passage à l'agenda,
// d'y ajouter ces passages (message privé de Holiris dans la messagerie)
export const maxDuration = 60

export async function GET(request) {
  if (request.headers.get('authorization') !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    return NextResponse.json({ success: true, propositions: await proposerPassagesReguliers() })
  } catch (error) {
    console.error('Erreur passages réguliers:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
