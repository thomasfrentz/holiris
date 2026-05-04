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

    const { data: events } = await supabase
      .from('events')
      .select('*, intervenants(*), seniors(*)')
      .gte('scheduled_at', ilYa7j.toISOString())
      .lte('scheduled_at', maintenant.toISOString())
      .not('intervenant_id', 'is', null)

    if (!events?.length) {
      return NextResponse.json({ success: true, message: 'Aucun intervenant actif cette semaine', relances: 0 })
    }

    const intervenantsVus = new Set()
    let relancesEnvoyees = 0

    for (const event of events) {
      const intervenant = event.intervenants
      if (!intervenant?.whatsapp) continue
      if (intervenantsVus.has(intervenant.id)) continue
      intervenantsVus.add(intervenant.id)

      const senior = event.seniors
      const phoneNumber = intervenant.whatsapp.replace('+', '').replace(/\s/g, '')
      const prenom = intervenant.name.split(' ')[0]
      const seniorName = senior?.name || 'votre patient'

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
            type: 'template',
            template: {
              name: 'relance_intervenant',
              language: { code: 'en' },
              components: [{
                type: 'body',
                parameters: [
                  { type: 'text', text: prenom },
                  { type: 'text', text: seniorName },
                ]
              }]
            }
          })
        }
      )

      const responseText = await response.text()
      let data
      try { data = JSON.parse(responseText) } catch { data = { raw: responseText } }
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
