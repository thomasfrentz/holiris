'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import QuestionMedicale from '../components/QuestionMedicale'

// Page ouverte depuis le lien du compte rendu : le médecin traitant laisse une note, sans compte
function NoteMedecinContenu() {
  const t = useSearchParams().get('t')
  const [etat, setEtat] = useState('chargement') // chargement | invalide | saisie | envoi | envoyee
  const [infos, setInfos] = useState(null)
  const [texte, setTexte] = useState('')
  const [erreur, setErreur] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [transcription, setTranscription] = useState(false)
  const [question, setQuestion] = useState(null)
  const recorderRef = useRef(null)

  useEffect(() => {
    async function charger() {
      if (!t) { setEtat('invalide'); return }
      const res = await fetch('/api/note-medecin?t=' + encodeURIComponent(t))
      if (!res.ok) { setEtat('invalide'); return }
      setInfos(await res.json())
      setEtat('saisie')
    }
    charger()
  }, [t])

  async function dicter() {
    if (enregistrement) { recorderRef.current?.stop(); return }
    setErreur('')
    try {
      const format = ['audio/webm', 'audio/mp4', 'audio/ogg'].find(f => typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(f)) || ''
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream, format ? { mimeType: format } : undefined)
      const morceaux = []
      recorder.ondataavailable = e => { if (e.data.size) morceaux.push(e.data) }
      recorder.onstop = async () => {
        stream.getTracks().forEach(p => p.stop())
        setEnregistrement(false); setTranscription(true)
        try {
          const blob = new Blob(morceaux, { type: recorder.mimeType || format || 'audio/webm' })
          const fd = new FormData(); fd.append('audio', blob, 'note.' + (blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'))
          const r = await (await fetch('/api/borne-transcribe', { method: 'POST', body: fd })).json()
          if (r.success && r.note) setTexte(prev => (prev ? prev + '\n' : '') + r.note)
          else setErreur('La dictée n\'a pas pu être retranscrite. Vous pouvez écrire votre note.')
        } catch { setErreur('La dictée n\'a pas pu être retranscrite. Vous pouvez écrire votre note.') }
        setTranscription(false)
      }
      recorder.start(); recorderRef.current = recorder; setEnregistrement(true)
    } catch { setErreur('Micro indisponible : vous pouvez écrire votre note.') }
  }

  async function envoyer() {
    if (!texte.trim()) return
    setEtat('envoi'); setErreur('')
    const r = await (await fetch('/api/note-medecin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t, texte }) })).json()
    if (!r.success) { setErreur(r.error || 'Une erreur est survenue.'); setEtat('saisie'); return }
    if (r.signalementId) setQuestion({ id: r.signalementId, notePartielle: r.notePartielle })
    setEtat('envoyee')
  }

  const carte = { background: '#fff', border: '1px solid #E8EFEB', borderRadius: 16, padding: '32px 28px', width: '100%', maxWidth: 560, boxShadow: '0 4px 24px rgba(127,175,155,0.1)' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', fontFamily: "'Inter', sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500;600&display=swap');`}</style>
      {question && <QuestionMedicale signalementId={question.id} notePartielle={question.notePartielle} onClose={() => setQuestion(null)} />}
      <div style={carte}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500, color: '#1F2A24', marginBottom: 4 }}>Holiris</div>

        {etat === 'chargement' && <p style={{ color: '#9BB5AA', fontSize: 14 }}>Chargement…</p>}

        {etat === 'invalide' && (
          <p style={{ color: '#6F7C75', fontSize: 14, lineHeight: 1.7 }}>
            Ce lien n&apos;est plus valable. Il expire quelques jours après la consultation.
          </p>
        )}

        {(etat === 'saisie' || etat === 'envoi') && infos && (
          <>
            <p style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.7, marginBottom: 20 }}>
              Note de <strong>{infos.medecin}</strong> pour la famille de <strong>{infos.senior}</strong>.
              Quelques mots suffisent pour les rassurer : l&apos;état général, le moral, ce qu&apos;il faut surveiller.
            </p>
            <textarea rows={6} value={texte} onChange={e => setTexte(e.target.value)} placeholder="Votre note…"
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #C8DDD4', borderRadius: 10, fontSize: 15, lineHeight: 1.6, outline: 'none', fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box', background: '#FAFCFC', marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: '#6F7C75', lineHeight: 1.6, marginBottom: 16, background: '#FDF3E7', borderLeft: '3px solid #C4844A', padding: '10px 12px', borderRadius: '0 6px 6px 0' }}>
              <strong style={{ color: '#C4844A' }}>Merci de ne pas communiquer d&apos;information médicale</strong> (diagnostic, traitement, résultats), sauf si elle est essentielle.
              Dans ce cas, elle ne sera pas enregistrée : la personne de confiance de la famille vous recontactera pour en parler.
            </p>
            {erreur && <p style={{ fontSize: 13, color: '#C4606A', marginBottom: 12 }}>{erreur}</p>}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button onClick={envoyer} disabled={etat === 'envoi' || !texte.trim()}
                style={{ flex: 1, background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 20px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: !texte.trim() ? 0.5 : 1 }}>
                {etat === 'envoi' ? 'Envoi…' : 'Enregistrer la note'}
              </button>
              <button onClick={dicter} disabled={transcription}
                style={{ background: enregistrement ? '#FBECED' : '#F4F5F5', color: enregistrement ? '#C4606A' : '#6F7C75', border: 'none', borderRadius: 8, padding: '12px 18px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                {transcription ? 'Retranscription…' : enregistrement ? 'Arrêter la dictée' : 'Dicter'}
              </button>
            </div>
          </>
        )}

        {etat === 'envoyee' && (
          <p style={{ fontSize: 15, color: '#4A8870', lineHeight: 1.7 }}>
            Merci, votre note a bien été transmise à la famille de {infos?.senior}.
          </p>
        )}
      </div>
    </div>
  )
}

export default function NoteMedecin() {
  return (
    <Suspense fallback={null}>
      <NoteMedecinContenu />
    </Suspense>
  )
}
