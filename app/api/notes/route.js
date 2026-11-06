import { NextResponse } from 'next/server'
import { supabaseAdmin, clientUtilisateur, utilisateurCourant, peutGererSenior } from '@/lib/serveur'
import { enregistrerNote } from '@/lib/notesMedicales'
import { lireTraduction } from '@/lib/transcription'

// Ajout d'une note depuis le web (espace intervenant ou carnet famille), avec filtre médical
export async function POST(request) {
  try {
    const { seniorId, texte, source, traduction } = await request.json()
    if (!seniorId || !texte?.trim() || !['intervenant', 'famille'].includes(source)) {
      return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })
    }

    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    // L'auteur doit suivre ce senior, gérer sa structure, ou être admin
    const table = source === 'intervenant' ? 'intervenants' : 'famille'
    const { data: lignes } = await supabaseAdmin.from(table)
      .select('*').eq('user_id', user.id).is('archived_at', null)
    let ligne = (lignes || []).find(l => l.senior_id === seniorId)
    let sourceNote = source
    // Gestionnaire de la structure du senior : il écrit en son nom, en tant que gestionnaire de structure
    if (!ligne && source === 'famille' && await peutGererSenior(user.id, seniorId)) {
      const { data: g } = await supabaseAdmin.from('structure_membres')
        .select('id, nom, email').eq('user_id', user.id).limit(1).maybeSingle()
      if (g) ligne = { id: g.id, name: g.nom || g.email.split('@')[0], role: 'Gestionnaire de structure', email: g.email }
    }
    // Admin qui ne suit pas ce senior : note d'intervenant, en tant qu'administrateur Holiris
    if (!ligne) {
      const { data: a } = await supabaseAdmin.from('famille').select('name, email')
        .eq('user_id', user.id).eq('is_admin', true).is('archived_at', null).limit(1).maybeSingle()
      if (a) { ligne = { id: null, name: a.name, role: 'Administrateur Holiris', email: a.email }; sourceNote = 'intervenant' }
    }
    if (!ligne) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })

    const result = await enregistrerNote({
      seniorId,
      texte: texte.trim(),
      source: sourceNote,
      traduction: lireTraduction(traduction),
      auteur: {
        type: sourceNote,
        id: ligne.id,
        nom: ligne.name || ligne.email?.split('@')[0] || (source === 'famille' ? 'Famille' : 'Intervenant'),
        role: ligne.role,
        telephone: ligne.phone || ligne.whatsapp,
        email: ligne.email || user.email,
      },
    })

    return NextResponse.json({
      success: true,
      medical: result.medical,
      signalementId: result.signalementId,
      note: result.noteEnregistree,
    })
  } catch (error) {
    console.error('Erreur ajout note:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Nom affiché de la personne qui modifie ou supprime une note : sa fiche sur ce dossier,
// sinon sa fiche admin, sinon sa fiche de gestionnaire de structure
async function nomUtilisateur(user, seniorId) {
  const { data: fiches } = await supabaseAdmin.from('famille').select('senior_id, name, is_admin')
    .eq('user_id', user.id).is('archived_at', null)
  const fiche = (fiches || []).find(f => f.senior_id === seniorId) || (fiches || []).find(f => f.is_admin)
  if (fiche?.name) return fiche.name
  const { data: g } = await supabaseAdmin.from('structure_membres').select('nom').eq('user_id', user.id).limit(1).maybeSingle()
  return g?.nom || user.email?.split('@')[0] || 'Inconnu'
}

// Note modifiable ou supprimable par l'utilisateur : admin Holiris ou gestionnaire de la structure du senior
async function noteGeree(noteId) {
  const user = await utilisateurCourant()
  if (!user) return { erreur: NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 }) }
  const { data: note } = await supabaseAdmin.from('notes').select('*').eq('id', noteId).maybeSingle()
  if (!note) return { erreur: NextResponse.json({ success: false, error: 'Note introuvable' }, { status: 404 }) }
  if (!await peutGererSenior(user.id, note.senior_id)) return { erreur: NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 }) }
  return { user, note }
}

