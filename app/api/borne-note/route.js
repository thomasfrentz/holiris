import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request) {
  try {
    const { note, intervenantName, intervenantRole, seniorId } = await request.json()

    const intervenantLabel = intervenantName + (intervenantRole ? ' · ' + intervenantRole : '')

    const { error } = await supabase.from('notes').insert({
      senior_id: seniorId,
      content: note,
      source: 'borne',
      intervenant_name: intervenantLabel,
      created_at: new Date().toISOString()
    })

    if (error) throw error

    try {
      const alertCheck = await groq.chat.completions.create({
        model: 'llama3-8b-8192',
        messages: [
          { role: 'system', content: 'Tu analyses des notes de soins à domicile. Réponds uniquement par JSON: {"alerte": true/false, "raison": "..."}. alerte=true si la note mentionne une chute, douleur intense, détresse, confusion, urgence médicale.' },
          { role: 'user', content: note }
        ],
        max_tokens: 80
      })
      const alertResult = JSON.parse(alertCheck.choices[0]?.message?.content || '{"alerte":false}')
      if (alertResult.alerte) {
        await supabase.from('alertes').insert({
          senior_id: seniorId,
          note_content: note,
          raison: alertResult.raison,
          created_at: new Date().toISOString()
        })
      }
    } catch {}

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('borne-note error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
