import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { signatureValide } from '@/lib/emails'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function appliquer(email, sig, action) {
  if (!signatureValide(email, sig)) {
    return NextResponse.json({ success: false, error: 'Lien invalide' }, { status: 400 })
  }
  const adresse = email.toLowerCase()
  const { error } = action === 'reinscrire'
    ? await supabase.from('desinscriptions').delete().eq('email', adresse)
    : await supabase.from('desinscriptions').upsert({ email: adresse })
  if (error) {
    console.error('Erreur désinscription:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
  return NextResponse.json({ success: true })
}

export async function POST(request) {
  const { searchParams } = new URL(request.url)

  // Bouton « Se désabonner » de Gmail / Outlook : email et signature dans l'URL
  if (searchParams.get('email')) {
    return appliquer(searchParams.get('email'), searchParams.get('sig'), 'desinscrire')
  }

  // Page /desinscription
  try {
    const { email, sig, action } = await request.json()
    return appliquer(email, sig, action)
  } catch {
    return NextResponse.json({ success: false, error: 'Requête invalide' }, { status: 400 })
  }
}
