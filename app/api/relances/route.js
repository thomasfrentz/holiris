import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export async function GET(request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== 'Bearer ' + process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const maintenant = new Date()
    const ilYa7j = new Date(maintenant.getTime() - 7 * 24 * 60 * 60 * 1000)

    // Chercher les intervenants qui ont eu un événement dans les 7 derniers jours
    const { data: events } = await supabase
      .from('events')
      .select('*, intervenants(*), seniors(*)')
      .gte('scheduled_at', ilYa7j.toISOString())
      .lte('scheduled_at', maintenant.toISOString())
      .not('intervenant_id', 'is', null)

    if (!events?.length) {
      return NextResponse.json({ success: true, message: 'Aucun intervenant actif cette semaine', relances: 0 })
    }

    // Dédupliquer par intervenant (un seul message par intervenant)
    const intervenantsVus = new Set()
    let relancesEnvoyees = 0

    for (const event of events) {
      const intervenant = event.intervenants
      if (!intervenant?.whatsapp) continue
      if (intervenantsVus.has(intervenant.id)) continue
      intervenantsVus.add(intervenant.id)

      const senior = event.seniors
      const phoneNumber = intervenant.whatsapp.replace('+', '')

      const message = 'Bonjour ' + intervenant.name + ' 👋 Merci pour votre suivi de ' + (senior?.name || 'votre patient') + ' cette semaine. Avez-vous des observations à partager ? Un message vocal de 20 secondes suffit 🎤'

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
      console.log('Relance envoyée à', intervenant.name, ':', JSON.stringify(data))

      if (response.ok) {
        await supabase.from('relances').insert({
          event_id: event.id,
          channel: 'whatsapp_meta',
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        relancesEnvoyees++
      }
    }

    return NextResponse.json({
      success: true,
      relances: relancesEnvoyees,
      intervenants_contactes: intervenantsVus.size
    })

  } catch (error) {
    console.error('Erreur relances:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
