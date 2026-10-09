'use client'
import { useState, useEffect } from 'react'

// Bouton « Activer les notifications » : abonne ce téléphone (ou ordinateur) aux notifications Holiris.
// Sur iPhone, Apple ne les autorise que dans l'application ajoutée à l'écran d'accueil.
// jeton : intervenant sans compte (borne sur téléphone) ; sinon le compte connecté.
const CLE = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function versOctets(base64) {
  const brut = atob((base64 + '='.repeat((4 - base64.length % 4) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from([...brut].map(c => c.charCodeAt(0)))
}

export default function ActiverNotifications({ jeton = null, style = {} }) {
  const [etat, setEtat] = useState('cache') // cache | proposer | actif | bloque | iphone | encours
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    if (!CLE || typeof window === 'undefined') return
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
    const installee = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone
    const possible = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
    // eslint-disable-next-line react-hooks/set-state-in-effect -- détection unique des capacités du navigateur
    if (!possible) { if (ios && !installee) setEtat('iphone'); return }
    if (Notification.permission === 'denied') { setEtat('bloque'); return }
    navigator.serviceWorker.register('/sw.js').then(async reg => {
      const existant = await reg.pushManager.getSubscription()
      if (existant && Notification.permission === 'granted') {
        // Resynchronise l'abonnement (changement de compte, abonnement renouvelé par le téléphone)
        fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abonnement: existant.toJSON(), jeton }) }).catch(() => {})
        setEtat('actif')
      } else setEtat('proposer')
    }).catch(() => setEtat('cache'))
  }, [jeton])

  async function activer() {
    setErreur('')
    setEtat('encours')
    try {
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setEtat(permission === 'denied' ? 'bloque' : 'proposer'); return }
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const abonnement = (await reg.pushManager.getSubscription()) || await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: versOctets(CLE) })
      const r = await fetch('/api/push', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ abonnement: abonnement.toJSON(), jeton }) })
      if (!r.ok) throw new Error()
      setEtat('actif')
    } catch {
      setErreur('Activation impossible sur ce navigateur.')
      setEtat('proposer')
    }
  }

  if (etat === 'cache' || etat === 'actif') return null
  const cadre = { display: 'flex', alignItems: 'center', gap: 10, background: '#EAF4EF', border: '1px solid #C8DDD4', borderRadius: 10, padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#4A6B5E', ...style }

  if (etat === 'iphone') return (
    <div style={cadre}>
      <span style={{ fontSize: 18 }}>🔔</span>
      <span>Pour recevoir les notifications sur iPhone, ajoutez d&apos;abord Holiris à l&apos;écran d&apos;accueil, puis ouvrez-le depuis l&apos;icône.</span>
    </div>
  )
  if (etat === 'bloque') return (
    <div style={{ ...cadre, background: '#FDF3E7', borderColor: '#F0D9B5', color: '#9A6634' }}>
      <span style={{ fontSize: 18 }}>🔕</span>
      <span>Les notifications sont bloquées pour Holiris. Autorisez-les dans les réglages du téléphone pour être prévenu des messages et des alertes.</span>
    </div>
  )
  return (
    <div style={cadre}>
      <span style={{ fontSize: 18 }}>🔔</span>
      <span style={{ flex: 1 }}>
        Soyez prévenu des nouveaux messages et des alertes sur ce téléphone.
        {erreur && <span style={{ display: 'block', color: '#C4606A', marginTop: 2 }}>{erreur}</span>}
      </span>
      <button onClick={activer} disabled={etat === 'encours'}
        style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' }}>
        {etat === 'encours' ? '…' : 'Activer'}
      </button>
    </div>
  )
}
