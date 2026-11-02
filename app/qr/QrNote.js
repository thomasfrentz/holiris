'use client'
import { useState, useEffect, useRef } from 'react'

// Page ouverte par le QR code Holiris (le même partout) : n'importe qui laisse une note chez un senior,
// sans compte, en tapant le code affiché chez lui. Rien du dossier n'y est lisible.

const C = {
  fond: 'linear-gradient(160deg, #FDFBF7 0%, #F7F2EA 55%, #F4EEF6 100%)',
  carte: '#FFFFFF',
  bord: '#E6EDE9',
  encre: '#1F2A24',
  gris: '#6F7C75',
  grisClair: '#9BB5AA',
  sauge: '#7FAF9B',
  saugeFonce: '#4A8870',
  saugeClair: '#EAF4EF',
  lilas: '#BC84C6',
  ambre: '#C4844A',
  rouge: '#C4434F',
  roseClair: '#FBEDEE',
}
const TITRE = 'var(--font-display), "Cormorant Garamond", Georgia, serif'
const TEXTE = 'var(--font-body), "DM Sans", system-ui, sans-serif'
const OMBRE = '0 10px 30px rgba(74, 60, 40, 0.08)'
const ROLES = ['Aide à domicile', 'Auxiliaire de vie', 'Infirmier·ère', 'Aide-soignant·e', 'Kinésithérapeute', 'Médecin', 'Famille', 'Voisin·e', 'Autre']

// Seniors déjà visités depuis ce téléphone : { code, senior, personne }
const memoire = {
  lire: () => { try { return JSON.parse(window.localStorage.getItem('holiris_qr') || '[]') } catch { return [] } },
  ecrire: liste => { try { window.localStorage.setItem('holiris_qr', JSON.stringify(liste.slice(0, 8))) } catch {} },
}
const normaliser = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
const afficherCode = c => c.length > 4 ? c.slice(0, 4) + '-' + c.slice(4) : c
const duree = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

function Logo({ taille = 56 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke={C.sauge} strokeWidth="1.6" />
      <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke={C.lilas} strokeWidth="1.6" />
      <circle cx="32" cy="32" r="5" fill={C.sauge} />
      <circle cx="32" cy="32" r="2.2" fill="#fff" />
    </svg>
  )
}

