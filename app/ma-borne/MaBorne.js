'use client'
import { useState, useEffect, useRef } from 'react'
import ActiverNotifications from '../components/ActiverNotifications'

// Borne sur téléphone : un intervenant sans compte laisse ses notes depuis son téléphone,
// avec le lien personnel reçu par WhatsApp (holiris.fr/ma-borne?j=…). Même parcours que la borne du domicile.

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
  lilasFonce: '#8B6FAA',
  lilasClair: '#F3EDF7',
  ambre: '#C4844A',
  rouge: '#C4434F',
  roseClair: '#FBEDEE',
}
const TITRE = 'var(--font-display), "Cormorant Garamond", Georgia, serif'
const TEXTE = 'var(--font-body), "DM Sans", system-ui, sans-serif'
const OMBRE = '0 10px 30px rgba(74, 60, 40, 0.08)'

const memoire = {
  lire: cle => { try { return window.localStorage.getItem(cle) } catch { return null } },
  ecrire: (cle, valeur) => { try { window.localStorage.setItem(cle, valeur) } catch {} },
}

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

const duree = s => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`

export default function MaBorne() {
  const [jeton, setJeton] = useState(null)
  const [step, setStep] = useState('loading')
  const [infos, setInfos] = useState(null) // { prenom, dossiers, messages }
  const [dossier, setDossier] = useState(null)
  const [messageOuvert, setMessageOuvert] = useState(null)
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [duration, setDuration] = useState(0)
  const [noteProposee, setNoteProposee] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [signalement, setSignalement] = useState(null)
  const [reponseMedicale, setReponseMedicale] = useState('')
  const [aideInstallation, setAideInstallation] = useState(false)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  useEffect(() => {
    // Le lien reste dans l'adresse : un raccourci sur l'écran d'accueil garde ainsi l'accès
    const j = new URLSearchParams(window.location.search).get('j') || memoire.lire('holiris_ma_borne')
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture unique du lien au montage
    if (!j) { setStep('invalide'); return }
    memoire.ecrire('holiris_ma_borne', j)
    // L'icône ajoutée à l'écran d'accueil doit rouvrir ce lien, pas l'application avec compte
    const manifeste = '/api/ma-borne/manifest?j=' + encodeURIComponent(j)
    const liens = document.querySelectorAll('link[rel="manifest"]')
    if (liens.length) liens.forEach(l => { l.href = manifeste })
    else { const l = document.createElement('link'); l.rel = 'manifest'; l.href = manifeste; document.head.appendChild(l) }
    setJeton(j)
    setAideInstallation(!memoire.lire('holiris_ma_borne_aide_vue'))
    charger(j)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement unique au montage
  }, [])

  async function charger(j = jeton) {
    try {
      const res = await fetch('/api/ma-borne?j=' + encodeURIComponent(j))
      if (!res.ok) { setStep('invalide'); return }
      setInfos(await res.json())
      setStep(s => (s === 'loading' || s === 'invalide' ? 'accueil' : s))
    } catch {
      setError('Pas de connexion Internet.')
      setStep('accueil')
    }
  }

  function retourAccueil() {
    if (recording) stopRecording(false)
    setDossier(null)
    setAudioBlob(null)
    setNoteProposee('')
    setDuration(0)
    setSignalement(null)
    setReponseMedicale('')
    setError('')
    setStep('accueil')
    charger()
  }

  async function marquerLu(m) {
    setMessageOuvert(null)
    setInfos(prev => ({ ...prev, messages: prev.messages.filter(x => x.id !== m.id) }))
    fetch('/api/ma-borne', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lu', jeton, id: m.id }) }).catch(() => {})
  }

  function masquerAide() {
    memoire.ecrire('holiris_ma_borne_aide_vue', '1')
    setAideInstallation(false)
  }

  // ── Note vocale ──

  function commencerNote(d) {
    setDossier(d)
    setAudioBlob(null)
    setNoteProposee('')
    setDuration(0)
    setError('')
    setStep('enregistrement')
  }

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
      setError("Impossible d'accéder au micro. Autorisez-le dans les réglages du navigateur.")
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
      const result = await (await fetch('/api/borne-transcribe', { method: 'POST', body: formData })).json()
      if (result.success) {
        setNoteProposee(result.note)
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

  function reenregistrer() {
    setAudioBlob(null)
    setNoteProposee('')
    setDuration(0)
    setError('')
    setStep('enregistrement')
  }

  async function envoyerNote() {
    if (!noteProposee.trim() || !dossier) return
    setSending(true)
    try {
      const result = await (await fetch('/api/borne-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: noteProposee,
          intervenantId: dossier.ficheId,
          personneType: 'intervenant',
          intervenantName: dossier.nom,
          intervenantRole: dossier.role || '',
          seniorId: dossier.seniorId,
          jeton,
        }),
      })).json()
      if (result.success && result.signalementId) {
        setSignalement({ id: result.signalementId, notePartielle: !!result.notePartielle })
        setStep('medical')
      } else if (result.success) {
        setStep('confirmation')
      } else {
        setError(result.error === 'Accès refusé' ? 'Ce lien ne permet plus d\'envoyer de note.' : "L'envoi n'a pas fonctionné. Réessayez dans un instant.")
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

  // ── Mise en forme ──

  const page = (contenu, { haut = true } = {}) => (
    <div style={{ minHeight: '100dvh', background: C.fond, fontFamily: TEXTE, color: C.encre, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: haut ? 'flex-start' : 'center', padding: '22px 16px 32px', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes holiris-pulse { 0% { box-shadow: 0 0 0 0 rgba(196,67,79,0.35) } 70% { box-shadow: 0 0 0 22px rgba(196,67,79,0) } 100% { box-shadow: 0 0 0 0 rgba(196,67,79,0) } }
        @keyframes holiris-tourne { to { transform: rotate(360deg) } }
        .mb-bouton { transition: transform 0.15s ease; -webkit-tap-highlight-color: transparent; }
        .mb-bouton:active { transform: scale(0.98); }
      `}</style>
      <div style={{ width: '100%', maxWidth: 520, display: 'flex', flexDirection: 'column', flex: 1 }}>{contenu}</div>
    </div>
  )
  const bouton = (fond, couleur, extra = {}) => ({ background: fond, color: couleur, border: 'none', borderRadius: 18, padding: '18px 22px', fontSize: 17, fontWeight: 500, cursor: 'pointer', fontFamily: TEXTE, ...extra })
  const retour = (libelle, action) => (
    <button onClick={action} className="mb-bouton"
      style={{ alignSelf: 'flex-start', background: C.carte, border: `1px solid ${C.bord}`, borderRadius: 999, padding: '9px 16px', fontSize: 14, color: C.gris, cursor: 'pointer', fontFamily: TEXTE, marginBottom: 18 }}>
      ← {libelle}
    </button>
  )
  const erreurBloc = error && (
    <div style={{ background: C.roseClair, border: '1px solid #F0CDD1', borderRadius: 14, padding: '12px 14px', fontSize: 15, color: '#8E2F38', marginBottom: 16 }}>{error}</div>
  )

  if (step === 'loading') return page(<p style={{ color: C.grisClair, textAlign: 'center', marginTop: '40vh' }}>Chargement…</p>)

  if (step === 'invalide') return page(
    <div style={{ background: C.carte, borderRadius: 24, padding: '34px 26px', boxShadow: OMBRE, textAlign: 'center', marginTop: '18vh' }}>
      <Logo />
      <h1 style={{ fontFamily: TITRE, fontSize: 30, fontWeight: 500, margin: '10px 0 10px' }}>Lien inactif</h1>
      <p style={{ fontSize: 16, color: C.gris, lineHeight: 1.6 }}>
        Ce lien ne fonctionne plus. Demandez à la famille ou au service de vous renvoyer le lien Holiris par WhatsApp.
      </p>
    </div>
  )

  if (step === 'accueil' && messageOuvert) return page(
    <>
      {retour('Retour', () => setMessageOuvert(null))}
      <p style={{ fontSize: 12, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' }}>Message · chez {infos?.dossiers.find(d => d.seniorId === messageOuvert.senior_id)?.senior}</p>
      <div style={{ background: C.carte, borderRadius: 22, padding: '22px 22px', boxShadow: OMBRE, margin: '14px 0 20px' }}>
        <p style={{ fontSize: 19, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{messageOuvert.contenu}</p>
        <p style={{ fontSize: 15, color: C.gris, marginTop: 16, textAlign: 'right' }}>
          — {messageOuvert.auteur_nom}{messageOuvert.auteur_role ? `, ${messageOuvert.auteur_role}` : ''}
          <span style={{ display: 'block', fontSize: 13, color: C.grisClair, marginTop: 2 }}>
            {new Date(messageOuvert.created_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </span>
        </p>
      </div>
      <button onClick={() => marquerLu(messageOuvert)} className="mb-bouton" style={bouton(C.sauge, '#fff', { fontSize: 19 })}>✓ Lu</button>
    </>
  )

  if (step === 'accueil') {
    const dossiers = infos?.dossiers || []
    const messages = infos?.messages || []
    return page(
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          <Logo taille={44} />
          <div>
            <h1 style={{ fontFamily: TITRE, fontSize: 30, fontWeight: 500, margin: 0, lineHeight: 1.1 }}>Bonjour {infos?.prenom}</h1>
            <p style={{ fontSize: 14, color: C.gris, margin: '2px 0 0' }}>{new Date().toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, l => l.toUpperCase())}</p>
          </div>
        </div>
        {erreurBloc}

        {messages.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
            {messages.map(m => (
              <button key={m.id} onClick={() => setMessageOuvert(m)} className="mb-bouton"
                style={{ display: 'flex', gap: 12, alignItems: 'center', background: '#fff', border: `2px solid ${C.lilas}`, borderRadius: 16, padding: '13px 16px', textAlign: 'left', cursor: 'pointer', fontFamily: TEXTE, color: C.encre }}>
                <span style={{ fontSize: 22 }}>✉️</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 16, fontWeight: 600 }}>Message de {m.auteur_nom?.split(' ')[0]}</span>
                  {dossiers.length > 1 && <span style={{ fontSize: 13, color: C.gris }}>chez {dossiers.find(d => d.seniorId === m.senior_id)?.senior}</span>}
                </span>
                <span style={{ fontSize: 14, color: C.lilasFonce, fontWeight: 500 }}>Lire ›</span>
              </button>
            ))}
          </div>
        )}

        <p style={{ fontSize: 12, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 10 }}>Laisser une note</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {dossiers.map(d => (
            <button key={d.ficheId} onClick={() => commencerNote(d)} className="mb-bouton"
              style={bouton(C.sauge, '#fff', { display: 'flex', alignItems: 'center', gap: 14, textAlign: 'left', padding: '20px 20px', boxShadow: '0 10px 24px rgba(74,136,112,0.25)' })}>
              <span style={{ fontSize: 26 }}>🎙</span>
              <span>
                <span style={{ display: 'block', fontSize: 18, fontWeight: 600 }}>Chez {d.senior}</span>
                <span style={{ fontSize: 14, opacity: 0.9 }}>Raconter ma visite</span>
              </span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 22 }}><ActiverNotifications jeton={jeton} /></div>

        {aideInstallation && (
          <div style={{ background: C.carte, border: `1px solid ${C.bord}`, borderRadius: 18, padding: '16px 18px', marginTop: 26, fontSize: 14, color: C.gris, lineHeight: 1.6 }}>
            <strong style={{ color: C.encre, fontSize: 15 }}>Gardez Holiris sur votre écran d’accueil</strong>
            <p style={{ margin: '6px 0 0' }}>iPhone : touchez <strong>Partager</strong> (le carré avec une flèche) puis <strong>Sur l’écran d’accueil</strong>.</p>
            <p style={{ margin: '4px 0 0' }}>Android : touchez <strong>⋮</strong> en haut à droite puis <strong>Ajouter à l’écran d’accueil</strong>.</p>
            <button onClick={masquerAide} style={{ background: 'none', border: 'none', color: C.saugeFonce, fontSize: 14, fontWeight: 500, cursor: 'pointer', padding: 0, marginTop: 10, fontFamily: TEXTE }}>C’est fait</button>
          </div>
        )}

        <p style={{ fontSize: 13, color: C.grisClair, textAlign: 'center', marginTop: 'auto', paddingTop: 30, lineHeight: 1.6 }}>
          Ce lien est personnel : ne le partagez pas.<br />Urgence vitale : appelez le 15 ou le 112.
        </p>
      </>
    )
  }

  if (step === 'enregistrement' || step === 'transcription') return page(
    <>
      {retour('Retour', () => { stopRecording(false); retourAccueil() })}
      <p style={{ fontSize: 12, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' }}>Note pour {dossier?.senior}</p>
      <h2 style={{ fontFamily: TITRE, fontSize: 32, fontWeight: 500, textAlign: 'center', margin: '6px 0 18px' }}>{dossier?.nom}</h2>
      {erreurBloc}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, paddingBottom: 40 }}>
        {step === 'transcription' ? (
          <>
            <div style={{ width: 72, height: 72, borderRadius: '50%', border: `5px solid ${C.saugeClair}`, borderTopColor: C.sauge, animation: 'holiris-tourne 1s linear infinite' }} />
            <p style={{ fontFamily: TITRE, fontSize: 24 }}>Transcription en cours…</p>
          </>
        ) : audioBlob && error ? (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => transcrire(audioBlob)} className="mb-bouton" style={bouton(C.sauge, '#fff')}>Réessayer</button>
            <button onClick={reenregistrer} className="mb-bouton" style={bouton(C.carte, C.saugeFonce, { border: `1.5px solid ${C.sauge}` })}>Réenregistrer</button>
          </div>
        ) : (
          <>
            <button onClick={recording ? () => stopRecording(true) : startRecording} className="mb-bouton"
              style={{ width: 150, height: 150, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, color: '#fff',
                background: recording ? C.rouge : `linear-gradient(145deg, ${C.sauge}, ${C.saugeFonce})`,
                boxShadow: recording ? undefined : '0 14px 32px rgba(74,136,112,0.35)',
                animation: recording ? 'holiris-pulse 1.6s infinite' : 'none' }}>
              <span style={{ fontSize: 42 }}>{recording ? '■' : '🎙'}</span>
              <span style={{ fontSize: 14, letterSpacing: '0.12em', fontWeight: 600 }}>{recording ? duree(duration) : 'PARLER'}</span>
            </button>
            <p style={{ fontSize: 16, color: C.gris, textAlign: 'center', maxWidth: 320 }}>
              {recording ? 'Je vous écoute… touchez à nouveau quand vous avez fini' : 'Touchez le micro et racontez comment s’est passée votre visite'}
            </p>
          </>
        )}
      </div>
    </>
  )

  if (step === 'revision') return page(
    <>
      {retour('Retour', retourAccueil)}
      <h2 style={{ fontFamily: TITRE, fontSize: 30, fontWeight: 500, textAlign: 'center', margin: '0 0 16px' }}>Votre note est prête</h2>
      {erreurBloc}
      <div style={{ background: C.carte, borderRadius: 20, padding: 18, boxShadow: OMBRE, marginBottom: 16 }}>
        <textarea value={noteProposee} onChange={e => setNoteProposee(e.target.value)} rows={6}
          style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', fontFamily: TEXTE, fontSize: 17, lineHeight: 1.6, color: C.encre, background: 'transparent', boxSizing: 'border-box' }} />
        <p style={{ fontSize: 13, color: C.grisClair, marginTop: 6 }}>✏️ Touchez le texte pour le corriger si besoin.</p>
      </div>
      <button onClick={envoyerNote} disabled={sending || !noteProposee.trim()} className="mb-bouton"
        style={bouton(C.sauge, '#fff', { fontSize: 18, marginBottom: 10, opacity: noteProposee.trim() ? 1 : 0.5 })}>
        {sending ? 'Envoi…' : 'Envoyer la note'}
      </button>
      <button onClick={reenregistrer} disabled={sending} className="mb-bouton" style={bouton(C.carte, C.saugeFonce, { border: `1.5px solid ${C.sauge}` })}>
        🎙 Réenregistrer
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
        <button onClick={() => repondreMedical(true)} disabled={sending} className="mb-bouton" style={bouton(C.sauge, '#fff', { flex: 1 })}>Oui, essentielle</button>
        <button onClick={() => repondreMedical(false)} disabled={sending} className="mb-bouton" style={bouton('#F2F4F3', C.gris, { flex: 1 })}>Non</button>
      </div>
    </div>
  )

  if (step === 'confirmation') return page(
    <div style={{ textAlign: 'center', marginTop: '20vh' }}>
      <div style={{ width: 92, height: 92, borderRadius: '50%', background: C.saugeClair, color: C.saugeFonce, fontSize: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>✓</div>
      <h2 style={{ fontFamily: TITRE, fontSize: 34, fontWeight: 500, marginBottom: 8 }}>Merci {infos?.prenom} !</h2>
      <p style={{ fontSize: 17, color: C.saugeFonce }}>Votre note a bien été envoyée à la famille.</p>
      {reponseMedicale && <p style={{ fontSize: 15, color: C.gris, marginTop: 12 }}>{reponseMedicale}</p>}
      <button onClick={retourAccueil} className="mb-bouton" style={bouton(C.carte, C.saugeFonce, { border: `1.5px solid ${C.sauge}`, marginTop: 26 })}>Retour</button>
    </div>
  )

  return null
}
