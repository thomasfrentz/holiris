import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/serveur'
import { lireJetonMedecin } from '@/lib/emails'
import { enregistrerNote } from '@/lib/notesMedicales'

// Note du médecin traitant par son lien personnel (sans compte).
// Le lien signé désigne le médecin et le senior ; il expire quelques jours après la consultation.

async function contexte(jeton) {
  const acces = lireJetonMedecin(jeton)
  if (!acces) return null
  const [{ data: medecin }, { data: senior }] = await Promise.all([
    supabaseAdmin.from('intervenants').select('id, name, role, phone, whatsapp, email, senior_id, archived_at').eq('id', acces.intervenantId).maybeSingle(),
    supabaseAdmin.from('seniors').select('id, name').eq('id', acces.seniorId).maybeSingle(),
  ])
  if (!medecin || medecin.archived_at || medecin.senior_id !== acces.seniorId || !senior) return null
  return { medecin, senior }
}

export async function GET(request) {
  const ctx = await contexte(new URL(request.url).searchParams.get('t'))
  if (!ctx) return NextResponse.json({ error: 'Ce lien n\'est plus valable.' }, { status: 404 })
  return NextResponse.json({ medecin: ctx.medecin.name, senior: ctx.senior.name })
}

export async function POST(request) {
  try {
    const { t, texte } = await request.json()
    const ctx = await contexte(t)
    if (!ctx) return NextResponse.json({ success: false, error: 'Ce lien n\'est plus valable.' }, { status: 404 })
    if (!String(texte || '').trim()) return NextResponse.json({ success: false, error: 'La note est vide.' }, { status: 400 })

    const { medecin, senior } = ctx
    const result = await enregistrerNote({
      seniorId: senior.id,
      texte: String(texte).trim().slice(0, 3000),
      source: 'intervenant',
      auteur: { type: 'intervenant', id: medecin.id, nom: medecin.name, role: medecin.role || 'Médecin traitant', telephone: medecin.phone || medecin.whatsapp, email: medecin.email },
    })
    return NextResponse.json({ success: true, medical: result.medical, signalementId: result.signalementId, notePartielle: !!result.note })
  } catch (error) {
    console.error('Erreur note médecin:', error.message)
    return NextResponse.json({ success: false, error: 'Une erreur est survenue.' }, { status: 500 })
  }
}
