'use client'
import { useState, useRef } from 'react'
import QuestionMedicale from './QuestionMedicale'

// Format d'enregistrement accepté par le navigateur (Safari iPhone : mp4, Chrome/Android : webm)
function formatAudio() {
  if (typeof MediaRecorder === 'undefined') return null
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(t => MediaRecorder.isTypeSupported(t)) || ''
}

// Enregistrement d'une note vocale : on parle, l'IA propose une note, on relit, on envoie.
// source : 'intervenant' | 'famille'
export default function NoteVocale({ seniorId, source, onNoteAjoutee, grand = false }) {
  const [etape, setEtape] = useState('pret') // pret | enregistrement | transcription | revision | envoi | envoyee
  const [duree, setDuree] = useState(0)
  const [note, setNote] = useState('')
  const [erreur, setErreur] = useState('')
  const [questionMedicale, setQuestionMedicale] = useState(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)

  async function demarrer() {
    setErreur('')
    const format = formatAudio()
    if (format === null) { setErreur('Votre navigateur ne permet pas d\'enregistrer. Mettez-le à jour ou utilisez WhatsApp.'); return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, format ? { mimeType: format } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        transcrire(new Blob(chunksRef.current, { type: recorder.mimeType || format || 'audio/webm' }))
      }
      recorder.start()
      recorderRef.current = recorder
      setDuree(0)
      setEtape('enregistrement')
      timerRef.current = setInterval(() => setDuree(d => d + 1), 1000)
    } catch {
      setErreur('Accès au micro refusé. Autorisez le micro dans les réglages du navigateur.')
    }
  }

  function arreter() {
    clearInterval(timerRef.current)
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
  }

  async function transcrire(blob) {
    setEtape('transcription')
    try {
      const formData = new FormData()
      const extension = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
      formData.append('audio', blob, 'note.' + extension)
      const res = await fetch('/api/borne-transcribe', { method: 'POST', body: formData })
      const result = await res.json()
      if (!result.success || !result.note) throw new Error(result.rienEntendu ? result.error : '')
      setNote(result.note)
      setEtape('revision')
    } catch (e) {
      setErreur(e.message || 'La transcription a échoué. Réessayez.')
      setEtape('pret')
    }
  }

  async function envoyer() {
    if (!note.trim()) return
    setEtape('envoi')
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seniorId, texte: note, source })
      })
      const result = await res.json()
      if (!result.success) throw new Error(result.error)
      if (result.note) onNoteAjoutee?.(result.note)
      if (result.signalementId) setQuestionMedicale({ id: result.signalementId, notePartielle: !!result.note })
      setNote('')
      setEtape('envoyee')
      setTimeout(() => setEtape(e => e === 'envoyee' ? 'pret' : e), 3000)
    } catch {
      setErreur('L\'envoi a échoué. Réessayez.')
      setEtape('revision')
    }
  }

  const taille = grand ? 132 : 64
  const minutes = String(Math.floor(duree / 60)).padStart(2, '0') + ':' + String(duree % 60).padStart(2, '0')
  const bouton = { border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flex: 1 }

  return (
    <div style={{ textAlign: 'center' }}>
      {questionMedicale && (
        <QuestionMedicale signalementId={questionMedicale.id} notePartielle={questionMedicale.notePartielle}
          onClose={() => setQuestionMedicale(null)} />
      )}
      <style>{`@keyframes hl-pulse { 0% { box-shadow: 0 0 0 0 rgba(217,137,146,0.5) } 100% { box-shadow: 0 0 0 ${grand ? 28 : 16}px rgba(217,137,146,0) } }`}</style>

      {(etape === 'pret' || etape === 'enregistrement' || etape === 'envoyee') && (
        <>
          <button onClick={etape === 'enregistrement' ? arreter : demarrer} disabled={!seniorId}
            aria-label={etape === 'enregistrement' ? 'Arrêter l\'enregistrement' : 'Enregistrer une note vocale'}
            style={{
              width: taille, height: taille, borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: etape === 'enregistrement' ? '#D98992' : '#7FAF9B', color: '#fff',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              animation: etape === 'enregistrement' ? 'hl-pulse 1.2s infinite' : 'none',
              boxShadow: '0 6px 20px rgba(127,175,155,0.35)', opacity: seniorId ? 1 : 0.5,
            }}>
            {etape === 'enregistrement' ? (
              <svg width={taille * 0.34} height={taille * 0.34} viewBox="0 0 24 24" fill="#fff"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
            ) : (
              <svg width={taille * 0.4} height={taille * 0.4} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round"><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>
            )}
          </button>
          <div style={{ fontSize: grand ? 15 : 13, color: etape === 'enregistrement' ? '#D98992' : '#6F7C75', marginTop: 12, fontWeight: etape === 'enregistrement' ? 600 : 400 }}>
            {etape === 'enregistrement' ? '● ' + minutes + ' — touchez pour terminer'
              : etape === 'envoyee' ? '✓ Note envoyée, merci !'
              : 'Touchez pour enregistrer une note vocale'}
          </div>
        </>
      )}

      {etape === 'transcription' && (
        <div style={{ padding: grand ? '48px 0' : '20px 0', fontSize: 14, color: '#9BB5AA' }}>✨ Transcription en cours…</div>
      )}

      {(etape === 'revision' || etape === 'envoi') && (
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 8 }}>Note proposée — relisez avant d&apos;envoyer</div>
          <textarea value={note} onChange={e => setNote(e.target.value)} rows={4}
            style={{ width: '100%', padding: '12px 14px', border: '1px solid #C8DDD4', borderRadius: 10, fontSize: 15, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#FAFCFC', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={envoyer} disabled={etape === 'envoi' || !note.trim()} style={{ ...bouton, background: '#7FAF9B', color: '#fff' }}>
              {etape === 'envoi' ? 'Envoi…' : 'Envoyer la note'}
            </button>
            <button onClick={() => { setNote(''); setEtape('pret') }} disabled={etape === 'envoi'} style={{ ...bouton, flex: '0 0 auto', padding: '12px 18px', background: '#F4F5F5', color: '#6F7C75' }}>
              Recommencer
            </button>
          </div>
        </div>
      )}

      {erreur && <div style={{ fontSize: 13, color: '#C4606A', marginTop: 12 }}>{erreur}</div>}
    </div>
  )
}
