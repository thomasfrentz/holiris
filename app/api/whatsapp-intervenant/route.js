import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function POST(request) {
  try {
    const body = await request.json()
    const { whatsapp, prenom, seniorName, type, message, intervenantId } = body

    if (!whatsapp) {
      return NextResponse.json({ success: false, error: 'Numéro WhatsApp manquant' })
    }

    const phoneNumber = whatsapp.replace('+', '').replace(/\s/g, '')

    let requestBody

    if (type === 'template') {
      // Générer un code d'accès
      const code = Math.random().toString(36).substring(2, 8).toUpperCase()

      // Sauvegarder le code dans Supabase
      if (intervenantId) {
        await supabase.from('intervenants').update({ code_acces: code }).eq('id', intervenantId)
      }

      requestBody = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'template',
        template: {
          name: 'invitation_holiris',
          language: { code: 'fr' },
          components: [{
            type: 'body',
            parameters: [
              { type: 'text', text: prenom || '' },
              { type: 'text', text: seniorName || '' },
              { type: 'text', text: code },
            ]
          }]
        }
      }
    } else {
      requestBody = {
        messaging_product: 'whatsapp',
        to: phoneNumber,
        type: 'text',
        text: { body: message || '' }
      }
    }

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      }
    )

    const responseText = await response.text()
    let data
    try {
      data = JSON.parse(responseText)
    } catch {
      data = { raw: responseText }
    }

    if (response.ok) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: data })
    }

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
