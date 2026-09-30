'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import AucunDossier from '../components/AucunDossier'
import QuestionMedicale from '../components/QuestionMedicale'
import { useSenior } from '../lib/useSenior'
import { useIntervenant } from '../lib/useIntervenant'

// Fil de discussion d'un senior : famille, intervenants et structure se répondent
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
  const recorderRef = useRef(null)
  const finRef = useRef(null)

  // Proche, gestionnaire ou admin : dossiers habituels ; intervenant : ceux de son espace
  const estIntervenant = !famille.seniors.length && interv.seniorsList.length > 0
  const seniors = estIntervenant ? interv.seniorsList : famille.seniors
  const seniorId = estIntervenant ? interv.selectedSeniorId : famille.selectedSeniorId
  const senior = seniors.find(s => s.id === seniorId)
  const switchSenior = estIntervenant ? interv.switchSenior : famille.switchSenior
  const pret = !famille.loading && !interv.loading

  useEffect(() => {
    async function qui() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login?redirect=' + encodeURIComponent('/messages')); return }
      setUserId(user.id)
    }
    qui()
  }, [])

  // Chargement du fil et affichage en direct des nouveaux messages
  useEffect(() => {
    if (!seniorId) return
    let actif = true
    async function charger() {
      const { data } = await supabase.from('messages').select('*').eq('senior_id', seniorId)
        .order('created_at', { ascending: false }).limit(150)
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
  }, [seniorId])

  useEffect(() => { finRef.current?.scrollIntoView({ block: 'end' }) }, [messages.length])

  async function envoyer() {
    if (!texte.trim() || envoi) return
    setEnvoi(true); setErreur('')
    try {
      const r = await (await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ seniorId, texte }) })).json()
      if (!r.success) { setErreur(r.error || 'Le message n\'a pas pu être envoyé.'); setEnvoi(false); return }
      if (r.message) setMessages(prev => prev.some(m => m.id === r.message.id) ? prev : [...prev, r.message])
      if (r.signalementId) setQuestion({ id: r.signalementId, notePartielle: r.notePartielle })
      setTexte('')
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
          else setErreur('La dictée n\'a pas pu être retranscrite.')
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

  return (
    <Layout senior={senior} seniors={seniors} selectedSeniorId={seniorId} switchSenior={switchSenior} isAdmin={famille.isAdmin} isIntervenant={estIntervenant}>
      {question && <QuestionMedicale signalementId={question.id} notePartielle={question.notePartielle} onClose={() => setQuestion(null)} />}

      <style>{`
        .fil-messages { height: calc(100dvh - 140px); min-height: 420px; }
        .fil-dicter-mot { display: inline; }
        /* Téléphone : le fil laisse la place au bandeau d'installation et à la barre du bas */
        @media (max-width: 768px) {
          .fil-messages { height: calc(100dvh - 185px); min-height: 300px; }
          .fil-dicter-mot { display: none; }
          .fil-sous-titre { display: none; }
        }
      `}</style>
      <div className="fil-messages" style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Messages</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>Le fil de {senior?.name?.split(' ')[0]}</h1>
          <p className="fil-sous-titre" style={{ color: '#9BB5AA', fontSize: 13, marginTop: 6 }}>Visible par la famille, les intervenants et la structure qui suivent {senior?.name}.</p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 16px 4px' }}>
          {chargement ? (
            <div style={{ color: '#9BB5AA', fontSize: 14, textAlign: 'center', padding: 24 }}>Chargement…</div>
          ) : !messages.length ? (
            <div style={{ color: '#9BB5AA', fontSize: 14, textAlign: 'center', padding: '40px 16px', lineHeight: 1.7 }}>
              Aucun message pour l&apos;instant.<br />Écrivez le premier : toute l&apos;équipe de {senior?.name?.split(' ')[0]} le recevra.
            </div>
          ) : messages.map((m, idx) => {
            const moi = m.auteur_user_id === userId
            const suite = idx > 0 && messages[idx - 1].auteur_user_id === m.auteur_user_id && new Date(m.created_at) - new Date(messages[idx - 1].created_at) < 10 * 60 * 1000
            return (
              <div key={m.id} style={{ display: 'flex', flexDirection: 'column', alignItems: moi ? 'flex-end' : 'flex-start', marginTop: suite ? 3 : 12 }}>
                {!suite && (
                  <div style={{ fontSize: 11, color: '#9BB5AA', marginBottom: 3, padding: '0 4px' }}>
                    {moi ? 'Vous' : <><strong style={{ color: '#4A8870', fontWeight: 600 }}>{m.auteur_nom}</strong>{m.auteur_role ? ' · ' + m.auteur_role : ''}</>} · {heure(m.created_at)}
                  </div>
                )}
                <div style={{
                  maxWidth: '82%', padding: '9px 13px', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  background: moi ? '#7FAF9B' : '#F3F6F4', color: moi ? '#fff' : '#1F2A24',
                  borderRadius: moi ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                }}>{m.contenu}</div>
              </div>
            )
          })}
          <div ref={finRef} style={{ height: 12 }} />
        </div>

        {erreur && <div style={{ fontSize: 13, color: '#C4606A', marginTop: 8 }}>{erreur}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'flex-end' }}>
          <textarea rows={2} value={texte} onChange={e => setTexte(e.target.value)} placeholder={dictee === 'enregistrement' ? 'Parlez, puis touchez « Arrêter »…' : 'Votre message…'}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && window.innerWidth > 768) { e.preventDefault(); envoyer() } }}
            style={{ flex: 1, padding: '10px 14px', border: '1px solid #C8DDD4', borderRadius: 10, fontSize: 15, outline: 'none', fontFamily: 'inherit', resize: 'none', background: '#fff', lineHeight: 1.45 }} />
          <button onClick={dicter} disabled={dictee === 'transcription'} title="Dicter un message"
            style={{ background: dictee === 'enregistrement' ? '#FBECED' : '#F4F5F5', color: dictee === 'enregistrement' ? '#C4606A' : '#6F7C75', border: 'none', borderRadius: 10, padding: '0 14px', height: 48, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
            {dictee === 'transcription' ? '…' : dictee === 'enregistrement' ? 'Arrêter' : <>🎙<span className="fil-dicter-mot"> Dicter</span></>}
          </button>
          <button onClick={envoyer} disabled={envoi || !texte.trim()}
            style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 10, padding: '0 18px', height: 48, fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: !texte.trim() || envoi ? 0.5 : 1 }}>
            {envoi ? '…' : 'Envoyer'}
          </button>
        </div>
      </div>
    </Layout>
  )
}