export default function QrNote() {
  const [step, setStep] = useState('code')
  const [saisie, setSaisie] = useState('')
  const [visites, setVisites] = useState([])
  const [code, setCode] = useState('')
  const [dossier, setDossier] = useState(null) // { senior, personnes }
  const [auteur, setAuteur] = useState(null) // { id, type, nom, role } ou { nom, role, telephone } hors dossier
  const [autre, setAutre] = useState({ nom: '', role: '', telephone: '' })
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [duration, setDuration] = useState(0)
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [signalement, setSignalement] = useState(null)
  const [reponseMedicale, setReponseMedicale] = useState('')
  const [compte, setCompte] = useState(null) // null | 'envoi' | { etat: 'envoye' | 'compte', email }
  const [pourCompte, setPourCompte] = useState(false) // venu depuis « Créer mon compte » de l'accueil, sans note à laisser

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => {
    const liste = memoire.lire()
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique au montage
    setVisites(liste)
    const c = normaliser(new URLSearchParams(window.location.search).get('code'))
    if (c.length === 8) ouvrir(c)
  }, [])

  async function ouvrir(c) {
    setError('')
    setSending(true)
    try {
      const res = await fetch('/api/qr-note?code=' + encodeURIComponent(c))
      if (!res.ok) {
        setError(res.status === 404 ? 'Ce code ne correspond à aucun dossier. Vérifiez-le sur l’affiche.' : 'Une erreur est survenue. Réessayez.')
        setSending(false)
        return
      }
      const data = await res.json()
      setCode(c)
      setDossier(data)
      const deja = memoire.lire().find(v => v.code === c)
      const liste = [{ code: c, senior: data.senior, personne: deja?.personne || null }, ...memoire.lire().filter(v => v.code !== c)]
      memoire.ecrire(liste)
      setVisites(liste)
      // La personne déjà choisie sur ce téléphone, si elle est toujours dans le dossier
      const connue = deja?.personne && data.personnes.find(p => p.id === deja.personne.id)
      setAuteur(connue || null)
      setStep('qui')
    } catch {
      setError('Pas de connexion Internet.')
    }
    setSending(false)
  }

  function choisir(p) {
    setAuteur(p)
    memoire.ecrire(memoire.lire().map(v => v.code === code ? { ...v, personne: p.id ? { id: p.id } : null } : v))
    if (pourCompte) { setStep('compte'); creerCompte(p) }
    else commencer()
  }

  function commencer() {
    setAudioBlob(null)
    setNote('')
    setDuration(0)
    setError('')
    setStep('enregistrement')
  }

  function recommencer() {
    if (recording) stopRecording(false)
    setDossier(null)
    setAuteur(null)
    setAutre({ nom: '', role: '', telephone: '' })
    setSignalement(null)
    setReponseMedicale('')
    setCompte(null)
    setPourCompte(false)
    setSaisie('')
    setError('')
    setStep('code')
  }

  // ── Note vocale ──

  async function startRecording() {
    setError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        if (!mr.aTranscrire) return
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        setAudioBlob(blob)
        transcrire(blob)
      }
      mr.start()
      setRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch {
      setError("Impossible d'accéder au micro. Autorisez-le dans les réglages du navigateur, ou écrivez la note.")
    }
  }

  function stopRecording(aTranscrire = true) {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.aTranscrire = aTranscrire
      mediaRecorderRef.current.stop()
      setRecording(false)
      clearInterval(timerRef.current)
    }
  }

  async function transcrire(blob) {
    if (!blob) return
    setStep('transcription')
    setError('')
    try {
      const formData = new FormData()
      formData.append('audio', blob, blob.type.includes('mp4') ? 'note.m4a' : 'note.webm')
      formData.append('codeNote', code)
      const result = await (await fetch('/api/borne-transcribe', { method: 'POST', body: formData })).json()
      if (result.success) {
        setNote(result.note)
        setStep('revision')
        return
      }
      if (result.rienEntendu) { setAudioBlob(null); setError(result.error) }
      else setError('La transcription n\'a pas fonctionné. Vous pouvez réessayer ou réenregistrer.')
    } catch {
      setError('Pas de connexion Internet. Vous pouvez réessayer ou réenregistrer.')
    }
    setStep('enregistrement')
  }

  async function envoyer() {
    if (!note.trim()) return
    setSending(true)
    setError('')
    try {
      const result = await (await fetch('/api/qr-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'note', code, note,
          ...(auteur?.id ? { personneId: auteur.id, personneType: auteur.type } : { nom: auteur?.nom, role: auteur?.role, telephone: auteur?.telephone }),
        }),
      })).json()
      if (result.success && result.signalementId) {
        setSignalement({ id: result.signalementId, notePartielle: !!result.notePartielle })
        setStep('medical')
      } else if (result.success) {
        setStep('confirmation')
      } else {
        setError(result.error === 'Code inconnu' ? 'Ce code ne fonctionne plus. Demandez le nouveau code à la famille.' : "L'envoi n'a pas fonctionné. Réessayez dans un instant.")
      }
    } catch {
      setError('Pas de connexion Internet. Réessayez dans un instant.')
    }
    setSending(false)
  }

  async function repondreMedical(essentiel) {
    setSending(true)
    try {
      const result = await (await fetch('/api/signalement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signalement.id, action: essentiel ? 'essentiel' : 'non_essentiel' }),
      })).json()
      setReponseMedicale(!essentiel
        ? 'L\'information n\'a pas été conservée.'
        : (result.destinataire ? result.destinataire + ', personne de confiance,' : 'Un responsable Holiris') + ' vous contactera pour en savoir plus.')
    } catch {
      setReponseMedicale('')
    }
    setSending(false)
    setStep('confirmation')
  }

  // Demande d'accès pré-remplie : personne hors dossier, ou fiche sans email
  function demandeAcces(a = auteur) {
    const [prenom, ...nom] = String(a?.nom || '').split(' ')
    const params = new URLSearchParams({ prenom: a?.id ? '' : prenom, nom: a?.id ? '' : nom.join(' '), telephone: a?.telephone || '', senior: dossier?.senior || '', lien: a?.type === 'famille' ? '' : 'Professionnel(le)' })
    window.location.href = '/demande-acces?' + params.toString()
  }

  async function creerCompte(a = auteur) {
    if (!a?.id) return demandeAcces(a)
    setCompte('envoi')
    try {
      const result = await (await fetch('/api/qr-note', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'compte', code, personneId: a.id, personneType: a.type }),
      })).json()
      if (result.success && result.etat === 'demande') return demandeAcces(a)
      if (result.success) { setCompte(result); return }
      setError(result.error || 'Une erreur est survenue.')
    } catch {
      setError('Pas de connexion Internet.')
    }
    setCompte(null)
  }

  // ── Mise en forme ──

  const page = contenu => (
    <div style={{ minHeight: '100dvh', background: C.fond, fontFamily: TEXTE, color: C.encre, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 16px 32px', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes holiris-pulse { 0% { box-shadow: 0 0 0 0 rgba(196,67,79,0.35) } 70% { box-shadow: 0 0 0 22px rgba(196,67,79,0) } 100% { box-shadow: 0 0 0 0 rgba(196,67,79,0) } }
        @keyframes holiris-tourne { to { transform: rotate(360deg) } }
        .qr-bouton { transition: transform 0.15s ease; -webkit-tap-highlight-color: transparent; }
        .qr-bouton:active { transform: scale(0.98); }
      `}</style>
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', flex: 1 }}>{contenu}</div>
    </div>
  )
  const bouton = (fond, couleur, extra = {}) => ({ background: fond, color: couleur, border: 'none', borderRadius: 18, padding: '18px 22px', fontSize: 17, fontWeight: 500, cursor: 'pointer', fontFamily: TEXTE, ...extra })
  const champStyle = { width: '100%', boxSizing: 'border-box', border: `1.5px solid ${C.bord}`, borderRadius: 14, padding: '14px 16px', fontSize: 17, fontFamily: TEXTE, color: C.encre, background: '#fff', outline: 'none' }
  const retour = (libelle, action) => (
    <button onClick={action} className="qr-bouton"
      style={{ alignSelf: 'flex-start', background: C.carte, border: `1px solid ${C.bord}`, borderRadius: 999, padding: '9px 16px', fontSize: 14, color: C.gris, cursor: 'pointer', fontFamily: TEXTE, marginBottom: 18 }}>
      ← {libelle}
    </button>
  )
  const erreurBloc = error && (
    <div style={{ background: C.roseClair, border: '1px solid #F0CDD1', borderRadius: 14, padding: '12px 14px', fontSize: 15, color: '#8E2F38', marginBottom: 16 }}>{error}</div>
  )
  const surtitre = texte => <p style={{ fontSize: 12, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', margin: '0 0 10px' }}>{texte}</p>

  if (step === 'code') {
    const c = normaliser(saisie)
    return page(
      <>
        {pourCompte && retour('Retour', () => { setPourCompte(false); setError('') })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 22 }}>
          <Logo taille={44} />
          <div>
            <h1 style={{ fontFamily: TITRE, fontSize: 30, fontWeight: 500, margin: 0, lineHeight: 1.1 }}>{pourCompte ? 'Créer mon compte' : 'Laisser une note'}</h1>
            <p style={{ fontSize: 14, color: C.gris, margin: '2px 0 0' }}>
              {pourCompte ? 'Vos notes, l’agenda et les messages de la famille' : 'Holiris, le carnet de liaison à domicile'}
            </p>
          </div>
        </div>
        {erreurBloc}

        {visites.length > 0 && (
          <>
            {surtitre(pourCompte ? 'Choisissez un domicile' : 'Vos dernières visites')}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 26 }}>
              {visites.map(v => (
                <button key={v.code} onClick={() => ouvrir(v.code)} disabled={sending} className="qr-bouton"
                  style={bouton(C.sauge, '#fff', { display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', padding: '18px 20px', boxShadow: '0 10px 24px rgba(74,136,112,0.25)' })}>
                  <span style={{ fontSize: 24 }}>{pourCompte ? '🏠' : '🎙'}</span>
                  <span style={{ fontSize: 18, fontWeight: 600 }}>Chez {v.senior}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {surtitre(visites.length ? 'Autre domicile' : 'Code du domicile')}
        <form onSubmit={e => { e.preventDefault(); if (c.length === 8) ouvrir(c) }}
          style={{ background: C.carte, borderRadius: 22, padding: '20px 18px', boxShadow: OMBRE }}>
          <p style={{ fontSize: 15, color: C.gris, lineHeight: 1.5, margin: '0 0 14px' }}>
            {pourCompte
              ? 'Pour créer votre compte, tapez le code domicile d’une personne que vous suivez, puis choisissez votre nom.'
              : 'Tapez le code inscrit sous le QR code, sur l’affiche Holiris du domicile.'}
          </p>
          <input key={pourCompte ? 'compte' : 'note'} autoFocus={pourCompte} value={afficherCode(c)} onChange={e => setSaisie(e.target.value)} placeholder="XXXX-XXXX" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false}
            style={{ ...champStyle, fontSize: 26, letterSpacing: '0.18em', textAlign: 'center', fontWeight: 600, marginBottom: 14 }} />
          <button type="submit" disabled={sending || c.length !== 8} className="qr-bouton"
            style={bouton(C.sauge, '#fff', { width: '100%', opacity: c.length === 8 ? 1 : 0.5 })}>
            {sending ? 'Recherche…' : 'Continuer'}
          </button>
        </form>

        {!pourCompte && (
          <button onClick={() => { setPourCompte(true); setError(''); window.scrollTo(0, 0) }} className="qr-bouton"
            style={bouton(C.carte, C.saugeFonce, { border: `1.5px solid ${C.sauge}`, marginTop: 18, display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '15px 18px' })}>
            <span style={{ fontSize: 22 }}>👤</span>
            <span>
              <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>Créer mon compte Holiris</span>
              <span style={{ fontSize: 13, color: C.gris, fontWeight: 400 }}>Vous venez régulièrement ? Suivez vos notes et les messages de la famille</span>
            </span>
          </button>
        )}
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: C.gris }}>
          Déjà un compte ? <a href="/login" style={{ color: C.saugeFonce }}>Se connecter</a>
        </p>

        <p style={{ fontSize: 13, color: C.grisClair, textAlign: 'center', marginTop: 'auto', paddingTop: 30, lineHeight: 1.6 }}>
          Vos notes sont transmises à la famille et aux professionnels qui suivent la personne.<br />Urgence vitale : appelez le 15 ou le 112.
        </p>
      </>
    )
  }

  if (step === 'qui') return page(
    <>
      {retour('Retour', recommencer)}
      {surtitre('Note pour ' + dossier?.senior)}
      <h2 style={{ fontFamily: TITRE, fontSize: 32, fontWeight: 500, margin: '0 0 16px' }}>Qui êtes-vous ?</h2>
      {erreurBloc}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {dossier?.personnes.map(p => (
          <button key={p.type + p.id} onClick={() => choisir(p)} className="qr-bouton"
            style={bouton(C.carte, C.encre, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, textAlign: 'left', border: `2px solid ${auteur?.id === p.id ? C.sauge : C.bord}`, padding: '15px 18px' })}>
            <span style={{ fontWeight: 600 }}>{p.nom}</span>
            <span style={{ fontSize: 14, color: C.gris }}>{p.role}</span>
          </button>
        ))}
        <button onClick={() => setStep('autre')} className="qr-bouton"
          style={bouton('transparent', C.saugeFonce, { border: `1.5px dashed ${C.sauge}`, padding: '15px 18px' })}>
          Je ne suis pas dans la liste
        </button>
      </div>
    </>
  )

  if (step === 'autre') return page(
    <>
      {retour('Retour', () => setStep('qui'))}
      {surtitre('Note pour ' + dossier?.senior)}
      <h2 style={{ fontFamily: TITRE, fontSize: 32, fontWeight: 500, margin: '0 0 16px' }}>Présentez-vous</h2>
      <form onSubmit={e => {
        e.preventDefault()
        if (!autre.nom.trim() || !autre.role) return
        const a = { nom: autre.nom.trim(), role: autre.role, telephone: autre.telephone.trim() }
        setAuteur(a)
        if (pourCompte) demandeAcces(a)
        else commencer()
      }}
        style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input value={autre.nom} onChange={e => setAutre({ ...autre, nom: e.target.value })} placeholder="Prénom et nom *" autoComplete="name" style={champStyle} />
        <select value={autre.role} onChange={e => setAutre({ ...autre, role: e.target.value })} style={{ ...champStyle, color: autre.role ? C.encre : C.grisClair }}>
          <option value="">Vous êtes… *</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input value={autre.telephone} onChange={e => setAutre({ ...autre, telephone: e.target.value })} placeholder="Téléphone (facultatif)" type="tel" autoComplete="tel" style={champStyle} />
        <p style={{ fontSize: 13, color: C.grisClair, margin: 0 }}>Votre téléphone permet à la famille de vous recontacter si besoin.</p>
        <button type="submit" disabled={!autre.nom.trim() || !autre.role} className="qr-bouton"
          style={bouton(C.sauge, '#fff', { marginTop: 6, opacity: autre.nom.trim() && autre.role ? 1 : 0.5 })}>
          Continuer
        </button>
      </form>
    </>
  )

  if (step === 'enregistrement' || step === 'transcription') return page(
    <>
      {retour('Retour', () => { stopRecording(false); setStep('qui') })}
      <p style={{ fontSize: 12, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' }}>Note pour {dossier?.senior}</p>
      <h2 style={{ fontFamily: TITRE, fontSize: 32, fontWeight: 500, textAlign: 'center', margin: '6px 0 18px' }}>{auteur?.nom}</h2>
      {erreurBloc}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 40 }}>
        {step === 'transcription' ? (
          <>
            <div style={{ width: 72, height: 72, borderRadius: '50%', border: `5px solid ${C.saugeClair}`, borderTopColor: C.sauge, animation: 'holiris-tourne 1s linear infinite' }} />
            <p style={{ fontFamily: TITRE, fontSize: 24 }}>Transcription en cours…</p>
          </>
        ) : audioBlob && error ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => transcrire(audioBlob)} className="qr-bouton" style={bouton(C.sauge, '#fff')}>Réessayer</button>
            <button onClick={commencer} className="qr-bouton" style={bouton(C.carte, C.saugeFonce, { border: `1.5px solid ${C.sauge}` })}>Réenregistrer</button>
          </div>
        ) : (
          <>
            <button onClick={recording ? () => stopRecording(true) : startRecording} className="qr-bouton"
              style={{ width: 150, height: 150, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#fff',
                background: recording ? C.rouge : `linear-gradient(145deg, ${C.sauge}, ${C.saugeFonce})`,
                boxShadow: recording ? undefined : '0 14px 32px rgba(74,136,112,0.35)',
                animation: recording ? 'holiris-pulse 1.6s infinite' : 'none' }}>
              <span style={{ fontSize: 42 }}>{recording ? '■' : '🎙'}</span>
              <span style={{ fontSize: 14, letterSpacing: '0.12em', fontWeight: 600 }}>{recording ? duree(duration) : 'PARLER'}</span>
            </button>
            <p style={{ fontSize: 16, color: C.gris, textAlign: 'center', maxWidth: 320 }}>
              {recording ? 'Je vous écoute… touchez à nouveau quand vous avez fini' : 'Touchez le micro et racontez votre visite'}
            </p>
            {!recording && (
              <button onClick={() => { setError(''); setStep('revision') }} className="qr-bouton"
                style={{ background: 'none', border: 'none', color: C.saugeFonce, fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: TEXTE, textDecoration: 'underline' }}>
                ✏️ Écrire plutôt
              </button>
            )}
          </>
        )}
      </div>
    </>
  )

  if (step === 'revision') return page(
    <>
      {retour('Retour', commencer)}
      <h2 style={{ fontFamily: TITRE, fontSize: 30, fontWeight: 500, textAlign: 'center', margin: '0 0 16px' }}>{audioBlob ? 'Votre note est prête' : 'Votre note'}</h2>
      {erreurBloc}
      <div style={{ background: C.carte, borderRadius: 20, padding: 18, boxShadow: OMBRE, marginBottom: 16 }}>
        <textarea value={note} onChange={e => setNote(e.target.value)} rows={6} maxLength={4000} autoFocus={!audioBlob}
          placeholder={'Comment s’est passée votre visite chez ' + dossier?.senior + ' ?'}
          style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', fontFamily: TEXTE, fontSize: 17, lineHeight: 1.6, color: C.encre, background: 'transparent', boxSizing: 'border-box' }} />
        {audioBlob && <p style={{ fontSize: 13, color: C.grisClair, marginTop: 6 }}>✏️ Touchez le texte pour le corriger si besoin.</p>}
      </div>
      <button onClick={envoyer} disabled={sending || !note.trim()} className="qr-bouton"
        style={bouton(C.sauge, '#fff', { fontSize: 18, marginBottom: 10, opacity: note.trim() ? 1 : 0.5 })}>
        {sending ? 'Envoi…' : 'Envoyer la note'}
      </button>
      <button onClick={commencer} disabled={sending} className="qr-bouton" style={bouton(C.carte, C.saugeFonce, { border: `1.5px solid ${C.sauge}` })}>
        🎙 {audioBlob ? 'Réenregistrer' : 'Dicter plutôt'}
      </button>
    </>
  )

  if (step === 'medical') return page(
    <div style={{ background: C.carte, borderRadius: 24, padding: '28px 22px', boxShadow: OMBRE, textAlign: 'center', marginTop: '12vh' }}>
      <p style={{ fontSize: 12, color: C.ambre, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 12 }}>Information médicale</p>
      <p style={{ fontSize: 17, lineHeight: 1.6, marginBottom: 10 }}>
        Votre note contient une information médicale. Pour protéger la personne suivie,
        {signalement?.notePartielle ? ' cette partie n’a pas été enregistrée (le reste de la note a bien été publié).' : ' elle n’a pas été enregistrée.'}
      </p>
      <p style={{ fontSize: 15, color: C.saugeFonce, lineHeight: 1.6, marginBottom: 22 }}>
        Cette information est-elle essentielle ? Si oui, la personne de confiance vous contactera.
      </p>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={() => repondreMedical(true)} disabled={sending} className="qr-bouton" style={bouton(C.sauge, '#fff', { flex: 1 })}>Oui, essentielle</button>
        <button onClick={() => repondreMedical(false)} disabled={sending} className="qr-bouton" style={bouton('#F2F4F3', C.gris, { flex: 1 })}>Non</button>
      </div>
    </div>
  )

  // Création de compte demandée depuis l'accueil
  if (step === 'compte') return page(
    <>
      {retour('Retour', recommencer)}
      <div style={{ background: C.carte, borderRadius: 22, padding: '26px 22px', boxShadow: OMBRE, marginTop: '10vh', textAlign: 'center' }}>
        <Logo />
        {compte === 'envoi' ? (
          <p style={{ fontSize: 17, color: C.gris, marginTop: 14 }}>Envoi en cours…</p>
        ) : compte?.etat === 'envoye' ? (
          <p style={{ fontSize: 17, color: C.saugeFonce, lineHeight: 1.6, marginTop: 14 }}>
            ✉️ Un lien pour créer votre compte a été envoyé à <strong>{compte.email}</strong>.<br />
            <span style={{ fontSize: 15, color: C.gris }}>Pensez à regarder dans les courriers indésirables.</span>
          </p>
        ) : compte?.etat === 'compte' ? (
          <p style={{ fontSize: 17, color: C.gris, lineHeight: 1.6, marginTop: 14 }}>
            Vous avez déjà un compte Holiris.<br /><a href="/login" style={{ color: C.saugeFonce, fontWeight: 600 }}>Se connecter</a>
          </p>
        ) : (
          <div style={{ marginTop: 14 }}>
            {erreurBloc}
            <button onClick={() => creerCompte()} className="qr-bouton" style={bouton(C.sauge, '#fff', { width: '100%' })}>Réessayer</button>
          </div>
        )}
      </div>
    </>
  )

  if (step === 'confirmation') return page(
    <div style={{ textAlign: 'center', marginTop: '20vh' }}>
      <div style={{ width: 92, height: 92, borderRadius: '50%', background: C.saugeClair, color: C.saugeFonce, fontSize: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>✓</div>
      <h2 style={{ fontFamily: TITRE, fontSize: 34, fontWeight: 500, marginBottom: 8 }}>Merci {auteur?.nom?.split(' ')[0]} !</h2>
      <p style={{ fontSize: 17, color: C.saugeFonce }}>Votre note a bien été envoyée à la famille.</p>
      {reponseMedicale && <p style={{ fontSize: 15, color: C.gris, marginTop: 12 }}>{reponseMedicale}</p>}
      <button onClick={recommencer} className="qr-bouton" style={bouton(C.carte, C.saugeFonce, { border: `1.5px solid ${C.sauge}`, marginTop: 26 })}>Terminer</button>

      <div style={{ background: C.carte, borderRadius: 20, padding: '20px 20px', boxShadow: OMBRE, marginTop: 34, textAlign: 'left' }}>
        {compte?.etat === 'envoye' ? (
          <p style={{ fontSize: 15, color: C.saugeFonce, lineHeight: 1.6, margin: 0 }}>
            ✉️ Un lien pour créer votre compte a été envoyé à <strong>{compte.email}</strong>. Pensez à regarder dans les courriers indésirables.
          </p>
        ) : compte?.etat === 'compte' ? (
          <p style={{ fontSize: 15, color: C.gris, lineHeight: 1.6, margin: 0 }}>
            Vous avez déjà un compte Holiris. <a href="/login" style={{ color: C.saugeFonce, fontWeight: 500 }}>Se connecter</a>
          </p>
        ) : (
          <>
            <p style={{ fontSize: 16, fontWeight: 600, margin: '0 0 6px' }}>Créer votre compte Holiris</p>
            <p style={{ fontSize: 14, color: C.gris, lineHeight: 1.6, margin: '0 0 14px' }}>
              Retrouvez vos notes, l’agenda et les messages de la famille, pour {dossier?.senior} et les autres personnes que vous suivez.
            </p>
            {erreurBloc}
            <button onClick={() => creerCompte()} disabled={compte === 'envoi'} className="qr-bouton" style={bouton(C.sauge, '#fff', { width: '100%', padding: '15px 20px', fontSize: 16 })}>
              {compte === 'envoi' ? 'Envoi…' : 'Créer mon compte'}
            </button>
            <p style={{ fontSize: 13, color: C.grisClair, textAlign: 'center', margin: '10px 0 0' }}>
              Déjà un compte ? <a href="/login" style={{ color: C.saugeFonce }}>Se connecter</a>
            </p>
          </>
        )}
      </div>
    </div>
  )

  return null
}
