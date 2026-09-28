import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { createClient } from '@supabase/supabase-js'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // ← service role pour le webhook server-side
)

// ─── Réponse TwiML ───────────────────────────────────────────────────────────
function twimlResponse(message) {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  )
}

// ─── Transcription audio ─────────────────────────────────────────────────────
async function transcribeAudio(mediaUrl) {
  const response = await fetch(mediaUrl, {
    headers: {
      'Authorization': 'Basic ' + Buffer.from(
        process.env.TWILIO_ACCOUNT_SID + ':' + process.env.TWILIO_AUTH_TOKEN
      ).toString('base64')
    }
  })
  const audioBuffer = await response.arrayBuffer()
  const audioFile = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' })
  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3',
    language: 'fr'
  })
  return transcription.text
}

// ─── Synthèse note ───────────────────────────────────────────────────────────
async function synthesizeNote(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content: "Tu es l'assistant de Holiris. Transforme ce message en note courte et naturelle en 1-2 phrases maximum. Sois direct et factuel. Commence directement par l'information, sans formule de politesse, sans objet, sans signature."
        },
        { role: 'user', content: text }
      ],
      max_completion_tokens: 450
    })
    return completion.choices[0]?.message?.content || text
  } catch {
    return text
  }
}

// ─── Détection senior parmi une liste ────────────────────────────────────────
function detectSeniorInText(text, seniors) {
  const textLower = text.toLowerCase()
  for (const senior of seniors) {
    const parts = senior.name.toLowerCase().split(' ')
    for (const part of parts) {
      if (part.length > 2 && textLower.includes(part)) {
        return senior
      }
    }
  }
  return null
}

// ─── Analyse alertes ─────────────────────────────────────────────────────────
async function analyzeForAlerts(text, seniorId) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      reasoning_effort: 'low',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `Tu es l'assistant IA de Holiris. Analyse ce message et détecte les signaux faibles qui méritent une alerte pour la famille.

Signaux à surveiller :
- Douleurs (genou, dos, tête, abdomen...)
- Chute ou risque de chute
- Problèmes alimentaires (ne mange pas, perd du poids...)
- Troubles cognitifs (confusion, mémoire, désorienté...)
- Problèmes de mobilité
- Moral bas, tristesse, isolement
- Médicaments non pris
- Symptômes inhabituels

Réponds UNIQUEMENT en JSON :
{"alerte": true, "niveau": "warning", "message": "Description courte"}
ou
{"alerte": false}

Niveaux : "info", "warning", "danger".`
        },
        { role: 'user', content: text }
      ],
      max_completion_tokens: 450
    })

    const response = completion.choices[0]?.message?.content || '{}'
    const parsed = JSON.parse(response.replace(/```json|```/g, '').trim())

    if (parsed.alerte && parsed.message) {
      await supabase.from('alertes').insert({
        senior_id: seniorId,
        type: 'signal_faible',
        message: parsed.message,
        niveau: parsed.niveau || 'warning',
        created_at: new Date().toISOString()
      })
    }
  } catch (error) {
    console.error('Erreur analyse alertes:', error.message)
  }
}

// ─── Handler principal ───────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const formData = await request.formData()
    const from = formData.get('From') || ''
    const body = formData.get('Body') || ''
    const numMedia = parseInt(formData.get('NumMedia') || '0')
    const mediaUrl = formData.get('MediaUrl0') || ''
    const mediaType = formData.get('MediaContentType0') || ''

    const phoneNumber = from.replace('whatsapp:', '')

    // ── 1. Identifier l'expéditeur (intervenant ou famille) ──────────────────
    let senderName = 'Inconnu'
    let senderRole = ''
    let seniorRows = [] // liste de { senior_id, senior_name }

    // Chercher dans intervenants (toutes les lignes du numéro)
    const { data: intervenantRows } = await supabase
      .from('intervenants')
      .select('id, name, role, senior_id, seniors(name)')
      .or(`whatsapp.eq.${phoneNumber},phone.eq.${phoneNumber}`)

    if (intervenantRows?.length) {
      senderName = intervenantRows[0].name
      senderRole = intervenantRows[0].role || ''
      seniorRows = intervenantRows.map(r => ({
        senior_id: r.senior_id,
        name: r.seniors?.name || ''
      }))
    } else {
      // Chercher dans famille
      const { data: familleRows } = await supabase
        .from('famille')
        .select('id, name, email, role, senior_id, seniors(name)')
        .eq('whatsapp', phoneNumber)

      if (familleRows?.length) {
        senderName = familleRows[0].name || familleRows[0].email
        senderRole = familleRows[0].role || 'Famille'
        seniorRows = familleRows.map(r => ({
          senior_id: r.senior_id,
          name: r.seniors?.name || ''
        }))
      }
    }

    if (!seniorRows.length) {
      console.warn('Numéro non reconnu:', phoneNumber)
      return twimlResponse("Votre numéro n'est pas enregistré sur Holiris. Contactez votre coordinateur.")
    }

    // ── 2. Transcrire / préparer le contenu ──────────────────────────────────
    let rawText = body
    let source = 'whatsapp_text'

    if (numMedia > 0 && mediaType.includes('audio')) {
      rawText = await transcribeAudio(mediaUrl)
      source = 'whatsapp_audio'
    } else if (!body) {
      return twimlResponse('Message reçu.')
    }

    // ── 3. Déterminer le senior cible ────────────────────────────────────────
    let targetSenior = null

    if (seniorRows.length === 1) {
      // Un seul senior → direct
      targetSenior = seniorRows[0]
    } else {
      // Plusieurs seniors → chercher le prénom dans le message
      targetSenior = detectSeniorInText(rawText, seniorRows)

      if (!targetSenior) {
        // Aucun prénom trouvé → demander de préciser
        const prenoms = seniorRows.map(r => r.name.split(' ')[0]).join(', ')
        return twimlResponse(
          `Pour quel senior est cette note ? Précisez le prénom dans votre message (${prenoms}).`
        )
      }
    }

    // ── 4. Synthétiser et enregistrer la note ────────────────────────────────
    const noteContent = await synthesizeNote(rawText)

    if (!noteContent) return twimlResponse('Message reçu.')

    await supabase.from('notes').insert({
      senior_id: targetSenior.senior_id,
      content: noteContent,
      source,
      intervenant_name: senderName + (senderRole ? ' · ' + senderRole : ''),
      created_at: new Date().toISOString()
    })

    await analyzeForAlerts(rawText, targetSenior.senior_id)

    const prenomSenior = targetSenior.name?.split(' ')[0] || ''
    return twimlResponse(
      `Note enregistrée${prenomSenior ? ' pour ' + prenomSenior : ''}. Merci ${senderName} !`
    )

  } catch (error) {
    console.error('Erreur webhook:', error.message)
    return twimlResponse('Message reçu.')
  }
}
