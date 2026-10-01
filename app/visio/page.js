'use client'
import { useState, useEffect, useRef } from 'react'
import { demarrerVisio } from '../lib/visioRtc'

// Lien reçu par un proche après un SOS : active la caméra et le micro de la borne (une seule fois).
// Le jeton n'est consommé qu'au clic sur le bouton, pas à l'ouverture de la page.
const DUREE_MAX = 15 * 60

export default function Visio() {
  const [etat, setEtat] = useState('accueil') // accueil | demarrage | connexion | en-direct | coupure | echec | termine | erreur
  const [erreur, setErreur] = useState('')
  const [infos, setInfos] = useState(null) // { seniorName, canal }
  const [micCoupe, setMicCoupe] = useState(false)
  const [micDispo, setMicDispo] = useState(false)
  const [reste, setReste] = useState(DUREE_MAX)
  const videoRef = useRef(null)
  const visioRef = useRef(null)
  const micRef = useRef(null)

  async function activer() {
    const jeton = new URLSearchParams(window.location.search).get('t')
    setEtat('demarrage')
    // Micro du proche pour rassurer la personne (facultatif : la visio fonctionne sans)
    try { micRef.current = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { micRef.current = null }
    setMicDispo(!!micRef.current)

    const res = await fetch('/api/visio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jeton }) })
    const data = await res.json().catch(() => ({}))
    if (!data.success) {
      micRef.current?.getTracks().forEach(t => t.stop())
      setErreur(data.error || 'La visio n\'a pas pu démarrer.')
      setEtat('erreur')
      return
    }
    setInfos({ seniorName: data.seniorName, canal: data.canal })
    visioRef.current = demarrerVisio({
      role: 'proche',
      canal: data.canal,
      iceServers: data.iceServers,
      fluxLocal: micRef.current,
      surFluxDistant: flux => { if (videoRef.current) videoRef.current.srcObject = flux },
      surEtat: setEtat,
    })
  }

  function raccrocher() {
    visioRef.current?.arreter()
    if (infos?.canal) fetch('/api/visio', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ canal: infos.canal, fin: true }) }).catch(() => {})
    setEtat('termine')
  }

  function basculerMic() {
    micRef.current?.getAudioTracks().forEach(t => { t.enabled = micCoupe })
    setMicCoupe(!micCoupe)
  }

  // Durée limitée à 15 minutes
  useEffect(() => {
    if (!['connexion', 'en-direct', 'coupure'].includes(etat)) return
    const t = setTimeout(() => reste <= 1 ? raccrocher() : setReste(r => r - 1), 1000)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- raccrocher ne dépend que de refs et de l'état courant
  }, [etat, reste])

  useEffect(() => () => visioRef.current?.arreter(), [])

  const enCours = ['connexion', 'en-direct', 'coupure'].includes(etat)
  const bouton = { border: 'none', borderRadius: 12, padding: '16px 24px', fontSize: 16, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100dvh', background: enCours ? '#111614' : '#F7F9F8', fontFamily: "'Inter', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      {etat === 'accueil' && (
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📹</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 32, fontWeight: 500, color: '#1F2A24', marginBottom: 12 }}>Visio après l&apos;alerte SOS</h1>
          <p style={{ fontSize: 15, color: '#6F7C75', lineHeight: 1.6, marginBottom: 28 }}>
            Ce bouton active la caméra et le micro de la borne. Vous pourrez voir, entendre et parler. Ce lien ne fonctionne qu&apos;une seule fois.
          </p>
          <button onClick={activer} style={{ ...bouton, background: '#C4434F', color: '#fff', width: '100%', fontSize: 18 }}>
            Activer la caméra de la borne
          </button>
          <p style={{ fontSize: 13, color: '#9BB5AA', marginTop: 20 }}>Urgence vitale : appelez le 15 ou le 112.</p>
        </div>
      )}

      {etat === 'demarrage' && <p style={{ color: '#6F7C75', fontSize: 16 }}>Démarrage…</p>}

      {(etat === 'erreur' || etat === 'termine' || etat === 'echec') && (
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 44, marginBottom: 14 }}>{etat === 'termine' ? '👋' : '⚠️'}</div>
          <p style={{ fontSize: 17, color: '#1F2A24', lineHeight: 1.6, marginBottom: 10 }}>
            {etat === 'termine' ? 'La visio est terminée.' : etat === 'echec' ? 'La connexion avec la borne n\'a pas pu s\'établir.' : erreur}
          </p>
          <p style={{ fontSize: 14, color: '#6F7C75' }}>Appelez votre proche ou rendez-vous sur place. Urgence vitale : 15 ou 112.</p>
        </div>
      )}

      {enCours && (
        <div style={{ width: '100%', maxWidth: 900, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#fff' }}>
            <div>
              <div style={{ fontSize: 17, fontWeight: 500 }}>{infos?.seniorName}</div>
              <div style={{ fontSize: 13, color: etat === 'en-direct' ? '#9AB89F' : '#E6B98A' }}>
                {etat === 'en-direct' ? '● En direct' : etat === 'coupure' ? 'Connexion instable…' : 'Connexion à la borne…'}
              </div>
            </div>
            <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>{Math.floor(reste / 60)}:{String(reste % 60).padStart(2, '0')}</div>
          </div>
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', aspectRatio: '4 / 3', background: '#000', borderRadius: 14, objectFit: 'cover' }} />
          <div style={{ display: 'flex', gap: 10 }}>
            {micDispo && (
              <button onClick={basculerMic} style={{ ...bouton, flex: 1, background: 'rgba(255,255,255,0.12)', color: '#fff' }}>
                {micCoupe ? '🎙 Réactiver mon micro' : '🔇 Couper mon micro'}
              </button>
            )}
            <button onClick={raccrocher} style={{ ...bouton, flex: 1, background: '#C4434F', color: '#fff' }}>Raccrocher</button>
          </div>
        </div>
      )}
    </div>
  )
}
