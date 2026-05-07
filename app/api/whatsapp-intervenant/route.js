import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function generateToken() {
  return Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
}

async function envoyerTemplate(phoneNumber, templateName, parameters) {
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
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'fr' },
          components: [{
            type: 'body',
            parameters: parameters.map(p => ({ type: 'text', text: p }))
          }]
        }
      })
    }
  )
  const responseText = await response.text()
  try { return { ok: response.ok, data: JSON.parse(responseText) } }
  catch { return { ok: response.ok, data: { raw: responseText } } }
}

export async function POST(request) {
  try {
    const body = await request.json()
    const { whatsapp, prenom, seniorName, type, message, intervenantId } = body

    if (!whatsapp) {
      return NextResponse.json({ success: false, error: 'Numéro WhatsApp manquant' })
    }

    const phoneNumber = whatsapp.replace('+', '').replace(/\s/g, '')

    if (type === 'template') {
      // Générer token et lien
      const token = generateToken()
      const lien = `https://holiris.fr/rejoindre?token=${token}`

      if (intervenantId) {
        await supabase.from('intervenants').update({ invite_token: token }).eq('id', intervenantId)
      }

      // Message 1 — lien d'activation
      await envoyerTemplate(phoneNumber, 'lien_holiris', [
        prenom || '',
        seniorName || '',
        lien,
      ])

      // Message 2 — bienvenue + instructions
      const result2 = await envoyerTemplate(phoneNumber, 'bienvenue_holiris', [
        prenom || '',
        seniorName || '',
      ])

      if (result2.ok) {
        return NextResponse.json({ success: true })
      } else {
        return NextResponse.json({ success: false, error: result2.data })
      }

    } else {
      // Message libre
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
    }

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message })
  }
}
