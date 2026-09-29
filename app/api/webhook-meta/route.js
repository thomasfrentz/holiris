import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { supabaseAdmin as supabase } from '@/lib/serveur'
import { analyserNote, enregistrerNote, repondreSignalement } from '@/lib/notesMedicales'

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

    // Chercher l'expéditeur par numéro WhatsApp : intervenants et proches (une ligne par senior suivi)
    const filtreNumero = variantesNumero(from)
      .flatMap(n => [`whatsapp.eq.${n}`, `phone.eq.${n}`])
      .join(',')
    const [{ data: intervenantData }, { data: familleData }] = await Promise.all([
      supabase.from('intervenants').select('*').or(filtreNumero).is('archived_at', null),
      supabase.from('famille').select('*').or(filtreNumero).is('archived_at', null).not('senior_id', 'is', null),
    ])
    const expediteurs = [
      ...(intervenantData || []).map(l => ({ ...l, type: 'intervenant' })),
      ...(familleData || []).map(l => ({ ...l, type: 'famille' })),
    ]

    console.log('Expéditeur trouvé:', expediteurs.length ? expediteurs[0].name + ' (' + expediteurs[0].type + ')' : 'aucun')

    // Numéro inconnu : on n'attribue pas la note à un senior au hasard
    if (!expediteurs.length) return NextResponse.json({ status: 'unknown sender' })

    // Réponse aux boutons : validation d'une note, ou « Cette information est-elle essentielle ? »
    if (messageType === 'interactive' && message.interactive?.button_reply) {
      const buttonId = String(message.interactive.button_reply.id)
      if (buttonId.startsWith('note_')) await traiterReponseNote(from, buttonId)
      else await traiterReponseSignalement(from, buttonId, expediteurs)
      return NextResponse.json({ status: 'ok' })
    }

    // Les notes non validées sous 24 h sont abandonnées
    await supabase.from('notes_en_attente').delete().lt('created_at', new Date(Date.now() - DELAI_VALIDATION).toISOString())

    // L'auteur a demandé à corriger sa note : le texte qu'il envoie la remplace tel quel
    const { data: aCorriger } = await supabase.from('notes_en_attente').select('*')
      .eq('numero', from).eq('statut', 'a_corriger')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (aCorriger) {
      if (messageType === 'text') {
        await enregistrerCorrection(from, aCorriger, message.text.body)
        return NextResponse.json({ status: 'ok' })
      }
      // Un autre type de message (vocal…) repart de zéro, avec une nouvelle proposition
      await supabase.from('notes_en_attente').delete().eq('id', aCorriger.id)
    }

    const seniorIds = [...new Set(expediteurs.map(e => e.senior_id).filter(Boolean))]
    const selected = expediteurs.find(e => e.selected_senior_id)?.selected_senior_id
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
      // Pour ce senior, le rôle d'intervenant prime si la personne est aussi un proche
      const auteur = expediteurs.find(e => e.senior_id === finalSeniorId && e.type === 'intervenant')
        || expediteurs.find(e => e.senior_id === finalSeniorId)
        || expediteurs[0]

      const auteurNote = {
        type: auteur.type,
        id: auteur.id,
        nom: auteur.name,
        role: auteur.role,
        telephone: auteur.phone || auteur.whatsapp || '+' + from,
        email: auteur.email,
      }

      // Filtre médical avant la relecture : l'auteur valide exactement ce qui sera publié
      const analyse = await analyserNote(noteContent)

      if (!analyse.note) {
        // Rien à publier : seul le signalement médical est créé
        const result = await enregistrerNote({ seniorId: finalSeniorId, texte: noteContent, source, auteur: auteurNote, analyse })
        if (result.signalementId) await demanderSiEssentiel(from, result.signalementId, false)
        return NextResponse.json({ status: 'ok' })
      }

      // Comme sur la borne, la note n'est enregistrée qu'après validation par son auteur
      const { data: enAttente, error } = await supabase.from('notes_en_attente').insert({
        senior_id: finalSeniorId,
        numero: from,
        auteur: auteurNote,
        source,
        texte: analyse.note,
        medical: analyse.medical,
      }).select().single()
      if (error) throw error
      console.log('Note à valider pour senior:', finalSeniorId, analyse.medical ? '(information médicale retirée)' : '')

      await proposerNote(from, enAttente)
    }

    return NextResponse.json({ status: 'ok' })

  } catch (error) {
    console.error('Erreur webhook Meta:', error.message)
    return NextResponse.json({ status: 'error' }, { status: 500 })
  }
}

