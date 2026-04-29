import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  try {
    const { familleId, prenom, seniorName, whatsapp } = await request.json()

    const code = Math.random().toString(36).substring(2, 8).toUpperCase()

    await supabase
      .from('famille')
      .update({ code_acces: code })
      .eq('id', familleId)

    const phoneNumber = whatsapp.replace('+', '').replace(/\s/g, '')

    const message = `Bonjour ${prenom} 👋\n\nVous avez été invité(e) sur *Holiris* pour suivre *${seniorName}*.\n\n🔑 Votre code d'accès : *${code}*\n\n1. Créez votre compte : https://holiris.fr/login\n2. Entrez ce code pour activer votre espace\n\n_Holiris — Prendre soin de ceux qui nous sont chers_`

    const response = await fetch(
      'https://graph.facebook.com/v18.0/' + process.env.META_PHONE_NUMBER_ID + '/messages',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: { body: message }
        })
      }
    )

    const data = await response.json()

    if (response.ok) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: data })
    }

  } catch (error) {
    console.error('Erreur invitation famille:', error.message)
    return NextResponse.json({ success: false, error: error.message })
  }
}