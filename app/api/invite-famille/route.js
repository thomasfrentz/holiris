import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function generateCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
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
    const { familleId, prenom, seniorName, whatsapp } = await request.json()

    const code = generateCode()

    if (familleId) {
      await supabase.from('famille').update({ code_acces: code }).eq('id', familleId)
    }

    const phoneNumber = whatsapp.replace('+', '').replace(/\s/g, '')

    // Envoyer uniquement bienvenue_holiris
    const result = await envoyerTemplate(phoneNumber, 'bienvenue_holiris', [
      prenom || '',
      seniorName || '',
    ])

    if (result.ok) {
      return NextResponse.json({ success: true, code })
    } else {
      return NextResponse.json({ success: false, error: result.data })
    }

  } catch (error) {
    console.error('Erreur invitation famille:', error.message)
    return NextResponse.json({ success: false, error: error.message })
  }
}