// Modification : le texte précédent est gardé dans notes_modifications
export async function PATCH(request) {
  try {
    const { noteId, texte } = await request.json()
    if (!noteId || !texte?.trim()) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })
    const { erreur, user, note } = await noteGeree(noteId)
    if (erreur) return erreur
    const contenu = texte.trim()
    if (contenu === note.content) return NextResponse.json({ success: true, note })

    const nom = await nomUtilisateur(user, note.senior_id)
    const maintenant = new Date().toISOString()
    const { error: e1 } = await supabaseAdmin.from('notes_modifications').insert({
      note_id: note.id, senior_id: note.senior_id, ancien_contenu: note.content, nouveau_contenu: contenu,
      modifiee_par: user.id, modifiee_par_nom: nom, created_at: maintenant,
    })
    if (e1) throw e1
    const { data, error: e2 } = await supabaseAdmin.from('notes')
      .update({ content: contenu, modifiee_at: maintenant, modifiee_par_nom: nom }).eq('id', note.id).select().single()
    if (e2) throw e2
    return NextResponse.json({ success: true, note: data })
  } catch (error) {
    console.error('Erreur modification note:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// Suppression : la note passe dans notes_supprimees, hors de portée de l'IA ; ses alertes sont supprimées avec elle
export async function DELETE(request) {
  try {
    const { noteId } = await request.json()
    if (!noteId) return NextResponse.json({ success: false, error: 'Paramètres invalides' }, { status: 400 })
    const { erreur, user, note } = await noteGeree(noteId)
    if (erreur) return erreur

    const supprimee = {
      id: note.id, senior_id: note.senior_id, intervenant_id: note.intervenant_id, intervenant_name: note.intervenant_name,
      content: note.content, source: note.source, audio_url: note.audio_url, note_created_at: note.created_at, langue_originale: note.langue_originale,
      supprimee_par: user.id, supprimee_par_nom: await nomUtilisateur(user, note.senior_id),
    }
    const { error: e1 } = await supabaseAdmin.from('notes_supprimees').upsert(supprimee)
    if (e1) throw e1
    const { error: e2 } = await supabaseAdmin.from('notes').delete().eq('id', note.id)
    if (e2) throw e2
    return NextResponse.json({ success: true, supprimee: { ...supprimee, supprimee_at: new Date().toISOString() } })
  } catch (error) {
    console.error('Erreur suppression note:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}

// ?noteId= : historique des modifications d'une note, pour qui peut la lire (ou, si elle est supprimée, gérer son dossier)
// ?seniorId= : notes supprimées du dossier, pour qui peut le gérer
// ?original= : texte d'origine d'une note traduite, pour qui peut gérer son dossier
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const noteId = searchParams.get('noteId')
    const seniorId = searchParams.get('seniorId')
    const original = searchParams.get('original')
    const user = await utilisateurCourant()
    if (!user) return NextResponse.json({ success: false, error: 'Non authentifié' }, { status: 401 })

    if (original) {
      const { data } = await supabaseAdmin.from('notes_traductions').select('senior_id, langue, texte_original').eq('note_id', original).maybeSingle()
      if (data && !await peutGererSenior(user.id, data.senior_id)) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
      return NextResponse.json({ success: true, original: data ? { langue: data.langue, texte: data.texte_original } : null })
    }

    if (noteId) {
      const supabase = await clientUtilisateur()
      const { data: lisible } = await supabase.from('notes').select('id').eq('id', noteId).maybeSingle()
      if (!lisible) {
        const { data: s } = await supabaseAdmin.from('notes_supprimees').select('senior_id').eq('id', noteId).maybeSingle()
        if (!s || !await peutGererSenior(user.id, s.senior_id)) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
      }
      const { data } = await supabaseAdmin.from('notes_modifications')
        .select('id, ancien_contenu, nouveau_contenu, modifiee_par_nom, created_at').eq('note_id', noteId).order('created_at')
      return NextResponse.json({ success: true, modifications: data || [] })
    }

    if (!seniorId || !await peutGererSenior(user.id, seniorId)) return NextResponse.json({ success: false, error: 'Accès refusé' }, { status: 403 })
    const { data } = await supabaseAdmin.from('notes_supprimees').select('*').eq('senior_id', seniorId).order('supprimee_at', { ascending: false })
    return NextResponse.json({ success: true, supprimees: data || [] })
  } catch (error) {
    console.error('Erreur historique notes:', error.message)
    return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  }
}
