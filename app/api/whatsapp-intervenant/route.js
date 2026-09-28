import { NextResponse } from 'next/server'

// Message WhatsApp libre à un intervenant (via l'API Meta)
export async function POST(request) {
  try {
    const body = await request.json()
    const { whatsapp, message } = body

    if (!whatsapp) {
      return NextResponse.json({ success: false, error: 'Numéro WhatsApp manquant' })
    }

    const phoneNumber = whatsapp.replace('+', '').replace(/\s/g, '')

    const response = await fetch(
      `https://graph.facebook.com/v18.0/${process.env.META_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.META_WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: { body: message || '' }
        })
      }
    )

    const responseText = await response.text()
    let data
    try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }

    if (response.ok) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: data })
    }

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