// WhatsApp transmet le numéro au format 33612345678 ; en base il peut être saisi
// en +33612345678, 0612345678 ou 06 12 34 56 78
function variantesNumero(from) {
  const variantes = ['+' + from, from]
  if (from.startsWith('33') && from.length === 11) {
    const national = '0' + from.slice(2)
    variantes.push(national, national.replace(/(\d{2})(?=\d)/g, '$1 '))
  }
  return variantes
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

// L'expéditeur vient d'écrire : on peut lui répondre librement (fenêtre de 24 h)
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

async function traiterReponseSignalement(from, buttonId, expediteurs) {
  const [action, signalementId] = String(buttonId).split(':')
  if (!signalementId || !['sig_oui', 'sig_non'].includes(action)) return

  // Le signalement doit avoir été créé par cet expéditeur
  const { data: sig } = await supabase.from('signalements_medicaux').select('auteur_id').eq('id', signalementId).maybeSingle()
  if (!sig || !expediteurs.some(e => e.id === sig.auteur_id)) return

  const result = await repondreSignalement(signalementId, action === 'sig_oui')
  const texte = !result.ok
    ? 'Votre réponse a déjà été prise en compte. Merci !'
    : action === 'sig_non'
      ? 'Merci, c\'est noté. L\'information n\'a pas été conservée.'
      : 'Merci. ' + (result.destinataire ? result.destinataire + ', personne de confiance,' : 'Un responsable Holiris') + ' va vous contacter pour en savoir plus.'
  await envoyerWhatsApp(from, { type: 'text', text: { body: texte } })
}

// Au-delà, WhatsApp ne permet plus de répondre librement à l'auteur
const DELAI_VALIDATION = 24 * 60 * 60 * 1000

async function proposerNote(to, enAttente) {
  const { data: senior } = await supabase.from('seniors').select('name').eq('id', enAttente.senior_id).maybeSingle()
  const texte = enAttente.texte.length > 700 ? enAttente.texte.slice(0, 700) + '…' : enAttente.texte
  await envoyerWhatsApp(to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: {
        text: 'Voici la note qui sera ajoutée au carnet' + (senior?.name ? ' de ' + senior.name : '') + ' :\n\n« ' + texte + ' »'
          + (enAttente.medical ? '\n\nUne information médicale a été retirée : pour protéger la personne suivie, elle n\'est jamais enregistrée sur Holiris.' : '')
          + '\n\nLa validez-vous ?'
      },
      action: {
        buttons: [
          { type: 'reply', reply: { id: 'note_ok:' + enAttente.id, title: 'Valider' } },
          { type: 'reply', reply: { id: 'note_mod:' + enAttente.id, title: 'Corriger' } },
          { type: 'reply', reply: { id: 'note_non:' + enAttente.id, title: 'Annuler' } },
        ]
      }
    }
  })
}

async function traiterReponseNote(from, buttonId) {
  const [action, id] = buttonId.split(':')
  if (!id || !['note_ok', 'note_mod', 'note_non'].includes(action)) return

  // La note doit avoir été proposée à cet expéditeur, et ne pas avoir déjà été traitée
  const filtre = q => q.eq('id', id).eq('numero', from).in('statut', ['a_valider', 'a_corriger'])
    .gte('created_at', new Date(Date.now() - DELAI_VALIDATION).toISOString())

  if (action === 'note_non') {
    const { data } = await filtre(supabase.from('notes_en_attente').delete()).select('id')
    await envoyerWhatsApp(from, { type: 'text', text: { body: data?.length ? 'C\'est noté, la note n\'a pas été enregistrée.' : 'Cette note a déjà été traitée.' } })
    return
  }

  if (action === 'note_mod') {
    const { data } = await filtre(supabase.from('notes_en_attente').update({ statut: 'a_corriger' })).select('id')
    await envoyerWhatsApp(from, { type: 'text', text: { body: data?.length
      ? 'Envoyez-moi la note corrigée dans un message écrit : elle remplacera celle-ci.'
      : 'Cette note a déjà été traitée.' } })
    return
  }

  // Le passage à « enregistrement » évite d'enregistrer deux fois la note en cas de double appui
  const { data: enAttente } = await filtre(supabase.from('notes_en_attente').update({ statut: 'enregistrement' })).select().maybeSingle()
  if (!enAttente) {
    await envoyerWhatsApp(from, { type: 'text', text: { body: 'Cette note a déjà été traitée.' } })
    return
  }
  await publierNote(from, enAttente, { medical: enAttente.medical, note: enAttente.texte })
}

async function enregistrerCorrection(from, enAttente, texte) {
  const { data: reservee } = await supabase.from('notes_en_attente').update({ statut: 'enregistrement' })
    .eq('id', enAttente.id).eq('statut', 'a_corriger').select('id').maybeSingle()
  if (!reservee) return

  // La version corrigée passe aussi par le filtre médical
  const analyse = await analyserNote(texte)
  await publierNote(from, enAttente, { medical: analyse.medical || enAttente.medical, note: analyse.note })
}

async function publierNote(from, enAttente, analyse) {
  let result
  try {
    result = await enregistrerNote({
      seniorId: enAttente.senior_id,
      texte: analyse.note,
      source: enAttente.source,
      auteur: enAttente.auteur,
      analyse,
    })
  } catch (error) {
    // La note reste en attente : l'auteur peut appuyer de nouveau sur « Valider » ou renvoyer sa correction
    await supabase.from('notes_en_attente').update({ statut: enAttente.statut === 'a_corriger' ? 'a_corriger' : 'a_valider' }).eq('id', enAttente.id)
    await envoyerWhatsApp(from, { type: 'text', text: { body: 'La note n\'a pas pu être enregistrée. Merci de réessayer dans quelques instants.' } })
    // Pas d'erreur 500 : Meta renverrait l'appui sur le bouton et la note pourrait être enregistrée à l'insu de l'auteur
    console.error('Erreur enregistrement note validée:', error.message)
    return
  }
  await supabase.from('notes_en_attente').delete().eq('id', enAttente.id)
  console.log('Note validée pour senior:', enAttente.senior_id, analyse.medical ? '(information médicale retirée)' : '')

  if (result.signalementId) await demanderSiEssentiel(from, result.signalementId, !!result.note)
  else if (result.note) await envoyerWhatsApp(from, { type: 'text', text: { body: '✅ Merci, votre note a bien été enregistrée.' } })
}
