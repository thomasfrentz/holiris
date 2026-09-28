import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Groq from 'groq-sdk'
import { enregistrerNote } from '@/lib/notesMedicales'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function POST(request) {
  try {
    const { note, intervenantId, personneType, intervenantName, intervenantRole, seniorId } = await request.json()

    // Coordonnées de l'auteur, pour qu'il puisse être recontacté en cas d'information médicale
    const table = personneType === 'famille' ? 'famille' : 'intervenants'
    const { data: personne } = intervenantId
      ? await supabase.from(table).select('id, name, role, phone, whatsapp, email, senior_id').eq('id', intervenantId).maybeSingle()
      : { data: null }
    const auteur = personne && personne.senior_id === seniorId
      ? { type: personneType === 'famille' ? 'famille' : 'intervenant', id: personne.id, nom: personne.name, role: personne.role, telephone: personne.phone || personne.whatsapp, email: personne.email }
      : { type: 'intervenant', id: null, nom: intervenantName, role: intervenantRole }

    // Filtre médical : seule la partie non médicale est enregistrée
    const result = await enregistrerNote({ seniorId, texte: note, source: 'borne', auteur })
    if (!result.note) return NextResponse.json({ success: true, medical: result.medical, signalementId: result.signalementId, notePartielle: !!result.note })

    try {
      const alertCheck = await groq.chat.completions.create({
        model: 'openai/gpt-oss-120b',
        reasoning_effort: 'low',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Tu analyses des notes de soins à domicile. Réponds uniquement par JSON: {"alerte": true/false, "raison": "..."}. alerte=true si la note mentionne une chute, douleur intense, détresse, confusion, urgence médicale.' },
          { role: 'user', content: result.note }
        ],
        max_completion_tokens: 400
      })
      const alertResult = JSON.parse(alertCheck.choices[0]?.message?.content || '{"alerte":false}')
      if (alertResult.alerte) {
        await supabase.from('alertes').insert({
          senior_id: seniorId,
          note_content: result.note,
          raison: alertResult.raison,
          created_at: new Date().toISOString()
        })
      }
    } catch {}

    return NextResponse.json({ success: true, medical: result.medical, signalementId: result.signalementId, notePartielle: !!result.note })
  } catch (err) {
    console.error('borne-note error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
