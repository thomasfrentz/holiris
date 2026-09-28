'use client'
import { useState, useEffect, useRef } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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

  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

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
    const { data: borne } = await supabase
      .from('bornes')
      .select('*, seniors(name)')
      .eq('code', code.toUpperCase())
      .single()

    if (!borne) {
      localStorage.removeItem('holiris_borne_code')
      setStep('setup')
      setError('Code borne invalide.')
      return
    }

    const [{ data: intervenants }, { data: famille }] = await Promise.all([
      supabase.from('intervenants').select('id, name, role').eq('senior_id', borne.senior_id).order('name'),
      supabase.from('famille').select('id, name, role').eq('senior_id', borne.senior_id).is('archived_at', null).order('name'),
    ])

    const liste = [
      ...(intervenants || []).map(p => ({ ...p, type: 'intervenant' })),
      ...(famille || []).map(p => ({ ...p, type: 'famille' })),
    ].sort((a, b) => a.name.localeCompare(b.name))

    setBorneInfo(borne)
    setPersonnes(liste)
    setStep('accueil')
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
          intervenantName: selectedPersonne.name,
          intervenantRole: selectedPersonne.role || '',
          seniorId: borneInfo.senior_id
        })
      })
      const result = await res.json()
      if (result.success) {
        setStep('confirmation')
        setTimeout(() => {
          setSelectedPersonne(null)
          setAudioBlob(null)
          setNoteProposee('')
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
    setBorneInfo(null)
    setPersonnes([])
    setSelectedPersonne(null)
    setStep('setup')
  }

  const bg = { minHeight: '100vh', background: '#1E2820', fontFamily: "'Inter', DM Sans, sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }

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
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 8 }}>Qui êtes-vous ?</p>
        </div>

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
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6 }}>Note vocale pour {borneInfo?.seniors?.name}</p>
          <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 32, fontWeight: 300, color: '#FAFCFA' }}>{selectedPersonne?.name}</h2>
          <p style={{ fontSize: 13, color: 'rgba(154,184,159,0.6)' }}>{selectedPersonne?.role}</p>
        </div>

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

  if (step === 'confirmation') return (
    <div style={bg}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 72, marginBottom: 24 }}>✅</div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 36, fontWeight: 300, color: '#FAFCFA', marginBottom: 12 }}>Note enregistrée</h2>
        <p style={{ color: '#9AB89F', fontSize: 15 }}>Merci {selectedPersonne?.name}</p>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13, marginTop: 8 }}>Retour à l’accueil dans quelques secondes...</p>
      </div>
    </div>
  )

  return null
}
