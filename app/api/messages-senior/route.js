import { NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import { supabaseAdmin, utilisateurCourant } from '@/lib/serveur'

// Messages d'un proche au senior, affichés sur la borne pendant 7 jours au plus, jusqu'à « Lu ».
// Privés : l'auteur les retrouve sur le site, le senior les lit ou les écoute sur la borne.
const SEPT_JOURS = 7 * 24 * 3600 * 1000
const BUCKET = 'messages-vocaux'
const AUDIO_MAX = 5 * 1024 * 1024
const champs = 'id, senior_id, auteur_nom, type, contenu, audio_path, audio_type, duree, created_at, lu_at'

async function borneParCode(code) {
  const { data } = await supabaseAdmin.from('bornes').select('senior_id')
    .eq('code', String(code || '').trim().toUpperCase()).maybeSingle()
  return data
}

// Fiche proche de l'utilisateur pour ce senior (seuls les proches écrivent au senior)
async function procheDe(userId, seniorId) {
  const { data } = await supabaseAdmin.from('famille').select('id, name')
    .eq('user_id', userId).eq('senior_id', seniorId).is('archived_at', null).limit(1)
  return data?.[0] || null
}

// Les enregistrements ne sont gardés que le temps d'être écoutés : supprimés après « Lu » ou au bout de 7 jours.
// La ligne du message reste (sans le fichier), pour que l'auteur voie s'il a été lu.
async function supprimerAudios(messages) {
  const avecFichier = (messages || []).filter(m => m.audio_path)
  if (!avecFichier.length) return
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove(avecFichier.map(m => m.audio_path))
  if (error) { console.error('Suppression des messages vocaux:', error.message); return }
  await supabaseAdmin.from('messages_au_senior').update({ audio_path: null }).in('id', avecFichier.map(m => m.id))
}

// Messages vocaux de plus de 7 jours, tous seniors confondus ; au plus une fois par heure
let dernierMenage = 0
async function menageExpires() {
  if (Date.now() - dernierMenage < 3600 * 1000) return
  dernierMenage = Date.now()
  const { data } = await supabaseAdmin.from('messages_au_senior').select('id, audio_path')
    .not('audio_path', 'is', null).lt('created_at', new Date(Date.now() - SEPT_JOURS).toISOString()).limit(500)
  await supprimerAudios(data)
}

// Lien d'écoute temporaire pour les messages vocaux
async function avecAudio(messages) {
  return Promise.all((messages || []).map(async m => {
    if (m.type !== 'vocal' || !m.audio_path) return m
    const { data } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(m.audio_path, 3600)
    return { ...m, audio_url: data?.signedUrl || null }
  }))
}

export async function GET(request) {
  const params = new URL(request.url).searchParams

  // Borne : messages non lus de moins de 7 jours
  const code = params.get('code')
  if (code) {
    const borne = await borneParCode(code)
    if (!borne) return NextResponse.json({ error: 'Code borne invalide' }, { status: 404 })
    await menageExpires().catch(() => {})
    const { data } = await supabaseAdmin.from('messages_au_senior').select(champs)
      .eq('senior_id', borne.senior_id).is('lu_at', null)
      .gte('created_at', new Date(Date.now() - SEPT_JOURS).toISOString())
      .order('created_at', { ascending: true })
    return NextResponse.json({ messages: await avecAudio(data) })
  }

  // Site : les messages que l'utilisateur a envoyés à ce senior (30 derniers jours)
  const user = await utilisateurCourant()
  if (!user) return NextResponse.json({ messages: [] }, { status: 401 })
  const seniorId = params.get('seniorId')
  const { data } = await supabaseAdmin.from('messages_au_senior').select(champs)
    .eq('senior_id', seniorId).eq('auteur_user_id', user.id)
    .gte('created_at', new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString())
    .order('created_at', { ascending: true })
  const limite = Date.now() - SEPT_JOURS
  const messages = (data || []).map(m => ({ ...m, retire: !m.lu_at && new Date(m.created_at).getTime() < limite }))
  return NextResponse.json({ messages: await avecAudio(messages) })
}

export async function POST(request) {
  try {
    // Message vocal : envoi du fichier
    if ((request.headers.get('content-type') || '').includes('multipart/form-data')) {
      const user = await utilisateurCourant()
      if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
      const form = await request.formData()
      const seniorId = form.get('seniorId')
      const audio = form.get('audio')
      const proche = await procheDe(user.id, seniorId)
      if (!proche) return NextResponse.json({ success: false, error: 'Seuls les proches peuvent envoyer un message au senior.' }, { status: 403 })
      if (!audio || !audio.size) return NextResponse.json({ success: false, error: 'Message vocal vide.' }, { status: 400 })
      if (audio.size > AUDIO_MAX) return NextResponse.json({ success: false, error: 'Message vocal trop long.' }, { status: 400 })

      const type = audio.type || 'audio/webm'
      const extension = type.includes('mp4') || type.includes('aac') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm'
      const chemin = `${seniorId}/${randomUUID()}.${extension}`
      const { error: errStockage } = await supabaseAdmin.storage.from(BUCKET)
        .upload(chemin, Buffer.from(await audio.arrayBuffer()), { contentType: type })
      if (errStockage) throw errStockage

      const { data, error } = await supabaseAdmin.from('messages_au_senior').insert({
        senior_id: seniorId, auteur_user_id: user.id, auteur_famille_id: proche.id, auteur_nom: proche.name,
        type: 'vocal', audio_path: chemin, audio_type: type, duree: Math.round(Number(form.get('duree')) || 0) || null,
      }).select(champs).single()
      if (error) throw error
      return NextResponse.json({ success: true, message: (await avecAudio([data]))[0] })
    }

    const body = await request.json()

    // Borne : « Lu »
    if (body.action === 'lu') {
      const borne = await borneParCode(body.code)
      if (!borne) return NextResponse.json({ success: false }, { status: 404 })
      const { data: lus } = await supabaseAdmin.from('messages_au_senior').update({ lu_at: new Date().toISOString() })
        .eq('id', body.id).eq('senior_id', borne.senior_id).is('lu_at', null).select('id, audio_path')
      await supprimerAudios(lus)
      return NextResponse.json({ success: true })
    }

    // Message écrit
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })
    const texte = String(body.texte || '').trim()
    if (!texte) return NextResponse.json({ success: false, error: 'Message vide.' }, { status: 400 })
    if (texte.length > 2000) return NextResponse.json({ success: false, error: 'Message trop long.' }, { status: 400 })
    const proche = await procheDe(user.id, body.seniorId)
    if (!proche) return NextResponse.json({ success: false, error: 'Seuls les proches peuvent envoyer un message au senior.' }, { status: 403 })
    const { data, error } = await supabaseAdmin.from('messages_au_senior').insert({
      senior_id: body.seniorId, auteur_user_id: user.id, auteur_famille_id: proche.id, auteur_nom: proche.name,
      type: 'texte', contenu: texte,
    }).select(champs).single()
    if (error) throw error
    return NextResponse.json({ success: true, message: data })
  } catch (error) {
    console.error('Erreur messages-senior:', error.message)
    return NextResponse.json({ success: false, error: 'Le message n\'a pas pu être envoyé.' }, { status: 500 })
  }
}
