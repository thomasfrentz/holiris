'use client'
import { useState, useEffect, useRef } from 'react'
import { demarrerVisio } from '../lib/visioRtc'

export default function Borne() {
  const [step, setStep] = useState('loading')
  const [codeInput, setCodeInput] = useState('')
  const [borneInfo, setBorneInfo] = useState(null)
  const [personnes, setPersonnes] = useState([])
  const [selectedPersonne, setSelectedPersonne] = useState(null)
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [sending, setSending] = useState(false)
  const [transcribing, setTranscribing] = useState(false)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(0)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteNom, setInviteNom] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [noteProposee, setNoteProposee] = useState('')
  const [signalement, setSignalement] = useState(null) // { id, notePartielle }
  const [reponseMedicale, setReponseMedicale] = useState('')
  const [alertesBorne, setAlertesBorne] = useState([])
  const [messagesBorne, setMessagesBorne] = useState(null) // { nombre, auteurs }
  const [sosCompte, setSosCompte] = useState(0)
  const [sosResultat, setSosResultat] = useState(null) // { success, emails, whatsapp, dejaPrevenus }
  const [surveillanceVisio, setSurveillanceVisio] = useState(false) // SOS récent : un proche peut demander la visio
  const [visio, setVisio] = useState(null) // { canal, prenom, etat }
  const [cameraAutorisee, setCameraAutorisee] = useState(null) // null | true | false

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const sosEnvoiRef = useRef(false)
  const visioRtcRef = useRef(null)
  const fluxVisioRef = useRef(null)
  const apercuRef = useRef(null)
  const sonDistantRef = useRef(null)
  const finVisioRef = useRef(null)


  useEffect(() => {
    loadBorne(localStorage.getItem('holiris_borne_code'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement unique au montage
  }, [])

  async function loadBorne(code) {
    if (!code) {
      setStep('setup')
      return
    }
    setStep('loading')
    const res = await fetch('/api/borne?code=' + encodeURIComponent(code.toUpperCase()))
    const { borne, personnes: liste } = res.ok ? await res.json() : {}

    if (!borne) {
      localStorage.removeItem('holiris_borne_code')
      setStep('setup')
      setError('Code borne invalide.')
      return
    }

    setBorneInfo(borne)
    setPersonnes(liste)
    setStep('accueil')
    // Borne rechargée juste après un SOS : reprendre la surveillance des demandes de visio
    fetch('/api/borne-visio?code=' + encodeURIComponent(borne.code))
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.sosRecent) setSurveillanceVisio(true) }).catch(() => {})
  }

  async function activerBorne() {
    if (!codeInput.trim()) return
    setError('')
    const code = codeInput.trim().toUpperCase()
    localStorage.setItem('holiris_borne_code', code)
    await loadBorne(code)
  }

  function choisirPersonne(p) {
    setSelectedPersonne(p)
    setAudioBlob(null)
    setNoteProposee('')
    setDuration(0)
    setAlertesBorne([])
    setMessagesBorne(null)
    // Messages non lus de cette personne : annonce seulement (nombre et prénoms, jamais le contenu)
    if (p.type !== 'invite' && p.id && borneInfo?.code) {
      fetch('/api/borne?code=' + encodeURIComponent(borneInfo.code) + '&nonlus=' + p.id + '&type=' + p.type)
        .then(res => res.ok ? res.json() : null)
        .then(data => setMessagesBorne(data?.nombre ? data : null))
        .catch(() => {})
    }
    setStep('enregistrement')
    // Alertes en cours : seulement pour les personnes de la liste, pas pour un visiteur
    if (p.type !== 'invite' && borneInfo?.code) {
      fetch('/api/borne?alertes=1&code=' + encodeURIComponent(borneInfo.code))
        .then(res => res.ok ? res.json() : { alertes: [] })
        .then(data => setAlertesBorne(data.alertes || []))
        .catch(() => {})
    }
  }

  function validerInvite() {
    if (!inviteNom.trim()) return
    choisirPersonne({ id: null, name: inviteNom.trim(), role: inviteRole.trim() || 'Visiteur', type: 'invite' })
    setShowInvite(false)
    setInviteNom('')
    setInviteRole('')
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        setAudioBlob(new Blob(chunksRef.current, { type: 'audio/webm' }))
        stream.getTracks().forEach(t => t.stop())
      }
      mr.start()
      setRecording(true)
      setDuration(0)
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } catch {
      setError("Impossible d'accéder au microphone.")
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop()
      setRecording(false)
      clearInterval(timerRef.current)
    }
  }

  async function transcrire() {
    if (!audioBlob) return
    setTranscribing(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'note.webm')
      const res = await fetch('/api/borne-transcribe', { method: 'POST', body: formData })
      const result = await res.json()
      if (result.success) {
        setNoteProposee(result.note)
        setStep('revision')
      } else {
        setError("Erreur lors de la transcription : " + (result.error || 'inconnue'))
      }
    } catch {
      setError('Erreur réseau.')
    }
    setTranscribing(false)
  }

  async function envoyerNote() {
    if (!noteProposee.trim() || !selectedPersonne) return
    setSending(true)
    try {
      const res = await fetch('/api/borne-note', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          note: noteProposee,
          intervenantId: selectedPersonne.id || '',
          personneType: selectedPersonne.type || 'intervenant',
          intervenantName: selectedPersonne.name,
          intervenantRole: selectedPersonne.role || '',
          seniorId: borneInfo.senior_id
        })
      })
      const result = await res.json()
      if (result.success && result.signalementId) {
        // Information médicale retirée : demander si elle est essentielle
        setSignalement({ id: result.signalementId, notePartielle: !!result.notePartielle })
        setStep('medical')
      } else if (result.success) {
        terminer()
      } else {
        setError("Erreur lors de l'envoi.")
      }
    } catch {
      setError('Erreur réseau.')
    }
    setSending(false)
  }

  function terminer() {
    setStep('confirmation')
    setTimeout(() => {
      setSelectedPersonne(null)
      setAudioBlob(null)
      setNoteProposee('')
      setDuration(0)
      setSignalement(null)
      setReponseMedicale('')
      setStep('accueil')
    }, 3000)
  }

  async function repondreMedical(essentiel) {
    setSending(true)
    try {
      const res = await fetch('/api/signalement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signalement.id, action: essentiel ? 'essentiel' : 'non_essentiel' })
      })
      const result = await res.json()
      setReponseMedicale(!essentiel
        ? 'L\'information n\'a pas été conservée.'
        : (result.destinataire ? result.destinataire + ', personne de confiance,' : 'Un responsable Holiris') + ' vous contactera pour en savoir plus.')
    } catch {
      setReponseMedicale('')
    }
    setSending(false)
    terminer()
  }

  // SOS : confirmation avec compte à rebours ; sans réponse, l'alerte part automatiquement
  const SOS_DELAI = 20

  function ouvrirSos() {
    sosEnvoiRef.current = false
    setSosResultat(null)
    setSosCompte(SOS_DELAI)
    setStep('sos')
  }

  async function envoyerSos(auto) {
    if (sosEnvoiRef.current) return
    sosEnvoiRef.current = true
    setStep('sos-envoi')
    try {
      const res = await fetch('/api/borne-sos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: borneInfo?.code, auto }),
      })
      const resultat = await res.json()
      setSosResultat(resultat)
      if (resultat.success) setSurveillanceVisio(true)
    } catch {
      setSosResultat({ success: false })
    }
    setStep('sos-envoye')
  }

  useEffect(() => {
    if (step !== 'sos') return
    const t = setTimeout(() => sosCompte <= 1 ? envoyerSos(true) : setSosCompte(c => c - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- envoyerSos est protégé contre le double envoi
  }, [step, sosCompte])

  // Prévenue : au moins un email ou WhatsApp parti (ou déjà prévenue il y a moins de 2 minutes)
  const famillePrevenue = sosResultat?.success && (sosResultat.dejaPrevenus || sosResultat.emails + sosResultat.whatsapp > 0)

  // Retour automatique à l'accueil 3 minutes après l'envoi
  useEffect(() => {
    if (step !== 'sos-envoye' || !famillePrevenue) return
    const t = setTimeout(() => setStep('accueil'), 3 * 60 * 1000)
    return () => clearTimeout(t)
  }, [step, famillePrevenue])

  // Visio demandée par un proche (lien reçu après le SOS) : vérification toutes les 3 secondes
  useEffect(() => {
    if (!surveillanceVisio || visio || !borneInfo?.code) return
    const t = setInterval(async () => {
      try {
        const d = await (await fetch('/api/borne-visio?code=' + encodeURIComponent(borneInfo.code))).json()
        if (d.visio) lancerVisio(d.visio)
        else if (!d.sosRecent) setSurveillanceVisio(false)
      } catch {}
    }, 3000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lancerVisio ne dépend que de refs
  }, [surveillanceVisio, visio, borneInfo])

  async function lancerVisio({ canal, prenom, iceServers }) {
    if (visioRtcRef.current) return
    let flux = null
    try { flux = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true }) }
    catch { try { flux = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { flux = null } }
    if (!flux) {
      // Caméra et micro refusés sur la tablette : la visio est annulée
      fetch('/api/borne-visio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: borneInfo.code, canal }) }).catch(() => {})
      return
    }
    fluxVisioRef.current = flux
    setVisio({ canal, prenom, etat: 'connexion' })
    window.scrollTo(0, 0) // le bandeau « Caméra et micro activés » doit être visible d'emblée
    visioRtcRef.current = demarrerVisio({
      role: 'borne', canal, iceServers, fluxLocal: flux,
      surFluxDistant: f => { if (sonDistantRef.current) sonDistantRef.current.srcObject = f },
      surEtat: etat => etat === 'termine' ? finVisio(false) : setVisio(v => v && { ...v, etat }),
    })
    finVisioRef.current = setTimeout(() => finVisio(true), 15 * 60 * 1000)
  }

  function finVisio(prevenir = true) {
    clearTimeout(finVisioRef.current)
    const rtc = visioRtcRef.current
    visioRtcRef.current = null
    rtc?.arreter(prevenir)
    fluxVisioRef.current?.getTracks().forEach(t => t.stop())
    setVisio(v => {
      if (v) fetch('/api/borne-visio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: borneInfo?.code, canal: v.canal }) }).catch(() => {})
      return null
    })
  }

  // Aperçu de sa propre image pendant la visio
  useEffect(() => {
    if (visio && apercuRef.current && fluxVisioRef.current) apercuRef.current.srcObject = fluxVisioRef.current
  }, [visio])

  // À faire une fois à l'installation : la tablette mémorise l'autorisation caméra et micro
  async function autoriserCamera() {
    try {
      const flux = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      flux.getTracks().forEach(t => t.stop())
      setCameraAutorisee(true)
    } catch {
      setCameraAutorisee(false)
    }
  }

  function formatDuration(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  function resetBorne() {
    localStorage.removeItem('holiris_borne_code')
    setBorneInfo(null)
    setPersonnes([])
    setSelectedPersonne(null)
    setStep('setup')
  }

  const bg = { minHeight: '100vh', background: '#1E2820', fontFamily: "'Inter', DM Sans, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }

  // La visio passe devant tous les autres écrans, avec un bandeau visible en permanence
  if (visio) return (
    <div style={{ ...bg, background: '#2A1416', justifyContent: 'flex-start', paddingTop: 24 }}>
      <div style={{ width: '100%', maxWidth: 640, textAlign: 'center' }}>
        <div style={{ background: '#C4434F', borderRadius: 12, padding: '16px 20px', color: '#fff', fontSize: 19, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', boxShadow: '0 0 0 4px rgba(255,255,255,0.35)' }} />
          Caméra et micro activés
        </div>
        <p style={{ fontSize: 22, color: '#FAFCFA', margin: '22px 0 6px' }}>
          {visio.etat === 'en-direct' ? <><strong>{visio.prenom}</strong> vous voit et vous entend</> : <>Connexion avec <strong>{visio.prenom}</strong>…</>}
        </p>
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.6)', marginBottom: 20 }}>Vous pouvez lui parler normalement.</p>
        <video ref={apercuRef} autoPlay playsInline muted style={{ width: 280, aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 12, background: '#000', transform: 'scaleX(-1)' }} />
        <audio ref={sonDistantRef} autoPlay />
        <button onClick={() => finVisio(true)}
          style={{ display: 'block', width: '100%', marginTop: 24, background: 'rgba(255,255,255,0.12)', color: '#fff', border: '2px solid rgba(255,255,255,0.35)', borderRadius: 14, padding: '22px 0', fontSize: 21, fontWeight: 600, cursor: 'pointer' }}>
          Arrêter la caméra
        </button>
      </div>
    </div>
  )

  if (step === 'loading') return (
    <div style={bg}><div style={{ color: '#9AB89F', fontSize: 14 }}>Chargement...</div></div>
  )

  if (step === 'setup') return (
    <div style={bg}>
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 8, padding: '48px 40px', width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 16 }}>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#9AB89F" strokeWidth="1.2" fill="none"/>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#A89FCC" strokeWidth="1.2" fill="none"/>
            <circle cx="32" cy="32" r="5" fill="#9AB89F"/>
            <circle cx="32" cy="32" r="2.2" fill="#1E2820"/>
          </svg>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 300, color: '#FAFCFA', letterSpacing: '0.12em', marginBottom: 8 }}>
            Hol<span style={{ color: '#9AB89F', fontStyle: 'italic' }}>iris</span>
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.15em' }}>CONFIGURATION DE LA BORNE</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {error && <div style={{ background: 'rgba(196,122,130,0.15)', border: '1px solid rgba(196,122,130,0.3)', borderRadius: 4, padding: '10px 14px', fontSize: 13, color: '#e0939a' }}>{error}</div>}
          <div>
            <label style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9AB89F', display: 'block', marginBottom: 6 }}>Code borne</label>
            <input type="text" placeholder="BORNE-XXXXX" value={codeInput}
              onChange={e => setCodeInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === 'Enter' && activerBorne()}
              style={{ width: '100%', padding: '14px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(107,143,113,0.3)', borderRadius: 4, color: '#FAFCFA', fontSize: 18, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.1em', textAlign: 'center' }}
            />
          </div>
          <button onClick={activerBorne} disabled={!codeInput.trim()}
            style={{ background: '#6B8F71', color: '#FAFCFA', border: 'none', borderRadius: 4, padding: '16px 0', fontSize: 15, fontWeight: 500, cursor: 'pointer', opacity: !codeInput.trim() ? 0.5 : 1 }}>
            Activer la borne
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'accueil') return (
    <div style={{ ...bg, justifyContent: 'flex-start', paddingTop: 48 }}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Domicile de</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 48, fontWeight: 300, color: '#FAFCFA', letterSpacing: '0.06em' }}>{borneInfo?.seniors?.name}</h1>
        </div>

        <button onClick={ouvrirSos}
          style={{ width: '100%', background: '#C4434F', color: '#fff', border: '3px solid rgba(255,255,255,0.18)', borderRadius: 14, padding: '22px 24px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 32, boxShadow: '0 0 0 6px rgba(196,67,79,0.18)' }}>
          <span style={{ fontSize: 30, fontWeight: 800, letterSpacing: '0.12em' }}>SOS</span>
          <span style={{ fontSize: 18, fontWeight: 500, textAlign: 'left', lineHeight: 1.3 }}>J&apos;ai besoin d&apos;aide<br /><span style={{ fontSize: 13, opacity: 0.8, fontWeight: 400 }}>Prévenir ma famille</span></span>
        </button>

        <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: 14 }}>Qui êtes-vous ?</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {personnes.map(p => (
            <button key={p.id} onClick={() => choisirPersonne(p)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 8, padding: '18px 24px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 44, height: 44, borderRadius: 10, background: p.type === 'famille' ? 'rgba(168,159,204,0.2)' : 'rgba(107,143,113,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {p.type === 'famille' ? '👨‍👩‍👧' : '👤'}
              </div>
              <div>
                <div style={{ fontSize: 17, fontWeight: 500, color: '#FAFCFA' }}>{p.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(154,184,159,0.7)', marginTop: 2 }}>{p.role}</div>
              </div>
            </button>
          ))}

          {!showInvite ? (
            <button onClick={() => setShowInvite(true)}
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.2)', borderRadius: 8, padding: '16px 24px', cursor: 'pointer', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 14, marginTop: 4 }}>
              + Je ne suis pas dans la liste
            </button>
          ) : (
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 8, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Qui êtes-vous ?</p>
              <input placeholder="Votre prénom et nom" value={inviteNom} onChange={e => setInviteNom(e.target.value)}
                style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(107,143,113,0.3)', borderRadius: 4, color: '#FAFCFA', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
              <input placeholder="Votre rôle (ex: Médecin, Ami, Voisin...)" value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && validerInvite()}
                style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(107,143,113,0.3)', borderRadius: 4, color: '#FAFCFA', fontSize: 15, outline: 'none', fontFamily: 'inherit' }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={validerInvite} disabled={!inviteNom.trim()}
                  style={{ flex: 1, background: '#6B8F71', color: '#fff', border: 'none', borderRadius: 4, padding: '12px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer', opacity: !inviteNom.trim() ? 0.5 : 1 }}>
                  Continuer →
                </button>
                <button onClick={() => { setShowInvite(false); setInviteNom(''); setInviteRole('') }}
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 4, padding: '12px 16px', fontSize: 14, cursor: 'pointer' }}>
                  Annuler
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ textAlign: 'center', marginTop: 40, display: 'flex', justifyContent: 'center', gap: 24, flexWrap: 'wrap' }}>
          <button onClick={autoriserCamera} style={{ background: 'none', border: 'none', color: cameraAutorisee === false ? '#e0939a' : 'rgba(255,255,255,0.25)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>
            {cameraAutorisee === true ? '✓ Caméra autorisée' : cameraAutorisee === false ? '📷 Caméra refusée : autorisez-la dans les réglages' : '📷 Autoriser la caméra (visio SOS)'}
          </button>
          <button onClick={resetBorne} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.2)', fontSize: 11, cursor: 'pointer', letterSpacing: '0.1em' }}>
            ⚙ Reconfigurer la borne
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'enregistrement') return (
    <div style={bg}>
      <div style={{ width: '100%', maxWidth: 480, textAlign: 'center' }}>
        <div style={{ marginBottom: 40 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>Note vocale pour {borneInfo?.seniors?.name}</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 300, color: '#FAFCFA' }}>{selectedPersonne?.name}</h2>
          <p style={{ fontSize: 13, color: 'rgba(154,184,159,0.6)' }}>{selectedPersonne?.role}</p>
        </div>

        {messagesBorne && (
          <div style={{ textAlign: 'left', background: 'rgba(127,175,155,0.1)', border: '1px solid rgba(127,175,155,0.35)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
            <span style={{ fontSize: 22 }}>💬</span>
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
              Vous avez <strong style={{ color: '#9AB89F' }}>{messagesBorne.nombre} nouveau{messagesBorne.nombre > 1 ? 'x' : ''} message{messagesBorne.nombre > 1 ? 's' : ''}</strong>
              {messagesBorne.auteurs?.length ? ' de ' + (messagesBorne.auteurs.length > 1 ? messagesBorne.auteurs.slice(0, -1).join(', ') + ' et ' + messagesBorne.auteurs[messagesBorne.auteurs.length - 1] : messagesBorne.auteurs[0]) : ''}.
              <span style={{ color: 'rgba(255,255,255,0.45)' }}> Lisez-les sur votre téléphone ou sur holiris.fr.</span>
            </span>
          </div>
        )}

        {alertesBorne.length > 0 && (
          <div style={{ textAlign: 'left', background: 'rgba(230,185,138,0.08)', border: '1px solid rgba(230,185,138,0.3)', borderRadius: 8, padding: '14px 16px', marginBottom: 32 }}>
            <p style={{ fontSize: 11, color: '#E6B98A', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 10 }}>Points d&apos;attention en cours</p>
            {alertesBorne.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 10, alignItems: 'baseline', marginBottom: 6 }}>
                <span style={{ fontSize: 11, fontWeight: 600, color: a.niveau === 'danger' ? '#E0939A' : '#E6B98A', flexShrink: 0 }}>{a.niveau === 'danger' ? 'Urgent' : 'À surveiller'}</span>
                <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                  {a.message}
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12 }}> · {new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                </span>
              </div>
            ))}
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Pensez à en parler dans votre note si vous avez remarqué quelque chose.</p>
          </div>
        )}

        {error && <div style={{ background: 'rgba(196,122,130,0.15)', border: '1px solid rgba(196,122,130,0.3)', borderRadius: 4, padding: '10px 14px', fontSize: 13, color: '#e0939a', marginBottom: 24 }}>{error}</div>}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
          {!audioBlob ? (
            <>
              <button onClick={recording ? stopRecording : startRecording}
                style={{ width: 140, height: 140, borderRadius: '50%', background: recording ? 'rgba(196,96,106,0.9)' : '#6B8F71', border: recording ? '4px solid rgba(196,96,106,0.4)' : '4px solid rgba(107,143,113,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, boxShadow: recording ? '0 0 0 12px rgba(196,96,106,0.2), 0 0 0 24px rgba(196,96,106,0.1)' : '0 0 0 8px rgba(107,143,113,0.15)', transition: 'all 0.3s ease' }}>
                <span style={{ fontSize: 40 }}>{recording ? '⏹' : '🎙'}</span>
                <span style={{ fontSize: 11, color: '#fff', letterSpacing: '0.1em' }}>{recording ? formatDuration(duration) : 'PARLER'}</span>
              </button>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{recording ? 'Appuyez à nouveau pour arrêter' : 'Appuyez pour commencer'}</p>
            </>
          ) : (
            <>
              <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'rgba(107,143,113,0.2)', border: '2px solid rgba(107,143,113,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30 }}>🎙</div>
              <div>
                <p style={{ color: '#9AB89F', fontSize: 15, marginBottom: 4 }}>Enregistrement prêt · {formatDuration(duration)}</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>L’IA va analyser votre message</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={transcrire} disabled={transcribing}
                  style={{ background: '#6B8F71', color: '#fff', border: 'none', borderRadius: 4, padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                  {transcribing ? '✨ Analyse en cours...' : '✨ Analyser et prévisualiser'}
                </button>
                <button onClick={() => { setAudioBlob(null); setDuration(0) }}
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '14px 20px', fontSize: 15, cursor: 'pointer' }}>
                  Recommencer
                </button>
              </div>
            </>
          )}
        </div>

        <button onClick={() => setStep('accueil')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', fontSize: 13, cursor: 'pointer', marginTop: 40, textDecoration: 'underline' }}>
          ← Retour
        </button>
      </div>
    </div>
  )

  if (step === 'revision') return (
    <div style={bg}>
      <div style={{ width: '100%', maxWidth: 560 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>Note proposée par l’IA</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 28, fontWeight: 300, color: '#FAFCFA' }}>{selectedPersonne?.name}</h2>
        </div>

        {error && <div style={{ background: 'rgba(196,122,130,0.15)', border: '1px solid rgba(196,122,130,0.3)', borderRadius: 4, padding: '10px 14px', fontSize: 13, color: '#e0939a', marginBottom: 16 }}>{error}</div>}

        <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.3)', borderRadius: 8, padding: 24, marginBottom: 20 }}>
          <p style={{ fontSize: 11, color: '#9AB89F', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>✨ Suggestion de l’assistant</p>
          <textarea
            value={noteProposee}
            onChange={e => setNoteProposee(e.target.value)}
            rows={4}
            style={{ width: '100%', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(107,143,113,0.2)', borderRadius: 4, padding: '12px 14px', color: '#FAFCFA', fontSize: 15, lineHeight: 1.6, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 8 }}>Vous pouvez modifier ce texte avant de l’envoyer.</p>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={envoyerNote} disabled={sending || !noteProposee.trim()}
            style={{ flex: 1, background: '#6B8F71', color: '#fff', border: 'none', borderRadius: 4, padding: '16px 0', fontSize: 15, fontWeight: 500, cursor: 'pointer', opacity: !noteProposee.trim() ? 0.5 : 1 }}>
            {sending ? 'Envoi...' : '✅ Envoyer la note'}
          </button>
          <button onClick={() => { setStep('enregistrement'); setAudioBlob(null); setDuration(0) }}
            style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '16px 20px', fontSize: 15, cursor: 'pointer' }}>
            🎙 Ré-enregistrer
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'medical') return (
    <div style={bg}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#E6B98A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Information médicale</p>
        <p style={{ color: '#FAFCFA', fontSize: 17, lineHeight: 1.6, marginBottom: 12 }}>
          Votre note contient une information médicale. Pour protéger la personne suivie,
          {signalement?.notePartielle ? ' cette partie n’a pas été enregistrée (le reste de la note a bien été publié).' : ' elle n’a pas été enregistrée.'}
        </p>
        <p style={{ color: '#9AB89F', fontSize: 15, lineHeight: 1.6, marginBottom: 32 }}>
          Cette information est-elle essentielle ? Si oui, la personne de confiance vous contactera.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button onClick={() => repondreMedical(true)} disabled={sending}
            style={{ flex: 1, background: '#6B8F71', color: '#fff', border: 'none', borderRadius: 4, padding: '18px 0', fontSize: 16, fontWeight: 500, cursor: 'pointer' }}>
            Oui, essentielle
          </button>
          <button onClick={() => repondreMedical(false)} disabled={sending}
            style={{ flex: 1, background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.7)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '18px 0', fontSize: 16, cursor: 'pointer' }}>
            Non
          </button>
        </div>
      </div>
    </div>
  )

  if (step === 'sos' || step === 'sos-envoi') return (
    <div style={{ ...bg, background: '#2A1416' }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '0.14em', color: '#F0A0A8', marginBottom: 16 }}>SOS</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 38, fontWeight: 400, color: '#FAFCFA', lineHeight: 1.2, marginBottom: 14 }}>
          Voulez-vous prévenir votre famille ?
        </h2>
        {step === 'sos' ? (
          <>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', marginBottom: 36 }}>
              Sans réponse, l&apos;alerte sera envoyée dans <strong style={{ color: '#fff', fontSize: 22 }}>{sosCompte}</strong> seconde{sosCompte > 1 ? 's' : ''}.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <button onClick={() => envoyerSos(false)}
                style={{ background: '#C4434F', color: '#fff', border: 'none', borderRadius: 14, padding: '26px 0', fontSize: 22, fontWeight: 600, cursor: 'pointer' }}>
                Oui, prévenir ma famille
              </button>
              <button onClick={() => setStep('accueil')}
                style={{ background: 'rgba(255,255,255,0.1)', color: '#fff', border: '2px solid rgba(255,255,255,0.25)', borderRadius: 14, padding: '22px 0', fontSize: 20, cursor: 'pointer' }}>
                Non, annuler
              </button>
            </div>
          </>
        ) : (
          <p style={{ fontSize: 18, color: 'rgba(255,255,255,0.8)', marginTop: 24 }}>Envoi de l&apos;alerte…</p>
        )}
        <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.55)', marginTop: 36 }}>Urgence vitale : appelez le <strong style={{ color: '#fff' }}>15</strong> ou le <strong style={{ color: '#fff' }}>112</strong></p>
      </div>
    </div>
  )

  if (step === 'sos-envoye') return (
    <div style={{ ...bg, background: famillePrevenue ? '#1E2820' : '#2A1416' }}>
      <div style={{ width: '100%', maxWidth: 560, textAlign: 'center' }}>
        {famillePrevenue ? (
          <>
            <div style={{ fontSize: 64, marginBottom: 20 }}>✅</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 38, fontWeight: 400, color: '#FAFCFA', marginBottom: 14 }}>{sosResultat.dejaPrevenus ? 'Votre famille vient d\'être prévenue' : 'Votre famille a été prévenue'}</h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>Restez au calme, quelqu&apos;un va vous rappeler ou venir vous voir.</p>
          </>
        ) : sosResultat?.success ? (
          <>
            <div style={{ fontSize: 64, marginBottom: 20 }}>⚠️</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 400, color: '#FAFCFA', marginBottom: 14 }}>Aucun proche n&apos;a pu être prévenu</h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>Aucun email ni numéro n&apos;est renseigné pour la famille. Appelez un proche directement.</p>
          </>
        ) : (
          <>
            <div style={{ fontSize: 64, marginBottom: 20 }}>⚠️</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 400, color: '#FAFCFA', marginBottom: 14 }}>L&apos;alerte n&apos;a pas pu être envoyée</h2>
            <p style={{ fontSize: 17, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, marginBottom: 24 }}>Vérifiez que la borne est connectée à Internet, ou appelez un proche.</p>
            <button onClick={() => { sosEnvoiRef.current = false; envoyerSos(false) }}
              style={{ background: '#C4434F', color: '#fff', border: 'none', borderRadius: 14, padding: '20px 40px', fontSize: 19, fontWeight: 600, cursor: 'pointer' }}>
              Réessayer
            </button>
          </>
        )}
        <div style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 12, padding: '18px 20px', marginTop: 32 }}>
          <p style={{ fontSize: 16, color: '#fff', lineHeight: 1.6 }}>En cas d&apos;urgence vitale, appelez le <strong style={{ fontSize: 22 }}>15</strong> (SAMU) ou le <strong style={{ fontSize: 22 }}>112</strong>.</p>
        </div>
        <button onClick={() => setStep('accueil')} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', fontSize: 15, cursor: 'pointer', marginTop: 32, textDecoration: 'underline' }}>
          ← Retour à l&apos;accueil
        </button>
      </div>
    </div>
  )

  if (step === 'confirmation') return (
    <div style={bg}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>✅</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 300, color: '#FAFCFA', marginBottom: 12 }}>Note enregistrée</h2>
        <p style={{ color: '#9AB89F', fontSize: 15 }}>Merci {selectedPersonne?.name}</p>
        {reponseMedicale && <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, marginTop: 12, maxWidth: 420 }}>{reponseMedicale}</p>}
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 8 }}>Retour à l’accueil dans quelques secondes...</p>
      </div>
    </div>
  )

  return null
}
