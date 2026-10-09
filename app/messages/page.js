'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import AucunDossier from '../components/AucunDossier'
import QuestionMedicale from '../components/QuestionMedicale'
import { useSenior } from '../lib/useSenior'
import { useIntervenant } from '../lib/useIntervenant'

// Messagerie d'un dossier, comme une messagerie classique : une conversation « Tous » (messages à tout le monde)
// et une conversation privée par personne avec qui l'on a échangé ; pour un proche, la conversation avec
// le senior sur sa borne. Les messages privés ne sont lisibles que par l'auteur et le destinataire.
const TOUS = 'tous'
const SENIOR = 'senior'

const lire = cle => { try { return JSON.parse(window.localStorage.getItem(cle)) || {} } catch { return {} } }
const ecrire = (cle, valeur) => { try { window.localStorage.setItem(cle, JSON.stringify(valeur)) } catch {} }

export default function Messages() {
  const famille = useSenior()
  const interv = useIntervenant()
  const router = useRouter()
  const [supabase] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY))
  const [userId, setUserId] = useState(null)
  const [messages, setMessages] = useState([])
  const [chargement, setChargement] = useState(true)
  const [texte, setTexte] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState('')
  const [question, setQuestion] = useState(null)
  const [dictee, setDictee] = useState('') // '' | 'enregistrement' | 'transcription'
  const [personnes, setPersonnes] = useState([]) // { cle, type, id, nom, role, user_id }
  const [conv, setConv] = useState(TOUS) // conversation ouverte
  const [ouverteMobile, setOuverteMobile] = useState(false) // téléphone : la conversation remplace la liste
  const [nouvelle, setNouvelle] = useState(false) // choix d'une personne pour une nouvelle conversation
  const [vues, setVues] = useState({}) // dernière ouverture de chaque conversation (sur cet appareil)
  const [messagesSenior, setMessagesSenior] = useState([]) // mes messages au senior (borne)
  const [vocal, setVocal] = useState(null) // message vocal au senior : { etat: 'enregistrement' | 'pret', blob, url, duree }
  const recorderRef = useRef(null)
  const vocalRef = useRef(null)
  const finRef = useRef(null)

  // Proche, gestionnaire ou admin : dossiers habituels ; intervenant : ceux de son espace
  const estIntervenant = !famille.seniors.length && interv.seniorsList.length > 0
  const seniors = estIntervenant ? interv.seniorsList : famille.seniors
  const seniorId = estIntervenant ? interv.selectedSeniorId : famille.selectedSeniorId
  const senior = seniors.find(s => s.id === seniorId)
  const switchSenior = estIntervenant ? interv.switchSenior : famille.switchSenior
  const pret = !famille.loading && !interv.loading
  const cleVues = userId && seniorId ? `holiris_conversations_${userId}_${seniorId}` : null

  useEffect(() => {
    async function qui() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=' + encodeURIComponent('/messages')); return }
      setUserId(user.id)
    }
    qui()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- identification unique au montage
  }, [])

  // Messages du dossier (les privés des autres sont filtrés par la base) et affichage en direct
  useEffect(() => {
    if (!seniorId) return
    let actif = true
    async function charger() {
      const { data } = await supabase.from('messages').select('*').eq('senior_id', seniorId)
        .order('created_at', { ascending: false }).limit(300)
      if (!actif) return
      setMessages((data || []).reverse())
      setChargement(false)
    }
    charger()
    const canal = supabase.channel('messages-' + seniorId)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `senior_id=eq.${seniorId}` },
        p => setMessages(prev => prev.some(m => m.id === p.new.id) ? prev : [...prev, p.new]))
      .subscribe()
    return () => { actif = false; supabase.removeChannel(canal) }
  }, [seniorId, supabase])

  // Personnes du dossier
  useEffect(() => {
    if (!seniorId) return
    let actif = true
    Promise.all([
      supabase.from('famille').select('id, name, role, user_id').eq('senior_id', seniorId).is('archived_at', null).order('name'),
      supabase.from('intervenants').select('id, name, role, user_id').eq('senior_id', seniorId).is('archived_at', null).order('name'),
    ]).then(([f, i]) => {
      if (!actif) return
      setConv(TOUS)
      setOuverteMobile(false)
      setNouvelle(false)
      setPersonnes([
        ...(f.data || []).map(p => ({ cle: 'p:famille:' + p.id, type: 'famille', id: p.id, nom: p.name, role: p.role, user_id: p.user_id })),
        ...(i.data || []).map(p => ({ cle: 'p:intervenant:' + p.id, type: 'intervenant', id: p.id, nom: p.name, role: p.role, user_id: p.user_id })),
      ])
    })
    return () => { actif = false }
  }, [seniorId, supabase])

  // Mes messages au senior (borne), avec leur statut de lecture
  useEffect(() => {
    if (!seniorId) return
    let actif = true
    fetch('/api/messages-senior?seniorId=' + seniorId).then(r => r.ok ? r.json() : { messages: [] })
      .then(d => { if (actif) setMessagesSenior(d.messages || []) }).catch(() => {})
    return () => { actif = false }
  }, [seniorId])

  // Dernières ouvertures des conversations, mémorisées sur cet appareil
  useEffect(() => {
    if (!cleVues) return
    // Première visite sur cet appareil : seuls les messages arrivés ensuite comptent comme nouveaux
    const v = lire(cleVues)
    if (!v._debut) { v._debut = new Date().toISOString(); ecrire(cleVues, v) }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- lecture du stockage local au changement de dossier
    setVues(v)
  }, [cleVues])

  // Messages vus : badge du menu (serveur) et conversation ouverte (appareil)
  useEffect(() => {
    if (!seniorId || chargement || document.visibilityState !== 'visible') return
    fetch('/api/messages/non-lus', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seniorId }) }).catch(() => {})
  }, [seniorId, chargement, messages.length])

  useEffect(() => {
    if (!cleVues || chargement) return
    const maj = { ...lire(cleVues), [conv]: new Date().toISOString() }
    ecrire(cleVues, maj)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- la conversation affichée est lue
    setVues(maj)
  }, [conv, cleVues, chargement, messages.length, messagesSenior.length])

  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }) }, [conv, messages.length, messagesSenior.length])

  // ── Conversations ──
  const prenomSenior = senior?.name?.split(' ')[0] || ''
  const mesFiches = new Set(personnes.filter(p => p.user_id === userId).map(p => p.id))
  const estProche = personnes.some(p => p.type === 'famille' && p.user_id === userId)

  function cleDe(m) {
    if (!m.destinataire_id) return TOUS
    if (m.auteur_user_id === userId) {
      const p = personnes.find(x => x.id === m.destinataire_id)
      return p ? p.cle : 'p:archive:' + m.destinataire_id
    }
    if (mesFiches.has(m.destinataire_id)) {
      const p = personnes.find(x => x.user_id && x.user_id === m.auteur_user_id && x.user_id !== userId)
      return p ? p.cle : 'u:' + m.auteur_user_id
    }
    return null
  }

  const parConv = new Map()
  const ajouter = (cle, m) => { if (!parConv.has(cle)) parConv.set(cle, []); parConv.get(cle).push(m) }
  ajouter(TOUS, null)
  for (const m of messages) { const cle = cleDe(m); if (cle) ajouter(cle, m) }
  if (estProche) { ajouter(SENIOR, null); for (const m of messagesSenior) ajouter(SENIOR, { ...m, auteur_user_id: userId, versSenior: true }) }
  for (const [cle, liste] of parConv) parConv.set(cle, liste.filter(Boolean).sort((a, b) => new Date(a.created_at) - new Date(b.created_at)))
  if (conv !== TOUS && conv !== SENIOR && !parConv.has(conv)) parConv.set(conv, []) // nouvelle conversation, encore vide

  function infos(cle) {
    if (cle === TOUS) return { titre: 'Tous', sousTitre: 'Famille, intervenants et structure', icone: '👥' }
    if (cle === SENIOR) return { titre: prenomSenior, sousTitre: 'Sur sa borne', icone: '💌' }
    const p = personnes.find(x => x.cle === cle)
    if (p) return { titre: p.nom, sousTitre: p.role || '', icone: null, personne: p }
    const exemple = (parConv.get(cle) || [])[0]
    const nom = cle.startsWith('u:') ? exemple?.auteur_nom : exemple?.destinataire_nom
    return { titre: nom || 'Ancien contact', sousTitre: cle.startsWith('u:') ? exemple?.auteur_role || '' : 'Ne fait plus partie du dossier', icone: null }
  }

  const conversations = [...parConv.entries()].map(([cle, liste]) => {
    const dernier = liste[liste.length - 1]
    const reference = vues[cle] || vues._debut
    const vu = reference ? new Date(reference).getTime() : null
    const nouveaux = cle === conv || vu === null ? 0 : liste.filter(m => m.auteur_user_id !== userId && new Date(m.created_at).getTime() > vu).length
    return { cle, dernier, nouveaux, ...infos(cle) }
  }).sort((a, b) => {
    if (a.cle === TOUS) return -1
    if (b.cle === TOUS) return 1
    return new Date(b.dernier?.created_at || 0) - new Date(a.dernier?.created_at || 0)
  })
  const fil = parConv.get(conv) || []
  const actuelle = infos(conv)
  const destinataire = actuelle.personne || null
  const peutRepondre = conv === TOUS || conv === SENIOR || !!destinataire
  const nouveauxPossibles = personnes.filter(p => p.user_id !== userId && !parConv.has(p.cle))

  function ouvrir(cle) {
    setConv(cle)
    setOuverteMobile(true)
    setNouvelle(false)
    setTexte('')
    setVocal(null)
    setErreur('')
  }

  // ── Envoi ──
  async function envoyer() {
    if (!texte.trim() || envoi || !peutRepondre) return
    if (conv === SENIOR) return envoyerAuSenior()
    setEnvoi(true); setErreur('')
    try {
      const r = await (await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seniorId, texte, destinataire: destinataire ? { type: destinataire.type, id: destinataire.id } : null }) })).json()
      if (!r.success) { setErreur(r.error || 'Le message n\'a pas pu être envoyé.'); setEnvoi(false); return }
      if (r.message) setMessages(prev => prev.some(m => m.id === r.message.id) ? prev : [...prev, r.message])
      if (r.signalementId) setQuestion({ id: r.signalementId, notePartielle: r.notePartielle })
      setTexte('')
    } catch { setErreur('Erreur réseau, réessayez.') }
    setEnvoi(false)
  }

  async function envoyerAuSenior() {
    setEnvoi(true); setErreur('')
    try {
      const r = await (await fetch('/api/messages-senior', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seniorId, texte }) })).json()
      if (!r.success) { setErreur(r.error || 'Le message n\'a pas pu être envoyé.'); setEnvoi(false); return }
      setMessagesSenior(prev => [...prev, r.message])
      setTexte('')
    } catch { setErreur('Erreur réseau, réessayez.') }
    setEnvoi(false)
  }

  // Message vocal au senior : sa vraie voix, écoutée sur la borne (2 minutes au plus)
  async function enregistrerVocal() {
    if (vocal?.etat === 'enregistrement') { vocalRef.current?.stop(); return }
    setErreur('')
    try {
      const format = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(f => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(f)) || ''
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, format ? { mimeType: format } : undefined)
      const morceaux = []
      const debut = Date.now()
      const limite = setTimeout(() => recorder.state === 'recording' && recorder.stop(), 120000)
      recorder.ondataavailable = e => { if (e.data.size) morceaux.push(e.data) }
      recorder.onstop = () => {
        clearTimeout(limite)
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(morceaux, { type: recorder.mimeType || format || 'audio/webm' })
        setVocal({ etat: 'pret', blob, url: URL.createObjectURL(blob), duree: Math.round((Date.now() - debut) / 1000) })
      }
      recorder.start(); vocalRef.current = recorder; setVocal({ etat: 'enregistrement' })
    } catch { setErreur('Micro indisponible.') }
  }

  async function envoyerVocal() {
    if (!vocal?.blob || envoi) return
    setEnvoi(true); setErreur('')
    try {
      const fd = new FormData()
      fd.append('seniorId', seniorId)
      fd.append('duree', String(vocal.duree || 0))
      fd.append('audio', vocal.blob, 'message.' + (vocal.blob.type.includes('mp4') ? 'm4a' : vocal.blob.type.includes('ogg') ? 'ogg' : 'webm'))
      const r = await (await fetch('/api/messages-senior', { method: 'POST', body: fd })).json()
      if (!r.success) { setErreur(r.error || 'Le message vocal n\'a pas pu être envoyé.'); setEnvoi(false); return }
      setMessagesSenior(prev => [...prev, r.message])
      setVocal(null)
    } catch { setErreur('Erreur réseau, réessayez.') }
    setEnvoi(false)
  }

  // Dictée : le message garde les mots prononcés (pas de reformulation)
  async function dicter() {
    if (dictee === 'enregistrement') { recorderRef.current?.stop(); return }
    setErreur('')
    try {
      const format = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(f => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(f)) || ''
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, format ? { mimeType: format } : undefined)
      const morceaux = []
      recorder.ondataavailable = e => { if (e.data.size) morceaux.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        setDictee('transcription')
        try {
          const blob = new Blob(morceaux, { type: recorder.mimeType || format || 'audio/webm' })
          const fd = new FormData(); fd.append('audio', blob, 'message.' + (blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'))
          const r = await (await fetch('/api/borne-transcribe', { method: 'POST', body: fd })).json()
          if (r.success && r.rawText) setTexte(prev => (prev ? prev + ' ' : '') + r.rawText.trim())
          else setErreur(r.rienEntendu ? r.error : 'La dictée n\'a pas pu être retranscrite.')
        } catch { setErreur('La dictée n\'a pas pu être retranscrite.') }
        setDictee('')
      }
      recorder.start(); recorderRef.current = recorder; setDictee('enregistrement')
    } catch { setErreur('Micro indisponible.') }
  }

  if (!pret) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA' }}>Chargement...</div>
    </div>
  )
  if (!seniors.length) return <AucunDossier isAdmin={famille.isAdmin} />

  const heure = d => {
    const date = new Date(d), auj = new Date()
    const memeJour = date.toDateString() === auj.toDateString()
    return memeJour ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' · ' + date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  }
  const heureCourte = d => {
    const date = new Date(d)
    return date.toDateString() === new Date().toDateString()
      ? date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
      : date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
  }
  const apercu = m => !m ? 'Aucun message' : (m.auteur_user_id === userId ? 'Vous : ' : (m.auteur_nom?.split(' ')[0] + ' : ')) + (m.type === 'vocal' ? '🎙 Message vocal' : (m.contenu || ''))
  const statutBorne = m => m.lu_at
    ? '✓ Lu sur la borne le ' + new Date(m.lu_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) + ' à ' + new Date(m.lu_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
    : m.retire ? 'Non lu, retiré de la borne après 7 jours' : 'Pas encore lu'
  const avatar = (c, taille = 36) => (
    <div style={{ width: taille, height: taille, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: c.icone ? taille * 0.48 : taille * 0.38, fontWeight: 600,
      background: c.cle === TOUS ? '#EAF4EF' : c.cle === SENIOR ? '#F3EDF7' : '#F0F2F1', color: '#4A8870' }}>
      {c.icone || c.titre.split(' ').filter(Boolean).slice(0, 2).map(m => m[0]).join('').toUpperCase()}
    </div>
  )

  return (
    <Layout senior={senior} seniors={seniors} selectedSeniorId={seniorId} switchSenior={switchSenior} isAdmin={famille.isAdmin} isIntervenant={estIntervenant}>
      {question && <QuestionMedicale signalementId={question.id} notePartielle={question.notePartielle} onClose={() => setQuestion(null)} />}

      <style>{`
        .msg-cadre { height: calc(100dvh - 150px); min-height: 440px; display: flex; gap: 14px; }
        .msg-liste { width: 290px; flex-shrink: 0; display: flex; flex-direction: column; }
        .msg-conv { flex: 1; display: flex; flex-direction: column; min-width: 0; }
        .msg-retour { display: none; }
        .msg-dicter-mot { display: inline; }
        @media (max-width: 768px) {
          /* Téléphone : la page défile, la zone de saisie reste au-dessus de la barre du bas */
          .msg-cadre { height: auto; min-height: 0; }
          .msg-liste { width: 100%; }
          .msg-liste-defile { flex: none !important; }
          .msg-fil { flex: none !important; min-height: 50dvh; }
          .msg-saisie { position: sticky; bottom: calc(78px + env(safe-area-inset-bottom, 0px)); background: #F7F9F8; padding: 6px 0 8px; z-index: 5; }
          .msg-cadre[data-ouverte="true"] .msg-liste { display: none; }
          .msg-cadre[data-ouverte="false"] .msg-conv { display: none; }
          .msg-retour { display: inline-flex; }
          .msg-dicter-mot { display: none; }
        }
      `}</style>

      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Messages</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>Messagerie · {prenomSenior}</h1>
        </div>

        <div className="msg-cadre" data-ouverte={ouverteMobile ? 'true' : 'false'}>
          {/* Liste des conversations */}
          <div className="msg-liste">
            <div className="msg-liste-defile" style={{ flex: 1, overflowY: 'auto', background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12 }}>
              {conversations.map(c => (
                <button key={c.cle} onClick={() => ouvrir(c.cle)}
                  style={{ width: '100%', display: 'flex', gap: 10, alignItems: 'center', padding: '11px 12px', border: 'none', borderBottom: '1px solid #F0F4F2', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
                    background: c.cle === conv ? '#EAF4EF' : '#fff' }}>
                  {avatar(c)}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'baseline' }}>
                      <span style={{ flex: 1, fontSize: 14, fontWeight: c.nouveaux ? 600 : 500, color: '#1F2A24', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.titre}</span>
                      {c.dernier && <span style={{ fontSize: 11, color: '#9BB5AA', flexShrink: 0 }}>{heureCourte(c.dernier.created_at)}</span>}
                    </span>
                    <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span style={{ flex: 1, fontSize: 12, color: c.nouveaux ? '#1F2A24' : '#9BB5AA', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.dernier ? apercu(c.dernier) : c.sousTitre}
                      </span>
                      {c.nouveaux > 0 && <span style={{ minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#D98992', color: '#fff', fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{c.nouveaux}</span>}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {nouveauxPossibles.length > 0 && (nouvelle ? (
              <select autoFocus defaultValue="" onChange={e => e.target.value && ouvrir(e.target.value)} onBlur={() => setNouvelle(false)}
                style={{ marginTop: 10, padding: '10px 12px', border: '1px solid #C8DDD4', borderRadius: 10, fontSize: 13, fontFamily: 'inherit', background: '#fff', color: '#1F2A24' }}>
                <option value="" disabled>Écrire à…</option>
                {nouveauxPossibles.map(p => <option key={p.cle} value={p.cle}>{p.nom}{p.role ? ' · ' + p.role : ''}</option>)}
              </select>
            ) : (
              <button onClick={() => setNouvelle(true)}
                style={{ marginTop: 10, background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 0', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                + Nouvelle conversation
              </button>
            ))}
          </div>

          {/* Conversation ouverte */}
          <div className="msg-conv">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 2px 10px' }}>
              <button className="msg-retour" onClick={() => setOuverteMobile(false)}
                style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 999, padding: '6px 12px', fontSize: 13, color: '#6F7C75', cursor: 'pointer', fontFamily: 'inherit' }}>←</button>
              {avatar({ ...actuelle, cle: conv }, 32)}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1F2A24' }}>{actuelle.titre}</div>
                <div style={{ fontSize: 12, color: '#9BB5AA' }}>
                  {conv === TOUS ? `Visible par tous ceux qui suivent ${prenomSenior}` : conv === SENIOR ? `Privé · ${prenomSenior} lit ou écoute sur sa borne` : `Conversation privée${actuelle.sousTitre ? ' · ' + actuelle.sousTitre : ''}`}
                </div>
              </div>
            </div>

            <div className="msg-fil" style={{ flex: 1, overflowY: 'auto', background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 16px 4px' }}>
              {chargement ? (
                <div style={{ color: '#9BB5AA', fontSize: 14, textAlign: 'center', padding: 24 }}>Chargement…</div>
              ) : !fil.length ? (
                <div style={{ color: '#9BB5AA', fontSize: 14, textAlign: 'center', padding: '40px 16px', lineHeight: 1.7 }}>
                  {conv === TOUS ? <>Aucun message pour l&apos;instant.<br />Écrivez le premier : tous ceux qui suivent {prenomSenior} le recevront.</>
                    : conv === SENIOR ? <>Écrivez ou enregistrez un message vocal :<br />{prenomSenior} le lira ou l&apos;écoutera sur sa borne.</>
                    : <>Démarrez la conversation avec {actuelle.titre.split(' ')[0]}.<br />Vous seuls la verrez.</>}
                </div>
              ) : fil.map((m, idx) => {
                const moi = m.auteur_user_id === userId
                const precedent = fil[idx - 1]
                const suite = idx > 0 && precedent.auteur_user_id === m.auteur_user_id && new Date(m.created_at) - new Date(precedent.created_at) < 10 * 60 * 1000
                return (
                  <div key={(m.versSenior ? 's' : 'm') + m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: moi ? 'flex-end' : 'flex-start', marginTop: suite ? 3 : 12 }}>
                    {!suite && (
                      <div style={{ fontSize: 11, color: '#9BB5AA', marginBottom: 3, padding: '0 4px' }}>
                        {moi ? 'Vous' : <><strong style={{ color: '#4A8870', fontWeight: 600 }}>{m.auteur_nom}</strong>{conv === TOUS && m.auteur_role ? ' · ' + m.auteur_role : ''}</>} · {heure(m.created_at)}
                      </div>
                    )}
                    <div style={{
                      maxWidth: '82%', padding: '9px 13px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                      background: moi ? '#7FAF9B' : '#F3F6F4', color: moi ? '#fff' : '#1F2A24',
                      borderRadius: moi ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    }}>{m.type === 'vocal'
                      ? (m.audio_url ? <audio controls preload="none" src={m.audio_url} style={{ maxWidth: 240, display: 'block' }} /> : '🎙 Message vocal')
                      : m.contenu}</div>
                    {m.versSenior && <div style={{ fontSize: 11, color: m.lu_at ? '#4A8870' : '#9BB5AA', margin: '3px 4px 0' }}>{statutBorne(m)}</div>}
                  </div>
                )
              })}
              <div ref={finRef} style={{ height: 12 }} />
            </div>

            <div className="msg-saisie">
            {erreur && <div style={{ fontSize: 13, color: '#C4606A', marginTop: 8 }}>{erreur}</div>}
            {!peutRepondre ? (
              <div style={{ fontSize: 13, color: '#9BB5AA', marginTop: 10 }}>Cette personne ne fait plus partie du dossier : répondez-lui dans « Tous ».</div>
            ) : conv === SENIOR && vocal?.etat === 'pret' ? (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <audio controls src={vocal.url} style={{ flex: 1, minWidth: 200, height: 44 }} />
                <button onClick={() => setVocal(null)} disabled={envoi}
                  style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 10, padding: '0 14px', height: 48, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Recommencer
                </button>
                <button onClick={envoyerVocal} disabled={envoi}
                  style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', height: 48, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: envoi ? 0.5 : 1 }}>
                  {envoi ? '…' : 'Envoyer le vocal'}
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
                <textarea rows={2} value={texte} onChange={e => setTexte(e.target.value)}
                  placeholder={dictee === 'enregistrement' || vocal?.etat === 'enregistrement' ? 'Parlez, puis touchez « Arrêter »…' : conv === TOUS ? 'Message à tout le monde…' : `Message à ${actuelle.titre.split(' ')[0]}…`}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); envoyer() } }}
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid #C8DDD4', borderRadius: 10, fontSize: 15, outline: 'none', fontFamily: 'inherit', resize: 'none', background: '#fff', lineHeight: 1.45 }} />
                {conv === SENIOR ? (
                  <button onClick={enregistrerVocal} title={'Message vocal pour ' + prenomSenior}
                    style={{ background: vocal?.etat === 'enregistrement' ? '#FBECED' : '#F4F5F5', color: vocal?.etat === 'enregistrement' ? '#C4606A' : '#6F7C75', border: 'none', borderRadius: 10, padding: '0 14px', height: 48, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {vocal?.etat === 'enregistrement' ? 'Arrêter' : <>🎙<span className="msg-dicter-mot"> Vocal</span></>}
                  </button>
                ) : (
                  <button onClick={dicter} disabled={dictee === 'transcription'} title="Dicter un message"
                    style={{ background: dictee === 'enregistrement' ? '#FBECED' : '#F4F5F5', color: dictee === 'enregistrement' ? '#C4606A' : '#6F7C75', border: 'none', borderRadius: 10, padding: '0 14px', height: 48, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
                    {dictee === 'transcription' ? '…' : dictee === 'enregistrement' ? 'Arrêter' : <>🎙<span className="msg-dicter-mot"> Dicter</span></>}
                  </button>
                )}
                <button onClick={envoyer} disabled={envoi || !texte.trim()}
                  style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', height: 48, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: !texte.trim() || envoi ? 0.5 : 1 }}>
                  {envoi ? '…' : 'Envoyer'}
                </button>
              </div>
            )}
            </div>
          </div>
        </div>
      </div>
    </Layout>
  )
}
