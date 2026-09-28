import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { supabaseAdmin as supabase } from '@/lib/serveur'
import { enregistrerNote, repondreSignalement } from '@/lib/notesMedicales'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === 'holiris2024') {
    return new NextResponse(challenge, { status: 200 })
  }
  return new NextResponse('Forbidden', { status: 403 })
}

export async function POST(request) {
  try {
    const body = await request.json()
    const entry = body.entry?.[0]
    const changes = entry?.changes?.[0]
    const message = changes?.value?.messages?.[0]

    if (!message) return NextResponse.json({ status: 'no message' })

    const from = message.from
    const messageType = message.type

    console.log('Message reçu de:', from, 'type:', messageType)

    // Chercher l'intervenant par numéro WhatsApp (une ligne par senior suivi)
    const { data: intervenantData } = await supabase
      .from('intervenants')
      .select('*')
      .or(`whatsapp.eq.+${from},whatsapp.eq.${from},phone.eq.+${from}`)
      .is('archived_at', null)

    console.log('Intervenant trouvé:', intervenantData?.length > 0 ? intervenantData[0].name : 'aucun')

    // Numéro inconnu : on n'attribue pas la note à un senior au hasard
    if (!intervenantData?.length) return NextResponse.json({ status: 'unknown sender' })

    // Réponse aux boutons « Cette information est-elle essentielle ? »
    if (messageType === 'interactive' && message.interactive?.button_reply) {
      await traiterReponseSignalement(from, message.interactive.button_reply.id, intervenantData)
      return NextResponse.json({ status: 'ok' })
    }

    const intervenantName = intervenantData[0].name
    const intervenantRole = intervenantData[0].role
    const seniorIds = intervenantData.map(i => i.senior_id).filter(Boolean)
    const selected = intervenantData.find(i => i.selected_senior_id)?.selected_senior_id
    const seniorId = seniorIds.includes(selected) ? selected : seniorIds[0]

    if (!seniorId) return NextResponse.json({ status: 'no senior' })

    let noteContent = ''
    let source = 'whatsapp_text'
    let rawText = ''

    if (messageType === 'text') {
      rawText = message.text.body
      noteContent = await synthesizeNote(rawText)
      source = 'whatsapp_text'
    } else if (messageType === 'audio') {
      rawText = await transcribeMetaAudio(message.audio.id)
      noteContent = await synthesizeNote(rawText)
      source = 'whatsapp_audio'
    }

    console.log('Note à créer:', noteContent)

    if (noteContent) {
      const finalSeniorId = await findSeniorByName(rawText, seniorId, seniorIds)
      const intervenant = intervenantData.find(i => i.senior_id === finalSeniorId) || intervenantData[0]

      // Filtre médical : seule la partie non médicale est enregistrée
      const result = await enregistrerNote({
        seniorId: finalSeniorId,
        texte: noteContent,
        source,
        auteur: {
          type: 'intervenant',
          id: intervenant.id,
          nom: intervenantName,
          role: intervenantRole,
          telephone: intervenant.phone || intervenant.whatsapp || '+' + from,
          email: intervenant.email,
        },
      })
      console.log('Note créée pour senior:', finalSeniorId, result.medical ? '(information médicale retirée)' : '')

      if (result.note) await analyzeForAlerts(result.note, finalSeniorId)
      if (result.signalementId) await demanderSiEssentiel(from, result.signalementId, !!result.note)
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Erreur webhook Meta:', error.message)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}

async function transcribeMetaAudio(audioId) {
  const urlResponse = await fetch(
    'https://graph.facebook.com/v18.0/' + audioId,
    { headers: { 'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN } }
  )
  const urlData = await urlResponse.json()
  const audioResponse = await fetch(urlData.url, {
    headers: { 'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN }
  })
  const audioBuffer = await audioResponse.arrayBuffer()
  const audioFile = new File([audioBuffer], 'audio.ogg', { type: 'audio/ogg' })
  const transcription = await groq.audio.transcriptions.create({
    file: audioFile,
    model: 'whisper-large-v3',
    language: 'fr'
  })
  return transcription.text
}

async function synthesizeNote(text) {
  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-20b',
      reasoning_effort: 'low',
      messages: [
        {
          role: 'system',
          content: 'Tu es l\'assistant de Holiris. Transforme ce message en note courte et naturelle en 1-2 phrases maximum. Sois direct et factuel. Commence directement par l\'information, sans formule de politesse, sans objet, sans signature.'
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

// Cherche le senior cité dans le message, parmi ceux suivis par cet intervenant uniquement
async function findSeniorByName(text, fallbackSeniorId, seniorIds) {
  if (seniorIds.length <= 1) return fallbackSeniorId
  const { data: seniors } = await supabase.from('seniors').select('id, name').in('id', seniorIds)
  if (!seniors?.length) return fallbackSeniorId

  const textLower = text.toLowerCase()

  for (const senior of seniors) {
    const parts = senior.name.toLowerCase().split(' ')
    for (const part of parts) {
      if (part.length > 2 && textLower.includes(part)) {
        console.log('Senior trouvé par nom:', senior.name)
        return senior.id
      }
    }
  }

  return fallbackSeniorId
}

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
    const clean = response.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    if (parsed.alerte && parsed.message) {
      await supabase.from('alertes').insert({
        senior_id: seniorId,
        type: 'signal_faible',
        message: parsed.message,
        niveau: parsed.niveau || 'warning',
        created_at: new Date().toISOString()
      })
      console.log('Alerte créée:', parsed.message)
    }
  } catch (error) {
    console.error('Erreur analyse alertes:', error.message)
  }
}
async function envoyerWhatsApp(to, payload) {
  const response = await fetch(
    'https://graph.facebook.com/v18.0/' + process.env.META_PHONE_NUMBER_ID + '/messages',
    {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, ...payload })
    }
  )
  if (!response.ok) console.error('Erreur envoi WhatsApp:', await response.text())
}

// L'intervenant vient d'écrire : on peut lui répondre librement (fenêtre de 24 h)
async function demanderSiEssentiel(to, signalementId, notePartielle) {
  await envoyerWhatsApp(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: 'Merci pour votre message. Il contient une information médicale : pour protéger la personne suivie, '
          + (notePartielle ? 'cette partie n\'a pas été enregistrée sur Holiris (le reste de votre note a bien été transmis).' : 'il n\'a pas été enregistré sur Holiris.')
          + '\n\nCette information est-elle essentielle ? Si oui, la personne de confiance vous contactera pour en savoir plus.'
      },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'sig_oui:' + signalementId, title: 'Oui, essentielle' } },
          { type: 'reply', reply: { id: 'sig_non:' + signalementId, title: 'Non' } },
        ]
      }
    }
  })
}

async function traiterReponseSignalement(from, buttonId, intervenantData) {
  const [action, signalementId] = String(buttonId).split(':')
  if (!signalementId || !['sig_oui', 'sig_non'].includes(action)) return

  // Le signalement doit avoir été créé par cet intervenant
  const { data: sig } = await supabase.from('signalements_medicaux').select('auteur_id').eq('id', signalementId).maybeSingle()
  if (!sig || !intervenantData.some(i => i.id === sig.auteur_id)) return

  const result = await repondreSignalement(signalementId, action === 'sig_oui')
  const texte = !result.ok
    ? 'Votre réponse a déjà été prise en compte. Merci !'
    : action === 'sig_non'
      ? 'Merci, c\'est noté. L\'information n\'a pas été conservée.'
      : 'Merci. ' + (result.destinataire ? result.destinataire + ', personne de confiance,' : 'Un responsable Holiris') + ' va vous contacter pour en savoir plus.'
  await envoyerWhatsApp(from, { type: 'text', text: { body: texte } })
}
