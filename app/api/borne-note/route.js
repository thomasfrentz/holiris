import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { enregistrerNote } from '@/lib/notesMedicales'
import { ficheAutorisee } from '@/lib/accesMobile'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  try {
    const { note, intervenantId, personneType, intervenantName, intervenantRole, seniorId, code, jeton } = await request.json()

    // La note doit venir de la borne du senior (son code) ou de la borne sur téléphone de l'intervenant (son jeton)
    let autorise = false
    if (code) {
      const { data: borne } = await supabase.from('bornes').select('senior_id')
        .eq('code', String(code).trim().toUpperCase()).maybeSingle()
      autorise = !!borne && borne.senior_id === seniorId
    } else if (jeton) {
      autorise = personneType !== 'famille' && await ficheAutorisee(jeton, intervenantId, seniorId)
    }
    if (!autorise) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })

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

    return NextResponse.json({ success: true, medical: result.medical, signalementId: result.signalementId, notePartielle: !!result.note })
  } catch (err) {
    console.error('borne-note error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
