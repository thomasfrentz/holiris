'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

export default function Borne() {
  const [step, setStep] = useState('loading')
  const [borneCode, setBorneCode] = useState('')
  const [codeInput, setCodeInput] = useState('')
  const [borneInfo, setBorneInfo] = useState(null)
  const [intervenants, setIntervenants] = useState([])
  const [selectedIntervenant, setSelectedIntervenant] = useState(null)
  const [recording, setRecording] = useState(false)
  const [audioBlob, setAudioBlob] = useState(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [duration, setDuration] = useState(0)

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const streamRef = useRef(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    const saved = localStorage.getItem('holiris_borne_code')
    if (saved) {
      setBorneCode(saved)
      loadBorne(saved)
    } else {
      setStep('setup')
    }
  }, [])

  async function loadBorne(code) {
    setStep('loading')
    const { data: borne } = await supabase
      .from('bornes')
      .select('*, seniors(name)')
      .eq('code', code.toUpperCase())
      .single()

    if (!borne) {
      localStorage.removeItem('holiris_borne_code')
      setBorneCode('')
      setStep('setup')
      setError('Code borne invalide.')
      return
    }

    const { data: intervenantsData } = await supabase
      .from('intervenants')
      .select('id, name, role')
      .eq('senior_id', borne.senior_id)
      .order('name')

    setBorneInfo(borne)
    setIntervenants(intervenantsData || [])
    setStep('accueil')
  }

  async function activerBorne() {
    if (!codeInput.trim()) return
    setError('')
    const code = codeInput.trim().toUpperCase()
    localStorage.setItem('holiris_borne_code', code)
    setBorneCode(code)
    await loadBorne(code)
  }

  function choisirIntervenant(intervenant) {
    setSelectedIntervenant(intervenant)
    setAudioBlob(null)
    setDuration(0)
    setStep('enregistrement')
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      chunksRef.current = []
      const mr = new MediaRecorder(stream)
      mediaRecorderRef.current = mr
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        setAudioBlob(blob)
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

  async function envoyerNote() {
    if (!audioBlob || !selectedIntervenant) return
    setSending(true)
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'note.webm')
      formData.append('intervenantId', selectedIntervenant.id)
      formData.append('intervenantName', selectedIntervenant.name)
      formData.append('intervenantRole', selectedIntervenant.role || '')
      formData.append('seniorId', borneInfo.senior_id)

      const res = await fetch('/api/borne-note', { method: 'POST', body: formData })
      const result = await res.json()
      if (result.success) {
        setStep('confirmation')
        setTimeout(() => {
          setSelectedIntervenant(null)
          setAudioBlob(null)
          setDuration(0)
          setStep('accueil')
        }, 3000)
      } else {
        setError("Erreur lors de l'envoi.")
      }
    } catch {
      setError('Erreur réseau.')
    }
    setSending(false)
  }

  function formatDuration(s) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  function resetBorne() {
    localStorage.removeItem('holiris_borne_code')
    setBorneCode('')
    setBorneInfo(null)
    setIntervenants([])
    setSelectedIntervenant(null)
    setStep('setup')
  }

  const bg = { minHeight: '100vh', background: '#1E2820', fontFamily: "'Inter', DM Sans, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }
  const card = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 8, padding: '48px 40px', width: '100%', maxWidth: 480 }

  if (step === 'loading') return (
    <div style={bg}><div style={{ color: '#9AB89F', fontSize: 14 }}>Chargement...</div></div>
  )

  if (step === 'setup') return (
    <div style={bg}>
      <div style={card}>
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
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Domicile de</p>
          <h1 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 48, fontWeight: 300, color: '#FAFCFA', letterSpacing: '0.06em' }}>{borneInfo?.seniors?.name}</h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Qui êtes-vous ?</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {intervenants.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.35)', fontSize: 14, padding: 40 }}>Aucun intervenant configuré</div>
          ) : intervenants.map(i => (
            <button key={i.id} onClick={() => choisirIntervenant(i)}
              style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 8, padding: '20px 24px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'rgba(107,143,113,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>👤</div>
              <div>
                <div style={{ fontSize: 18, fontWeight: 500, color: '#FAFCFA' }}>{i.name}</div>
                <div style={{ fontSize: 13, color: 'rgba(154,184,159,0.7)', marginTop: 2 }}>{i.role}</div>
              </div>
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'center', marginTop: 40 }}>
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
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>Note vocale</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 300, color: '#FAFCFA' }}>{selectedIntervenant?.name}</h2>
          <p style={{ fontSize: 13, color: 'rgba(154,184,159,0.6)' }}>{selectedIntervenant?.role}</p>
        </div>
        {error && <div style={{ background: 'rgba(196,122,130,0.15)', border: '1px solid rgba(196,122,130,0.3)', borderRadius: 4, padding: '10px 14px', fontSize: 13, color: '#e0939a', marginBottom: 24 }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 32 }}>
          {!audioBlob ? (
            <>
              <button
                onClick={recording ? stopRecording : startRecording}
                style={{ width: 140, height: 140, borderRadius: '50%', background: recording ? 'rgba(196,96,106,0.9)' : '#6B8F71', border: recording ? '4px solid rgba(196,96,106,0.4)' : '4px solid rgba(107,143,113,0.4)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, boxShadow: recording ? '0 0 0 12px rgba(196,96,106,0.2), 0 0 0 24px rgba(196,96,106,0.1)' : '0 0 0 8px rgba(107,143,113,0.15)', transition: 'all 0.3s ease' }}>
                <span style={{ fontSize: 40 }}>{recording ? '⏹' : '🎙'}</span>
                <span style={{ fontSize: 11, color: '#fff', letterSpacing: '0.1em' }}>{recording ? formatDuration(duration) : 'PARLER'}</span>
              </button>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{recording ? 'Appuyez à nouveau pour arrêter' : 'Appuyez pour commencer'}</p>
            </>
          ) : (
            <>
              <div style={{ width: 100, height: 100, borderRadius: '50%', background: 'rgba(107,143,113,0.2)', border: '2px solid rgba(107,143,113,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>✅</div>
              <div>
                <p style={{ color: '#9AB89F', fontSize: 15, marginBottom: 4 }}>Enregistrement terminé</p>
                <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>{formatDuration(duration)}</p>
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={envoyerNote} disabled={sending}
                  style={{ background: '#6B8F71', color: '#fff', border: 'none', borderRadius: 4, padding: '14px 32px', fontSize: 15, fontWeight: 500, cursor: 'pointer' }}>
                  {sending ? 'Envoi...' : 'Envoyer la note'}
                </button>
                <button onClick={() => { setAudioBlob(null); setDuration(0) }}
                  style={{ background: 'rgba(255,255,255,0.07)', color: 'rgba(255,255,255,0.6)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, padding: '14px 24px', fontSize: 15, cursor: 'pointer' }}>
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

  if (step === 'confirmation') return (
    <div style={bg}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>✅</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 300, color: '#FAFCFA', marginBottom: 12 }}>Note enregistrée</h2>
        <p style={{ color: '#9AB89F', fontSize: 15 }}>Merci {selectedIntervenant?.name}</p>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 8 }}>Retour à l'accueil dans quelques secondes...</p>
      </div>
    </div>
  )

  return null
}
