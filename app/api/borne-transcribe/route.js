import { NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { supabaseAdmin, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { fichesDuJeton } from '@/lib/accesMobile'
import { lireJetonMedecin } from '@/lib/emails'
import { transcriptionVide, RIEN_ENTENDU, mettreAuPropre, contexteTranscription, recopieContexte } from '@/lib/transcription'

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

// Qui peut transcrire : une borne (son code), le QR code d'un domicile (code du domicile), un intervenant
// sans compte (lien de sa borne sur téléphone), un médecin (lien du compte rendu) ou une personne connectée.
// Renvoie { seniorId } (dossier dont les noms aident la transcription, ou null), ou null si l'accès est refusé.
async function acces(formData) {
  const code = String(formData.get('code') || '').trim().toUpperCase()
  if (code) {
    const { data: borne } = await supabaseAdmin.from('bornes').select('senior_id').eq('code', code).maybeSingle()
    return borne ? { seniorId: borne.senior_id } : null
  }
  const codeNote = String(formData.get('codeNote') || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (codeNote) {
    const { data: senior } = await supabaseAdmin.from('seniors').select('id').eq('code_note', codeNote).maybeSingle()
    return senior ? { seniorId: senior.id } : null
  }
  const demande = formData.get('seniorId') || null
  const jeton = formData.get('jeton')
  if (jeton) {
    const fiches = await fichesDuJeton(jeton)
    if (!fiches.length) return null
    return { seniorId: fiches.some(f => f.senior_id === demande) ? demande : null }
  }
  const medecin = formData.get('t') && lireJetonMedecin(formData.get('t'))
  if (medecin) return { seniorId: medecin.seniorId }

  const user = await utilisateurCourant()
  if (!user) return null
  if (!demande) return { seniorId: null }
  // Les noms d'un dossier ne servent que pour un dossier que l'on suit
  const [{ data: fam }, { data: interv }] = await Promise.all([
    supabaseAdmin.from('famille').select('id').eq('user_id', user.id).eq('senior_id', demande).is('archived_at', null).limit(1),
    supabaseAdmin.from('intervenants').select('id').eq('user_id', user.id).eq('senior_id', demande).is('archived_at', null).limit(1),
  ])
  const suit = fam?.length || interv?.length || await peutGererSenior(user.id, demande)
  return { seniorId: suit ? demande : null }
}

export async function POST(request) {
  try {
    const formData = await request.formData()
    const autorise = await acces(formData)
    if (!autorise) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
    const audio = formData.get('audio')
    const buffer = await audio.arrayBuffer()
    // Safari (iPhone) enregistre en mp4, Chrome et Android en webm
    const type = audio.type || 'audio/webm'
    const extension = type.includes('mp4') || type.includes('aac') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
    const audioFile = new File([buffer], 'note.' + extension, { type })

    // Noms du dossier concerné : ils aident la transcription
    const contexte = await contexteTranscription(autorise.seniorId).catch(() => '')

    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3-turbo',
      language: 'fr',
      response_format: 'verbose_json',
      ...(contexte && { prompt: contexte }),
    })
    const rawText = transcription.text
    // Silence ou bruit : pas de note inventée
    if (transcriptionVide(rawText, transcription.segments) || recopieContexte(rawText, contexte)) {
      return NextResponse.json({ success: false, rienEntendu: true, error: RIEN_ENTENDU })
    }

    // Texte fidèle à ce qui a été dit (mis au propre, sans résumé ni interprétation)
    const note = await mettreAuPropre(rawText, contexte)
    return NextResponse.json({ success: true, note, rawText })
  } catch (err) {
    console.error('borne-transcribe error:', err)
    return NextResponse.json({ success: false, error: err.message }, { status: 500 })
  }
}
