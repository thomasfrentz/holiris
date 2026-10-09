'use client'
import { useState, useEffect, useRef } from 'react'
import { demarrerVisio } from '../lib/visioRtc'

// Charte Holiris, version douce et chaleureuse pour la tablette du domicile
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
  ambreClair: '#FDF3E7',
  rouge: '#C4434F',
  roseClair: '#FBEDEE',
}
const TITRE = 'var(--font-display), "Cormorant Garamond", Georgia, serif'
const TEXTE = 'var(--font-body), "DM Sans", system-ui, sans-serif'
const OMBRE = '0 10px 30px rgba(74, 60, 40, 0.08)'
const INACTIVITE = 4 * 60 * 1000

function Logo({ taille = 120 }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 64 64" fill="none" aria-hidden="true">
      <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke={C.sauge} strokeWidth="1.6" />
      <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke={C.lilas} strokeWidth="1.6" />
      <circle cx="32" cy="32" r="5" fill={C.sauge} />
      <circle cx="32" cy="32" r="2.2" fill="#fff" />
    </svg>
  )
}

// Mémoire de la tablette : certains navigateurs « kiosque » bloquent le stockage local, ce qui ne doit
// jamais bloquer la borne. Le code peut aussi être donné dans l'adresse : holiris.fr/borne?code=BORNE-XXXXX
const memoire = {
  lire: cle => { try { return window.localStorage.getItem(cle) } catch { return null } },
  ecrire: (cle, valeur) => { try { window.localStorage.setItem(cle, valeur) } catch {} },
  effacer: cle => { try { window.localStorage.removeItem(cle) } catch {} },
}

const initiales = nom => nom.split(' ').filter(Boolean).slice(0, 2).map(m => m[0]).join('').toUpperCase()
const listePrenoms = l => l.length > 1 ? l.slice(0, -1).join(', ') + ' et ' + l[l.length - 1] : l[0] || ''

export default function Borne() {
  const [step, setStep] = useState('loading')
  const [codeInput, setCodeInput] = useState('')
  const [borneInfo, setBorneInfo] = useState(null)
  const [personnes, setPersonnes] = useState([])
  const [selectedPersonne, setSelectedPersonne] = useState(null)
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(0)
  const [showInvite, setShowInvite] = useState(false)
  const [inviteNom, setInviteNom] = useState('')
  const [inviteRole, setInviteRole] = useState('')
  const [noteProposee, setNoteProposee] = useState('')
  const [signalement, setSignalement] = useState(null) // { id, notePartielle }
  const [reponseMedicale, setReponseMedicale] = useState('')
  const [alertesAccueil, setAlertesAccueil] = useState([])
  const [messagesAccueil, setMessagesAccueil] = useState([]) // [{ prenom, nombre }]
  const [messagesJour, setMessagesJour] = useState([]) // messages adressés aux intervenants attendus aujourd'hui
  const [messageOuvert, setMessageOuvert] = useState(null)
  const [messagesSenior, setMessagesSenior] = useState([]) // messages des proches pour le senior
  const [messageSeniorOuvert, setMessageSeniorOuvert] = useState(null)
  const [lecture, setLecture] = useState(false) // message en cours de lecture à voix haute ou d'écoute
  const audioMessageRef = useRef(null)
  const sonRef = useRef(null) // contexte audio du carillon
  const messagesSeniorChargesRef = useRef(false) // le suivi du carillon attend la première liste reçue
  // Notifications retirées de l'accueil, sur cette tablette seulement (le tableau de bord n'est pas touché)
  const [masques, setMasques] = useState(() => {
    try { return JSON.parse(memoire.lire('holiris_borne_masques')) || { alertes: [], messages: '' } }
    catch { return { alertes: [], messages: '' } }
  })
  const [messagesBorne, setMessagesBorne] = useState(null) // { nombre, auteurs } de la personne qui enregistre
  const [maintenant, setMaintenant] = useState(() => new Date())
  const [sosCompte, setSosCompte] = useState(0)
  const [sosResultat, setSosResultat] = useState(null) // { success, emails, whatsapp, dejaPrevenus }
  const [surveillanceVisio, setSurveillanceVisio] = useState(false) // SOS récent : un proche peut demander la visio
  const [visio, setVisio] = useState(null) // { canal, prenom, etat }
  const [cameraAutorisee, setCameraAutorisee] = useState(null) // null | true | false
  const [documents, setDocuments] = useState([]) // documents à signer par le senior

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const sosEnvoiRef = useRef(false)
  const visioRtcRef = useRef(null)
  const fluxVisioRef = useRef(null)
  const apercuRef = useRef(null)
  const sonDistantRef = useRef(null)
  const finVisioRef = useRef(null)
  const derniereActionRef = useRef(0)
  const versionRef = useRef(null)
  const [miseAJour, setMiseAJour] = useState(false)

  useEffect(() => {
    window.__holirisBorne = true // la page a bien démarré (voir le diagnostic de layout.js)
    const codeAdresse = new URLSearchParams(window.location.search).get('code')
    if (codeAdresse) memoire.ecrire('holiris_borne_code', codeAdresse.trim().toUpperCase())
    loadBorne(codeAdresse || memoire.lire('holiris_borne_code'))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chargement unique au montage
  }, [])

  async function loadBorne(code) {
    if (!code) {
      setStep('setup')
      return
    }
    setStep('loading')
    let reponse = null
    try {
      const res = await fetch('/api/borne?code=' + encodeURIComponent(code.toUpperCase()))
      reponse = { ok: res.ok, data: res.ok ? await res.json() : {} }
    } catch {
      // Pas de connexion : on réessaie dans 15 secondes plutôt que de rester bloqué
      setError('Connexion à Internet impossible. Nouvel essai dans quelques secondes…')
      setStep('setup')
      setTimeout(() => { setError(''); loadBorne(code) }, 15000)
      return
    }
    const { borne, personnes: liste } = reponse.data

    if (!borne) {
      memoire.effacer('holiris_borne_code')
      setStep('setup')
      setError('Code borne invalide.')
      return
    }

    setBorneInfo(borne)
    setPersonnes(liste)
    setStep('accueil')
    chargerDocuments(borne.code)
    // Retour de la page de signature : afficher la liste des documents
    if (new URLSearchParams(window.location.search).get('documents')) { setStep('documents'); window.history.replaceState(null, '', '/borne') }
    // Borne rechargée juste après un SOS : reprendre la surveillance des demandes de visio
    fetch('/api/borne-visio?code=' + encodeURIComponent(borne.code))
      .then(r => r.ok ? r.json() : null).then(d => { if (d?.sosRecent) setSurveillanceVisio(true) }).catch(() => {})
  }

  async function activerBorne() {
    if (!codeInput.trim()) return
    setError('')
    const code = codeInput.trim().toUpperCase()
    memoire.ecrire('holiris_borne_code', code)
    await loadBorne(code)
    // Configuration : proposer les documents encore à signer
    const d = await chargerDocuments(code)
    if (d?.aSigner) setStep('documents')
  }

  async function chargerDocuments(code) {
    try {
      const r = await fetch('/api/borne-documents?code=' + encodeURIComponent(code))
      const d = r.ok ? await r.json() : null
      if (d) setDocuments(d.documents)
      return d
    } catch { return null }
  }

  async function signerDocument(type) {
    setError('')
    const r = await (await fetch('/api/borne-documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: borneInfo.code, type }) })).json().catch(() => ({}))
    if (r.success) window.location.href = r.lien
    else setError(r.error || 'Le document n\'a pas pu être préparé.')
  }

  // ── Page d'accueil permanente : écran toujours allumé, horloge, alertes et messages ──

  useEffect(() => {
    let verrou = null
    const demander = () => navigator.wakeLock?.request('screen').then(v => { verrou = v }).catch(() => {})
    const auRetour = () => { if (document.visibilityState === 'visible') demander() }
    demander()
    document.addEventListener('visibilitychange', auRetour)
    return () => { document.removeEventListener('visibilitychange', auRetour); verrou?.release().catch(() => {}) }
  }, [])

  useEffect(() => {
    const t = setInterval(() => setMaintenant(new Date()), 30000)
    return () => clearInterval(t)
  }, [])

  // Alertes en cours et messages non lus, actualisés toutes les 2 minutes ; liste des personnes toutes les 10 minutes
  useEffect(() => {
    if (step !== 'accueil' || !borneInfo?.code) return
    const code = encodeURIComponent(borneInfo.code)
    const actualiser = () => {
      fetch('/api/borne?alertes=1&code=' + code).then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setAlertesAccueil(d.alertes || []) }).catch(() => {})
      fetch('/api/borne?nonlus=tous&code=' + code).then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setMessagesAccueil(d.messages || []) }).catch(() => {})
      fetch('/api/borne-messages?code=' + code).then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setMessagesJour(d.messages || []) }).catch(() => {})
      fetch('/api/messages-senior?code=' + code).then(r => r.ok ? r.json() : null)
        .then(d => { if (d) { messagesSeniorChargesRef.current = true; setMessagesSenior(d.messages || []) } }).catch(() => {})
    }
    const personnesAJour = () => fetch('/api/borne?code=' + code).then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.personnes) setPersonnes(d.personnes) }).catch(() => {})
    actualiser()
    const t1 = setInterval(actualiser, 2 * 60 * 1000)
    const t2 = setInterval(personnesAJour, 10 * 60 * 1000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [step, borneInfo])

  // Mise à jour automatique : nouvelle version en ligne → rechargement, seulement sur l'accueil,
  // sans visio en cours et après une minute sans que personne ne touche l'écran
  useEffect(() => {
    const verifier = () => fetch('/api/version', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
      if (!d?.version) return
      if (!versionRef.current) versionRef.current = d.version
      else if (d.version !== versionRef.current) setMiseAJour(true)
    }).catch(() => {})
    verifier()
    const t = setInterval(verifier, 5 * 60 * 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!miseAJour || step !== 'accueil' || visio) return
    const t = setInterval(() => {
      if (Date.now() - derniereActionRef.current > 60 * 1000) window.location.reload()
    }, 15000)
    return () => clearInterval(t)
  }, [miseAJour, step, visio])

  // « Lu » sur un message adressé à un intervenant : il disparaît de la borne
  async function marquerMessageLu(m) {
    setMessageOuvert(null)
    setMessagesJour(prev => prev.filter(x => x.id !== m.id))
    fetch('/api/borne-messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code: borneInfo?.code, id: m.id }) }).catch(() => {})
  }

  // ── Carillon : un message d'un proche arrive ──
  // Trois notes douces à l'arrivée, puis un rappel toutes les 30 minutes tant qu'il n'est pas lu (3 au plus),
  // jamais entre 21 h et 8 h. Les navigateurs n'autorisent le son qu'après un premier toucher de l'écran
  // (ou si le navigateur kiosque autorise la lecture automatique).
  function debloquerSon() {
    try {
      if (!sonRef.current) sonRef.current = new (window.AudioContext || window.webkitAudioContext)()
      if (sonRef.current.state === 'suspended') sonRef.current.resume().catch(() => {})
    } catch {}
  }
  function carillon() {
    debloquerSon()
    const ctx = sonRef.current
    if (!ctx || ctx.state !== 'running') return false
    const debut = ctx.currentTime + 0.05
    ;[523.25, 659.25, 783.99].forEach((frequence, i) => {
      const osc = ctx.createOscillator()
      const volume = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequence
      const t = debut + i * 0.38
      volume.gain.setValueAtTime(0, t)
      volume.gain.linearRampToValueAtTime(0.22, t + 0.03)
      volume.gain.exponentialRampToValueAtTime(0.001, t + 1.4)
      osc.connect(volume).connect(ctx.destination)
      osc.start(t)
      osc.stop(t + 1.5)
    })
    return true
  }

  useEffect(() => {
    const verifier = () => {
      const heure = new Date().getHours()
      if (heure >= 21 || heure < 8) return
      if (step !== 'accueil' || visio || messageSeniorOuvert || !messagesSeniorChargesRef.current) return
      let suivi = {}
      try { suivi = JSON.parse(memoire.lire('holiris_borne_carillon')) || {} } catch {}
      const ids = new Set(messagesSenior.map(m => String(m.id)))
      for (const id of Object.keys(suivi)) if (!ids.has(id)) delete suivi[id] // messages lus ou retirés
      const maintenant = Date.now()
      const aSonner = messagesSenior.filter(m => {
        const s = suivi[m.id]
        return !s || (s.rappels < 3 && maintenant - s.derniere >= 30 * 60 * 1000)
      })
      if (aSonner.length && carillon()) {
        for (const m of aSonner) suivi[m.id] = suivi[m.id] ? { derniere: maintenant, rappels: suivi[m.id].rappels + 1 } : { derniere: maintenant, rappels: 0 }
      }
      memoire.ecrire('holiris_borne_carillon', JSON.stringify(suivi))
    }
    verifier()
    const t = setInterval(verifier, 60 * 1000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carillon ne lit que des refs
  }, [messagesSenior, step, visio, messageSeniorOuvert])

  // Message d'un proche pour le senior : lecture à voix haute (écrit) ou écoute (vocal), puis « Lu »
  const syntheseVocale = typeof window !== 'undefined' && 'speechSynthesis' in window
  function arreterLecture() {
    try { window.speechSynthesis?.cancel() } catch {}
    audioMessageRef.current?.pause()
    setLecture(false)
  }
  function ecouterMessage(m) {
    if (lecture) { arreterLecture(); return }
    if (m.type === 'vocal') {
      const audio = audioMessageRef.current
      if (!audio) return
      audio.currentTime = 0
      audio.play().then(() => setLecture(true)).catch(() => setLecture(false))
      return
    }
    try {
      const phrase = new SpeechSynthesisUtterance(m.contenu)
      phrase.lang = 'fr-FR'
      phrase.rate = 0.9
      const voix = window.speechSynthesis.getVoices().find(v => v.lang?.startsWith('fr'))
      if (voix) phrase.voice = voix
      phrase.onend = () => setLecture(false)
      phrase.onerror = () => setLecture(false)
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(phrase)
      setLecture(true)
    } catch { setLecture(false) }
  }
  function fermerMessageSenior(lu) {
    arreterLecture()
    const m = messageSeniorOuvert
    setMessageSeniorOuvert(null)
    if (!lu || !m) return
    setMessagesSenior(prev => prev.filter(x => x.id !== m.id))
    fetch('/api/messages-senior', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'lu', code: borneInfo?.code, id: m.id }) }).catch(() => {})
  }

  function masquer(modif) {
    setMasques(prev => {
      const suivant = { ...prev, ...modif(prev) }
      memoire.ecrire('holiris_borne_masques', JSON.stringify(suivant))
      return suivant
    })
  }
  const masquerAlerte = id => masquer(prev => ({ alertes: [...prev.alertes, id].slice(-100) }))
  // L'annonce revient dès que les messages non lus changent (nouveau message)
  const masquerMessages = () => masquer(() => ({ messages: JSON.stringify(messagesAccueil) }))

  function retourAccueil() {
    if (recording) stopRecording(false)
    setSelectedPersonne(null)
    setAudioBlob(null)
    setNoteProposee('')
    setDuration(0)
    setSignalement(null)
    setReponseMedicale('')
    setShowInvite(false)
    setError('')
    setStep('accueil')
  }

  // Sans action pendant 4 minutes (hors enregistrement), retour à l'accueil
  useEffect(() => {
    if (!['choix', 'enregistrement', 'revision'].includes(step) || recording) return
    derniereActionRef.current = Date.now()
    const t = setInterval(() => {
      if (Date.now() - derniereActionRef.current > INACTIVITE) retourAccueil()
    }, 20000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retourAccueil ne lit que l'état courant
  }, [step, recording])

  // ── Note vocale : choix de la personne, enregistrement, transcription automatique, relecture ──

  function choisirPersonne(p) {
    setSelectedPersonne(p)
    setAudioBlob(null)
    setNoteProposee('')
    setDuration(0)
    setError('')
    setMessagesBorne(null)
    // Messages non lus de cette personne : annonce seulement (nombre et prénoms, jamais le contenu)
    if (p.type !== 'invite' && p.id && borneInfo?.code) {
      fetch('/api/borne?code=' + encodeURIComponent(borneInfo.code) + '&nonlus=' + p.id + '&type=' + p.type)
        .then(res => res.ok ? res.json() : null)
        .then(data => setMessagesBorne(data?.nombre ? data : null))
        .catch(() => {})
    }
    setStep('enregistrement')
  }

  function validerInvite() {
    if (!inviteNom.trim()) return
    choisirPersonne({ id: null, name: inviteNom.trim(), role: inviteRole.trim() || 'Visiteur', type: 'invite' })
    setShowInvite(false)
    setInviteNom('')
    setInviteRole('')
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
      setError("Impossible d'accéder au microphone.")
    }
  }

  // L'arrêt lance directement la transcription (sauf en quittant la page)
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
      const res = await fetch('/api/borne-transcribe', { method: 'POST', body: formData })
      const result = await res.json()
      if (result.success) {
        setNoteProposee(result.note)
        setStep('revision')
        return
      }
      if (result.rienEntendu) {
        // Rien à réessayer avec ce son : on repart sur un nouvel enregistrement
        setAudioBlob(null)
        setError(result.error)
      } else setError('La transcription n\'a pas fonctionné. Vous pouvez réessayer ou réenregistrer.')
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
          seniorId: borneInfo.senior_id,
          code: borneInfo.code
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
        setError("L'envoi n'a pas fonctionné. Réessayez dans un instant.")
      }
    } catch {
      setError('Pas de connexion Internet. Réessayez dans un instant.')
    }
    setSending(false)
  }

  function terminer() {
    setStep('confirmation')
    setTimeout(retourAccueil, 4000)
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

  // ── SOS : confirmation avec compte à rebours ; sans réponse, l'alerte part automatiquement ──
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

  // ── Visio demandée par un proche (lien reçu après le SOS) : vérification toutes les 3 secondes ──
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
    memoire.effacer('holiris_borne_code')
    setBorneInfo(null)
    setPersonnes([])
    setSelectedPersonne(null)
    setStep('setup')
  }

  // ── Mise en forme ──

  const page = (contenu, { fond = C.fond, haut = false } = {}) => (
    <div onPointerDown={() => { derniereActionRef.current = Date.now(); debloquerSon() }}
      style={{ minHeight: '100dvh', background: fond, fontFamily: TEXTE, color: C.encre, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: haut ? 'flex-start' : 'center', padding: '28px 24px', boxSizing: 'border-box' }}>
      <style>{`
        @keyframes holiris-pulse { 0% { box-shadow: 0 0 0 0 rgba(196,67,79,0.35) } 70% { box-shadow: 0 0 0 26px rgba(196,67,79,0) } 100% { box-shadow: 0 0 0 0 rgba(196,67,79,0) } }
        @keyframes holiris-tourne { to { transform: rotate(360deg) } }
        .borne-bouton { transition: transform 0.15s ease, box-shadow 0.15s ease; -webkit-tap-highlight-color: transparent; }
        .borne-bouton:active { transform: scale(0.98); }
      `}</style>
      {contenu}
    </div>
  )
  const bouton = (fond, couleur, extra = {}) => ({ background: fond, color: couleur, border: 'none', borderRadius: 20, padding: '20px 28px', fontSize: 19, fontWeight: 500, cursor: 'pointer', fontFamily: TEXTE, ...extra })
  const retour = (libelle, action) => (
    <button onClick={action} className="borne-bouton"
      style={{ alignSelf: 'flex-start', background: C.carte, border: `1px solid ${C.bord}`, borderRadius: 999, padding: '10px 18px', fontSize: 15, color: C.gris, cursor: 'pointer', fontFamily: TEXTE, marginBottom: 20 }}>
      ← {libelle}
    </button>
  )
  const erreurBloc = error && (
    <div style={{ background: C.roseClair, border: '1px solid #F0CDD1', borderRadius: 14, padding: '12px 16px', fontSize: 15, color: '#8E2F38', marginBottom: 20, textAlign: 'left' }}>{error}</div>
  )
  const urgence = (
    <p style={{ fontSize: 15, color: C.gris, marginTop: 28, textAlign: 'center' }}>
      Urgence vitale : appelez le <strong style={{ color: C.encre }}>15</strong> ou le <strong style={{ color: C.encre }}>112</strong>
    </p>
  )

  // La visio passe devant tous les autres écrans, avec un bandeau visible en permanence
  if (visio) return page(
    <div style={{ width: '100%', maxWidth: 640, textAlign: 'center' }}>
      <div style={{ background: C.rouge, borderRadius: 18, padding: '16px 20px', color: '#fff', fontSize: 20, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <span style={{ width: 14, height: 14, borderRadius: '50%', background: '#fff', animation: 'holiris-pulse 1.8s infinite' }} />
        Caméra et micro activés
      </div>
      <p style={{ fontFamily: TITRE, fontSize: 32, margin: '24px 0 6px' }}>
        {visio.etat === 'en-direct' ? <><strong style={{ fontWeight: 600 }}>{visio.prenom}</strong> vous voit et vous entend</> : <>Connexion avec <strong style={{ fontWeight: 600 }}>{visio.prenom}</strong>…</>}
      </p>
      <p style={{ fontSize: 17, color: C.gris, marginBottom: 22 }}>Vous pouvez lui parler normalement.</p>
      <video ref={apercuRef} autoPlay playsInline muted style={{ width: 300, aspectRatio: '4 / 3', objectFit: 'cover', borderRadius: 18, background: '#000', transform: 'scaleX(-1)', boxShadow: OMBRE }} />
      <audio ref={sonDistantRef} autoPlay />
      <button onClick={() => finVisio(true)} className="borne-bouton"
        style={bouton(C.carte, C.rouge, { display: 'block', width: '100%', marginTop: 26, border: `2px solid ${C.rouge}`, fontSize: 21, fontWeight: 600 })}>
        Arrêter la caméra
      </button>
    </div>,
    { haut: true }
  )

  if (step === 'loading') return page(<p id="borne-chargement" style={{ color: C.grisClair, fontSize: 16 }}>Chargement…</p>)

  if (step === 'setup') return page(
    <div style={{ background: C.carte, borderRadius: 28, padding: '44px 40px', width: '100%', maxWidth: 480, boxShadow: OMBRE, textAlign: 'center' }}>
      <Logo taille={64} />
      <h1 style={{ fontFamily: TITRE, fontSize: 40, fontWeight: 500, letterSpacing: '0.04em', margin: '10px 0 4px' }}>Holiris</h1>
      <p style={{ fontSize: 12, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 30 }}>Configuration de la borne</p>
      {erreurBloc}
      <input type="text" placeholder="BORNE-XXXXX" value={codeInput}
        onChange={e => setCodeInput(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === 'Enter' && activerBorne()}
        style={{ width: '100%', padding: '16px', background: '#FAFCFB', border: `1px solid ${C.bord}`, borderRadius: 14, color: C.encre, fontSize: 20, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace', letterSpacing: '0.12em', textAlign: 'center', marginBottom: 14 }} />
      <button onClick={activerBorne} disabled={!codeInput.trim()} className="borne-bouton"
        style={bouton(C.sauge, '#fff', { width: '100%', opacity: codeInput.trim() ? 1 : 0.5 })}>
        Activer la borne
      </button>
    </div>
  )

  // Message d'un proche pour le senior, ouvert depuis l'accueil
  if (step === 'accueil' && messageSeniorOuvert) {
    const m = messageSeniorOuvert
    const prenom = m.auteur_nom?.split(' ')[0]
    return page(
      <div style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column' }}>
        {retour('Accueil', () => fermerMessageSenior(false))}
        <p style={{ fontSize: 13, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' }}>
          {new Date(m.created_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
        </p>
        <h2 style={{ fontFamily: TITRE, fontSize: 44, fontWeight: 500, textAlign: 'center', margin: '6px 0 22px' }}>Message de {prenom}</h2>
        {m.type === 'vocal' ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, marginBottom: 26 }}>
            <audio ref={audioMessageRef} src={m.audio_url || undefined} preload="auto" onEnded={() => setLecture(false)} onPause={() => setLecture(false)} />
            <button onClick={() => ecouterMessage(m)} className="borne-bouton" disabled={!m.audio_url}
              style={{ width: 190, height: 190, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff',
                background: lecture ? C.lilasFonce : `linear-gradient(145deg, ${C.lilas}, ${C.lilasFonce})`, boxShadow: '0 16px 36px rgba(139,111,170,0.35)' }}>
              <span style={{ fontSize: 60, lineHeight: 1 }}>{lecture ? '❚❚' : '▶'}</span>
              <span style={{ fontSize: 17, fontWeight: 600, letterSpacing: '0.06em' }}>{lecture ? 'PAUSE' : 'ÉCOUTER'}</span>
            </button>
            <p style={{ fontSize: 20, color: C.gris, textAlign: 'center' }}>
              {m.audio_url ? `${prenom} vous a laissé un message vocal${m.duree ? ` (${m.duree < 60 ? m.duree + ' secondes' : Math.round(m.duree / 60) + ' min'})` : ''}.` : 'Le message vocal n’a pas pu être chargé.'}
            </p>
          </div>
        ) : (
          <div style={{ background: C.carte, borderRadius: 24, padding: '28px 30px', boxShadow: OMBRE, marginBottom: 20 }}>
            <p style={{ fontSize: 28, lineHeight: 1.55, whiteSpace: 'pre-wrap', margin: 0 }}>{m.contenu}</p>
            <p style={{ fontSize: 20, color: C.gris, marginTop: 18, textAlign: 'right' }}>— {prenom}</p>
          </div>
        )}
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
          {m.type !== 'vocal' && syntheseVocale && (
            <button onClick={() => ecouterMessage(m)} className="borne-bouton"
              style={bouton(C.carte, C.lilasFonce, { flex: '1 1 220px', border: `2px solid ${C.lilas}`, fontSize: 21 })}>
              {lecture ? '■ Arrêter' : '🔊 Écouter'}
            </button>
          )}
          <button onClick={() => fermerMessageSenior(true)} className="borne-bouton"
            style={bouton(C.sauge, '#fff', { flex: '2 1 260px', fontSize: 22, padding: '22px', boxShadow: '0 12px 28px rgba(74,136,112,0.28)' })}>
            ✓ Lu
          </button>
        </div>
      </div>
    )
  }

  // Message adressé à un intervenant, ouvert depuis l'accueil
  if (step === 'accueil' && messageOuvert) return page(
    <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column' }}>
      {retour('Accueil', () => setMessageOuvert(null))}
      <p style={{ fontSize: 13, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' }}>Message</p>
      <h2 style={{ fontFamily: TITRE, fontSize: 40, fontWeight: 500, textAlign: 'center', margin: '6px 0 20px' }}>Pour {messageOuvert.destinataire_nom}</h2>
      <div style={{ background: C.carte, borderRadius: 24, padding: '26px 28px', boxShadow: OMBRE, marginBottom: 22 }}>
        <p style={{ fontSize: 22, lineHeight: 1.6, whiteSpace: 'pre-wrap', margin: 0 }}>{messageOuvert.contenu}</p>
        <p style={{ fontSize: 17, color: C.gris, marginTop: 18, textAlign: 'right' }}>
          — {messageOuvert.auteur_nom}{messageOuvert.auteur_role ? `, ${messageOuvert.auteur_role}` : ''}
          <span style={{ display: 'block', fontSize: 14, color: C.grisClair, marginTop: 2 }}>
            {new Date(messageOuvert.created_at).toLocaleString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}
          </span>
        </p>
      </div>
      <button onClick={() => marquerMessageLu(messageOuvert)} className="borne-bouton"
        style={bouton(C.sauge, '#fff', { fontSize: 21, padding: '22px', boxShadow: '0 12px 28px rgba(74,136,112,0.28)' })}>
        ✓ Lu
      </button>
    </div>
  )

  if (step === 'accueil') {
    const nonMasquees = alertesAccueil.filter(a => !masques.alertes.includes(a.id))
    const urgentes = nonMasquees.filter(a => a.niveau === 'danger')
    const autres = nonMasquees.filter(a => a.niveau !== 'danger')
    const alertesVisibles = [...urgentes, ...autres].slice(0, 3)
    const messagesVisibles = messagesAccueil.length > 0 && JSON.stringify(messagesAccueil) !== masques.messages
    const aDesMessagesSenior = messagesSenior.length > 0
    return page(
      <div style={{ width: '100%', maxWidth: 820, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
        <div style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', color: C.gris, fontSize: 16 }}>
          <span>Chez <strong style={{ color: C.encre, fontWeight: 500 }}>{borneInfo?.seniors?.name}</strong></span>
          <span style={{ textAlign: 'right' }}>
            <strong style={{ fontFamily: TITRE, fontSize: 30, fontWeight: 500, color: C.encre }}>{maintenant.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</strong>
            <span style={{ display: 'block', fontSize: 14 }}>{maintenant.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, l => l.toUpperCase())}</span>
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '18px 0' }}>
          <Logo taille={alertesVisibles.length || messagesVisibles || messagesJour.length || aDesMessagesSenior ? 96 : 140} />
          <h1 style={{ fontFamily: TITRE, fontSize: 72, fontWeight: 500, letterSpacing: '0.05em', lineHeight: 1, margin: '14px 0 10px' }}>Holiris</h1>
          <p style={{ fontFamily: TITRE, fontStyle: 'italic', fontSize: 26, color: C.saugeFonce }}>Prendre soin de ceux qui nous sont chers</p>
        </div>

        {(alertesVisibles.length > 0 || messagesVisibles || messagesJour.length > 0 || aDesMessagesSenior) && (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
            {messagesSenior.map(m => (
              <button key={'s' + m.id} onClick={() => setMessageSeniorOuvert(m)} className="borne-bouton"
                style={{ display: 'flex', gap: 16, alignItems: 'center', background: C.lilasClair, border: `2px solid ${C.lilas}`, borderRadius: 18, padding: '18px 20px', textAlign: 'left', cursor: 'pointer', fontFamily: TEXTE, color: C.encre }}>
                <span style={{ fontSize: 34 }}>{m.type === 'vocal' ? '🎧' : '💌'}</span>
                <span style={{ flex: 1 }}>
                  <span style={{ display: 'block', fontSize: 23, fontWeight: 600 }}>Message de {m.auteur_nom?.split(' ')[0]}</span>
                  <span style={{ fontSize: 16, color: C.gris }}>{m.type === 'vocal' ? 'Message vocal à écouter' : 'Touchez pour le lire'}</span>
                </span>
                <span style={{ fontSize: 18, color: C.lilasFonce, fontWeight: 600 }}>{m.type === 'vocal' ? 'Écouter ›' : 'Lire ›'}</span>
              </button>
            ))}
            {messagesJour.map(m => (
              <button key={m.id} onClick={() => setMessageOuvert(m)} className="borne-bouton"
                style={{ display: 'flex', gap: 14, alignItems: 'center', background: '#fff', border: `2px solid ${C.lilas}`, borderRadius: 16, padding: '14px 18px', textAlign: 'left', cursor: 'pointer', fontFamily: TEXTE, color: C.encre }}>
                <span style={{ fontSize: 26 }}>✉️</span>
                <span style={{ fontSize: 19, fontWeight: 600, flex: 1 }}>Message pour {m.destinataire_nom?.split(' ')[0]}</span>
                <span style={{ fontSize: 15, color: C.lilasFonce, fontWeight: 500 }}>Lire ›</span>
              </button>
            ))}
            {alertesVisibles.map(a => (
              <div key={a.id} style={{ display: 'flex', gap: 14, alignItems: 'center', background: a.niveau === 'danger' ? C.roseClair : C.ambreClair, borderRadius: 16, padding: '14px 18px', textAlign: 'left' }}>
                <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: a.niveau === 'danger' ? C.rouge : C.ambre, flexShrink: 0 }}>
                  {a.niveau === 'danger' ? 'Urgent' : 'À surveiller'}
                </span>
                <span style={{ fontSize: 17, lineHeight: 1.45, flex: 1 }}>{a.message}</span>
                <span style={{ fontSize: 13, color: C.gris, flexShrink: 0 }}>{new Date(a.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}</span>
                <button onClick={() => masquerAlerte(a.id)} aria-label="Retirer cette alerte" className="borne-bouton" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.7)', color: C.gris, fontSize: 22, lineHeight: 1, cursor: 'pointer', fontFamily: TEXTE }}>×</button>
              </div>
            ))}
            {messagesVisibles && (
              <div style={{ display: 'flex', gap: 14, alignItems: 'center', background: C.lilasClair, borderRadius: 16, padding: '14px 18px', textAlign: 'left' }}>
                <span style={{ fontSize: 24 }}>💬</span>
                <span style={{ fontSize: 17, lineHeight: 1.45, flex: 1 }}>
                  Nouveaux messages pour {listePrenoms(messagesAccueil.map(m => `${m.prenom} (${m.nombre})`))}
                  <span style={{ color: C.gris }}> — à lire sur le téléphone ou sur holiris.fr</span>
                </span>
                <button onClick={masquerMessages} aria-label="Retirer l'annonce des messages" className="borne-bouton" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.7)', color: C.gris, fontSize: 22, lineHeight: 1, cursor: 'pointer', fontFamily: TEXTE }}>×</button>
              </div>
            )}
          </div>
        )}

        <div style={{ width: '100%', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <button onClick={() => { setShowInvite(false); setStep('choix') }} className="borne-bouton"
            style={bouton(C.sauge, '#fff', { flex: '2 1 320px', padding: '30px 28px', fontSize: 24, borderRadius: 24, boxShadow: '0 12px 28px rgba(74,136,112,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 })}>
            <span style={{ fontSize: 30 }}>🎙</span> Enregistrer une note
          </button>
          <button onClick={ouvrirSos} className="borne-bouton"
            style={bouton(C.rouge, '#fff', { flex: '1 1 220px', padding: '22px 24px', borderRadius: 24, boxShadow: '0 12px 28px rgba(196,67,79,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14 })}>
            <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '0.1em' }}>SOS</span>
            <span style={{ fontSize: 16, textAlign: 'left', lineHeight: 1.3 }}>J&apos;ai besoin<br />d&apos;aide</span>
          </button>
        </div>

        <div style={{ marginTop: 22, display: 'flex', justifyContent: 'center', gap: 22, flexWrap: 'wrap' }}>
          <button onClick={autoriserCamera} style={{ background: 'none', border: 'none', color: cameraAutorisee === false ? C.rouge : '#B9C4BE', fontSize: 12, cursor: 'pointer', fontFamily: TEXTE }}>
            {cameraAutorisee === true ? '✓ Caméra autorisée' : cameraAutorisee === false ? '📷 Caméra refusée : autorisez-la dans les réglages' : '📷 Autoriser la caméra (visio SOS)'}
          </button>
          {documents.some(d => !d.signe && !d.indisponible) && (
            <button onClick={() => setStep('documents')} style={{ background: 'none', border: 'none', color: C.ambre, fontSize: 12, cursor: 'pointer', fontFamily: TEXTE }}>
              📄 Documents à signer ({documents.filter(d => !d.signe && !d.indisponible).length})
            </button>
          )}
          <button onClick={resetBorne} style={{ background: 'none', border: 'none', color: '#B9C4BE', fontSize: 12, cursor: 'pointer', fontFamily: TEXTE }}>
            ⚙ Reconfigurer la borne
          </button>
        </div>
      </div>,
      { haut: true }
    )
  }

  if (step === 'documents') return page(
    <div style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column' }}>
      <p style={{ fontSize: 13, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' }}>Avant de commencer</p>
      <h2 style={{ fontFamily: TITRE, fontSize: 40, fontWeight: 500, textAlign: 'center', margin: '6px 0 8px' }}>Documents à signer</h2>
      <p style={{ fontSize: 17, color: C.gris, textAlign: 'center', marginBottom: 26, lineHeight: 1.5 }}>
        À lire et signer par {borneInfo?.seniors?.name} ou son représentant légal, directement sur la borne.
      </p>
      {erreurBloc}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {documents.map(d => (
          <div key={d.type} style={{ background: C.carte, borderRadius: 20, padding: '18px 20px', boxShadow: '0 4px 14px rgba(74,60,40,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 26 }}>{d.signe ? '✅' : '📄'}</span>
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 18, fontWeight: 500 }}>{d.titre}</span>
              <span style={{ display: 'block', fontSize: 14, color: d.signe ? C.saugeFonce : C.gris, marginTop: 2 }}>
                {d.signe ? 'Signé' : d.indisponible ? 'La famille doit d’abord choisir la personne de confiance' : 'À signer'}
              </span>
            </span>
            {!d.signe && !d.indisponible && (
              <button onClick={() => signerDocument(d.type)} className="borne-bouton" style={bouton(C.sauge, '#fff', { padding: '14px 22px', fontSize: 17 })}>Lire et signer</button>
            )}
          </div>
        ))}
      </div>
      <button onClick={() => setStep('accueil')} className="borne-bouton"
        style={bouton(C.carte, C.saugeFonce, { marginTop: 24, border: `1.5px solid ${C.sauge}` })}>
        {documents.some(d => !d.signe && !d.indisponible) ? 'Signer plus tard' : 'Terminer'}
      </button>
    </div>
  )

  if (step === 'choix') {
    const groupes = [
      { titre: 'Intervenants', liste: personnes.filter(p => p.type === 'intervenant'), couleur: C.sauge, clair: C.saugeClair },
      { titre: 'Famille', liste: personnes.filter(p => p.type === 'famille'), couleur: C.lilas, clair: C.lilasClair },
    ]
    return page(
      <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column' }}>
        {retour('Accueil', retourAccueil)}
        <h2 style={{ fontFamily: TITRE, fontSize: 42, fontWeight: 500, textAlign: 'center', marginBottom: 6 }}>Qui enregistre la note ?</h2>
        <p style={{ fontSize: 17, color: C.gris, textAlign: 'center', marginBottom: 28 }}>Touchez votre nom</p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 22 }}>
          {groupes.map(g => (
            <div key={g.titre}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: g.couleur, marginBottom: 12, paddingLeft: 4 }}>{g.titre}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {g.liste.length === 0 && <div style={{ fontSize: 15, color: C.grisClair, padding: '14px 4px' }}>Personne pour le moment</div>}
                {g.liste.map(p => (
                  <button key={p.type + p.id} onClick={() => choisirPersonne(p)} className="borne-bouton"
                    style={{ background: C.carte, border: `1px solid ${C.bord}`, borderRadius: 20, padding: '16px 18px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16, boxShadow: '0 4px 14px rgba(74,60,40,0.05)', fontFamily: TEXTE }}>
                    <span style={{ width: 52, height: 52, borderRadius: '50%', background: g.clair, color: g.couleur, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: TITRE, fontSize: 22, fontWeight: 600, flexShrink: 0 }}>{initiales(p.name)}</span>
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontSize: 19, fontWeight: 500, color: C.encre }}>{p.name}</span>
                      {p.role && <span style={{ display: 'block', fontSize: 14, color: C.gris, marginTop: 2 }}>{p.role}</span>}
                    </span>
                    <span style={{ color: C.grisClair, fontSize: 22 }}>›</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 24 }}>
          {!showInvite ? (
            <button onClick={() => setShowInvite(true)} className="borne-bouton"
              style={{ width: '100%', background: 'transparent', border: `1.5px dashed ${C.grisClair}`, borderRadius: 20, padding: '18px', cursor: 'pointer', color: C.gris, fontSize: 17, fontFamily: TEXTE }}>
              + Je ne suis pas dans la liste
            </button>
          ) : (
            <div style={{ background: C.carte, borderRadius: 20, padding: 22, boxShadow: OMBRE, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input placeholder="Votre prénom et nom" value={inviteNom} onChange={e => setInviteNom(e.target.value)}
                style={{ padding: '14px 16px', background: '#FAFCFB', border: `1px solid ${C.bord}`, borderRadius: 14, fontSize: 17, outline: 'none', fontFamily: TEXTE, color: C.encre }} />
              <input placeholder="Votre rôle (ex : voisin, ami, kiné…)" value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && validerInvite()}
                style={{ padding: '14px 16px', background: '#FAFCFB', border: `1px solid ${C.bord}`, borderRadius: 14, fontSize: 17, outline: 'none', fontFamily: TEXTE, color: C.encre }} />
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={validerInvite} disabled={!inviteNom.trim()} className="borne-bouton"
                  style={bouton(C.sauge, '#fff', { flex: 1, padding: '16px', fontSize: 17, opacity: inviteNom.trim() ? 1 : 0.5 })}>Continuer</button>
                <button onClick={() => { setShowInvite(false); setInviteNom(''); setInviteRole('') }} className="borne-bouton"
                  style={bouton('#F2F4F3', C.gris, { padding: '16px 22px', fontSize: 17 })}>Annuler</button>
              </div>
            </div>
          )}
        </div>
      </div>,
      { haut: true }
    )
  }

  if (step === 'enregistrement' || step === 'transcription') return page(
    <div style={{ width: '100%', maxWidth: 620, display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
      {retour('Changer de personne', () => { stopRecording(false); setError(''); setStep('choix') })}
      <p style={{ fontSize: 13, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase' }}>Note pour {borneInfo?.seniors?.name}</p>
      <h2 style={{ fontFamily: TITRE, fontSize: 40, fontWeight: 500, margin: '6px 0 2px' }}>{selectedPersonne?.name}</h2>
      <p style={{ fontSize: 16, color: C.gris, marginBottom: 22 }}>{selectedPersonne?.role}</p>

      {messagesBorne && (
        <div style={{ width: '100%', display: 'flex', gap: 12, alignItems: 'center', background: C.lilasClair, borderRadius: 16, padding: '12px 16px', marginBottom: 20, boxSizing: 'border-box' }}>
          <span style={{ fontSize: 22 }}>💬</span>
          <span style={{ fontSize: 16, lineHeight: 1.5 }}>
            Vous avez <strong>{messagesBorne.nombre} nouveau{messagesBorne.nombre > 1 ? 'x' : ''} message{messagesBorne.nombre > 1 ? 's' : ''}</strong>
            {messagesBorne.auteurs?.length ? ' de ' + listePrenoms(messagesBorne.auteurs) : ''}.
            <span style={{ color: C.gris }}> Lisez-les sur votre téléphone ou sur holiris.fr.</span>
          </span>
        </div>
      )}

      <div style={{ width: '100%' }}>{erreurBloc}</div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 22, paddingBottom: 30 }}>
        {step === 'transcription' ? (
          <>
            <div style={{ width: 84, height: 84, borderRadius: '50%', border: `5px solid ${C.saugeClair}`, borderTopColor: C.sauge, animation: 'holiris-tourne 1s linear infinite' }} />
            <p style={{ fontFamily: TITRE, fontSize: 28 }}>Transcription en cours…</p>
            <p style={{ fontSize: 16, color: C.gris }}>Votre note s&apos;affiche dans quelques secondes.</p>
          </>
        ) : audioBlob && error ? (
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <button onClick={() => transcrire(audioBlob)} className="borne-bouton" style={bouton(C.sauge, '#fff')}>Réessayer</button>
            <button onClick={reenregistrer} className="borne-bouton" style={bouton(C.carte, C.saugeFonce, { border: `1.5px solid ${C.sauge}` })}>Réenregistrer</button>
          </div>
        ) : (
          <>
            <button onClick={recording ? () => stopRecording(true) : startRecording} className="borne-bouton"
              style={{ width: 176, height: 176, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: '#fff',
                background: recording ? C.rouge : `linear-gradient(145deg, ${C.sauge}, ${C.saugeFonce})`,
                boxShadow: recording ? undefined : '0 16px 36px rgba(74,136,112,0.35)',
                animation: recording ? 'holiris-pulse 1.6s infinite' : 'none' }}>
              <span style={{ fontSize: 50 }}>{recording ? '■' : '🎙'}</span>
              <span style={{ fontSize: 15, letterSpacing: '0.12em', fontWeight: 600 }}>{recording ? formatDuration(duration) : 'PARLER'}</span>
            </button>
            <p style={{ fontSize: 18, color: C.gris, textAlign: 'center' }}>
              {recording ? 'Je vous écoute… touchez à nouveau quand vous avez fini' : 'Touchez le micro et racontez comment ça s\'est passé'}
            </p>
          </>
        )}
      </div>
    </div>,
    { haut: true }
  )

  if (step === 'revision') return page(
    <div style={{ width: '100%', maxWidth: 680, display: 'flex', flexDirection: 'column' }}>
      {retour('Accueil', retourAccueil)}
      <p style={{ fontSize: 13, color: C.grisClair, letterSpacing: '0.18em', textTransform: 'uppercase', textAlign: 'center' }}>Note de {selectedPersonne?.name}</p>
      <h2 style={{ fontFamily: TITRE, fontSize: 40, fontWeight: 500, textAlign: 'center', margin: '6px 0 20px' }}>Votre note est prête</h2>
      {erreurBloc}
      <div style={{ background: C.carte, borderRadius: 24, padding: 22, boxShadow: OMBRE, marginBottom: 18 }}>
        <textarea value={noteProposee} onChange={e => setNoteProposee(e.target.value)} rows={5}
          style={{ width: '100%', border: 'none', outline: 'none', resize: 'vertical', fontFamily: TEXTE, fontSize: 20, lineHeight: 1.6, color: C.encre, background: 'transparent', boxSizing: 'border-box' }} />
        <p style={{ fontSize: 14, color: C.grisClair, marginTop: 6 }}>✏️ Touchez le texte pour le corriger si besoin.</p>
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <button onClick={envoyerNote} disabled={sending || !noteProposee.trim()} className="borne-bouton"
          style={bouton(C.sauge, '#fff', { flex: '2 1 260px', fontSize: 21, padding: '22px', boxShadow: '0 12px 28px rgba(74,136,112,0.28)', opacity: noteProposee.trim() ? 1 : 0.5 })}>
          {sending ? 'Envoi…' : 'Envoyer la note'}
        </button>
        <button onClick={reenregistrer} disabled={sending} className="borne-bouton"
          style={bouton(C.carte, C.saugeFonce, { flex: '1 1 200px', border: `1.5px solid ${C.sauge}` })}>
          🎙 Réenregistrer
        </button>
      </div>
    </div>,
    { haut: true }
  )

  if (step === 'medical') return page(
    <div style={{ width: '100%', maxWidth: 600, background: C.carte, borderRadius: 28, padding: '36px 32px', boxShadow: OMBRE, textAlign: 'center' }}>
      <p style={{ fontSize: 13, color: C.ambre, letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 14 }}>Information médicale</p>
      <p style={{ fontSize: 19, lineHeight: 1.6, marginBottom: 12 }}>
        Votre note contient une information médicale. Pour protéger la personne suivie,
        {signalement?.notePartielle ? ' cette partie n’a pas été enregistrée (le reste de la note a bien été publié).' : ' elle n’a pas été enregistrée.'}
      </p>
      <p style={{ fontSize: 17, color: C.saugeFonce, lineHeight: 1.6, marginBottom: 28 }}>
        Cette information est-elle essentielle ? Si oui, la personne de confiance vous contactera.
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button onClick={() => repondreMedical(true)} disabled={sending} className="borne-bouton" style={bouton(C.sauge, '#fff', { flex: 1 })}>Oui, essentielle</button>
        <button onClick={() => repondreMedical(false)} disabled={sending} className="borne-bouton" style={bouton('#F2F4F3', C.gris, { flex: 1 })}>Non</button>
      </div>
    </div>
  )

  if (step === 'confirmation') return page(
    <div style={{ textAlign: 'center' }}>
      <div style={{ width: 110, height: 110, borderRadius: '50%', background: C.saugeClair, color: C.saugeFonce, fontSize: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>✓</div>
      <h2 style={{ fontFamily: TITRE, fontSize: 44, fontWeight: 500, marginBottom: 10 }}>Merci {selectedPersonne?.name?.split(' ')[0]} !</h2>
      <p style={{ fontSize: 19, color: C.saugeFonce }}>Votre note a bien été envoyée à la famille.</p>
      {reponseMedicale && <p style={{ fontSize: 16, color: C.gris, marginTop: 14, maxWidth: 460 }}>{reponseMedicale}</p>}
    </div>
  )

  if (step === 'sos' || step === 'sos-envoi') return page(
    <div style={{ width: '100%', maxWidth: 580, textAlign: 'center' }}>
      <div style={{ display: 'inline-block', background: C.rouge, color: '#fff', borderRadius: 999, padding: '8px 22px', fontSize: 22, fontWeight: 700, letterSpacing: '0.14em', marginBottom: 20 }}>SOS</div>
      <h2 style={{ fontFamily: TITRE, fontSize: 44, fontWeight: 500, lineHeight: 1.15, marginBottom: 14 }}>Voulez-vous prévenir votre famille ?</h2>
      {step === 'sos' ? (
        <>
          <p style={{ fontSize: 19, color: C.gris, marginBottom: 32 }}>
            Sans réponse, l&apos;alerte partira dans <strong style={{ color: C.rouge, fontSize: 26 }}>{sosCompte}</strong> seconde{sosCompte > 1 ? 's' : ''}.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <button onClick={() => envoyerSos(false)} className="borne-bouton"
              style={bouton(C.rouge, '#fff', { padding: '26px', fontSize: 23, fontWeight: 600, borderRadius: 24, boxShadow: '0 12px 28px rgba(196,67,79,0.3)' })}>
              Oui, prévenir ma famille
            </button>
            <button onClick={() => setStep('accueil')} className="borne-bouton"
              style={bouton(C.carte, C.encre, { padding: '22px', fontSize: 21, borderRadius: 24, border: `1.5px solid ${C.bord}` })}>
              Non, annuler
            </button>
          </div>
        </>
      ) : (
        <p style={{ fontSize: 20, color: C.gris, marginTop: 24 }}>Envoi de l&apos;alerte…</p>
      )}
      {urgence}
    </div>,
    { fond: 'linear-gradient(160deg, #FFF8F7 0%, #FBEDEE 100%)' }
  )

  if (step === 'sos-envoye') return page(
    <div style={{ width: '100%', maxWidth: 580, textAlign: 'center' }}>
      {famillePrevenue ? (
        <>
          <div style={{ width: 110, height: 110, borderRadius: '50%', background: C.saugeClair, color: C.saugeFonce, fontSize: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px' }}>✓</div>
          <h2 style={{ fontFamily: TITRE, fontSize: 44, fontWeight: 500, marginBottom: 12 }}>{sosResultat.dejaPrevenus ? 'Votre famille vient d\'être prévenue' : 'Votre famille a été prévenue'}</h2>
          <p style={{ fontSize: 19, color: C.gris, lineHeight: 1.6 }}>Restez au calme, quelqu&apos;un va vous rappeler ou venir vous voir.</p>
        </>
      ) : sosResultat?.success ? (
        <>
          <div style={{ fontSize: 60, marginBottom: 18 }}>⚠️</div>
          <h2 style={{ fontFamily: TITRE, fontSize: 40, fontWeight: 500, marginBottom: 12 }}>Aucun proche n&apos;a pu être prévenu</h2>
          <p style={{ fontSize: 19, color: C.gris, lineHeight: 1.6 }}>Aucun email ni numéro n&apos;est renseigné pour la famille. Appelez un proche directement.</p>
        </>
      ) : (
        <>
          <div style={{ fontSize: 60, marginBottom: 18 }}>⚠️</div>
          <h2 style={{ fontFamily: TITRE, fontSize: 40, fontWeight: 500, marginBottom: 12 }}>L&apos;alerte n&apos;a pas pu être envoyée</h2>
          <p style={{ fontSize: 19, color: C.gris, lineHeight: 1.6, marginBottom: 24 }}>Vérifiez que la borne est connectée à Internet, ou appelez un proche.</p>
          <button onClick={() => { sosEnvoiRef.current = false; envoyerSos(false) }} className="borne-bouton"
            style={bouton(C.rouge, '#fff', { padding: '20px 40px', fontWeight: 600 })}>
            Réessayer
          </button>
        </>
      )}
      <div style={{ background: C.carte, borderRadius: 20, padding: '18px 20px', marginTop: 30, boxShadow: OMBRE }}>
        <p style={{ fontSize: 18, lineHeight: 1.6 }}>En cas d&apos;urgence vitale, appelez le <strong style={{ fontSize: 24, color: C.rouge }}>15</strong> (SAMU) ou le <strong style={{ fontSize: 24, color: C.rouge }}>112</strong>.</p>
      </div>
      <button onClick={() => setStep('accueil')} style={{ background: 'none', border: 'none', color: C.gris, fontSize: 17, cursor: 'pointer', marginTop: 28, textDecoration: 'underline', fontFamily: TEXTE }}>
        ← Retour à l&apos;accueil
      </button>
    </div>,
    { fond: famillePrevenue ? C.fond : 'linear-gradient(160deg, #FFF8F7 0%, #FBEDEE 100%)' }
  )

  return null
}
