'use client'
import { useState, useEffect } from 'react'
import QRCode from 'qrcode'

// Code du domicile : à taper après avoir scanné le QR code Holiris (le même partout),
// pour laisser une note sans compte. L'affiche à imprimer réunit le QR code et ce code.

const afficherCode = c => c ? c.slice(0, 4) + '-' + c.slice(4) : ''
const echapper = t => String(t || '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))

export default function CodeNoteQr({ seniorId, seniorName }) {
  const [code, setCode] = useState(null)
  const [chargement, setChargement] = useState(true)
  const [envoi, setEnvoi] = useState(false)

  async function appel(action) {
    const res = await fetch('/api/qr-note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, seniorId }) })
    return res.json().catch(() => ({}))
  }

  useEffect(() => {
    let actif = true
    appel('lire').then(r => { if (actif) { setCode(r.code || null); setChargement(false) } })
    return () => { actif = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- rechargé à chaque changement de dossier
  }, [seniorId])

  async function generer() {
    if (code && !confirm('Changer le code ? L\'ancien code ne fonctionnera plus : il faudra réimprimer l\'affiche.')) return
    setEnvoi(true)
    const r = await appel('generer')
    if (r.success) setCode(r.code)
    else alert(r.error || 'Erreur')
    setEnvoi(false)
  }

  async function imprimer() {
    const fenetre = window.open('', '_blank')
    if (!fenetre) return alert('Autorisez l\'ouverture des fenêtres pour imprimer l\'affiche.')
    const qr = await QRCode.toDataURL(window.location.origin + '/qr', { width: 600, margin: 1, color: { dark: '#1F2A24', light: '#FFFFFF' } })
    const prenom = echapper(seniorName?.split(' ')[0])
    fenetre.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Affiche Holiris · ${echapper(seniorName)}</title>
<style>
  @page { size: A5; margin: 12mm }
  body { font-family: 'DM Sans', system-ui, sans-serif; color: #1F2A24; text-align: center; margin: 0 }
  h1 { font-family: 'Cormorant Garamond', Georgia, serif; font-weight: 500; font-size: 30px; margin: 6px 0 4px }
  .marque { letter-spacing: 0.3em; text-transform: uppercase; font-size: 12px; color: #4A8870 }
  .sous { font-size: 15px; color: #6F7C75; margin: 0 0 14px }
  img { width: 62mm; height: 62mm }
  .code { display: inline-block; border: 2px solid #7FAF9B; border-radius: 14px; padding: 10px 22px; margin-top: 12px }
  .code small { display: block; font-size: 12px; color: #6F7C75; letter-spacing: 0.15em; text-transform: uppercase }
  .code strong { font-size: 34px; letter-spacing: 0.15em }
  ol { text-align: left; font-size: 14px; line-height: 1.7; max-width: 105mm; margin: 16px auto 0; padding-left: 20px }
  .pied { font-size: 11px; color: #9BB5AA; margin-top: 14px }
</style></head><body>
  <div class="marque">Holiris</div>
  <h1>Laissez une note pour ${prenom}</h1>
  <p class="sous">Aide à domicile, soignant, voisin : quelques mots sur votre visite</p>
  <img src="${qr}" alt="QR code Holiris">
  <div class="code"><small>Code du domicile</small><strong>${afficherCode(code)}</strong></div>
  <ol>
    <li>Scannez le QR code avec l’appareil photo de votre téléphone.</li>
    <li>Tapez le code du domicile.</li>
    <li>Choisissez votre nom, puis dictez ou écrivez votre note.</li>
  </ol>
  <p class="pied">Sans compte ni application. Urgence vitale : 15 ou 112.</p>
  <script>document.querySelector('img').onload = () => { window.print() }</script>
</body></html>`)
    fenetre.document.close()
  }

  if (chargement) return null

  return (
    <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '18px 22px', marginBottom: 24, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Note par QR code</div>
        <div style={{ fontSize: 13, color: '#6F7C75', lineHeight: 1.5 }}>
          Une affiche chez {seniorName?.split(' ')[0]} : n&apos;importe quel intervenant scanne le QR code, tape le code du domicile et laisse une note depuis son téléphone, sans compte.
        </div>
      </div>
      {code && (
        <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '0.15em', color: '#1F2A24', border: '1.5px solid #C8DDD4', borderRadius: 10, padding: '8px 14px' }}>{afficherCode(code)}</div>
      )}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {code ? (
          <>
            <button onClick={imprimer}
              style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
              Imprimer l&apos;affiche
            </button>
            <button onClick={generer} disabled={envoi}
              style={{ background: '#F4F5F5', color: '#6F7C75', border: '1px solid #E8EFEB', borderRadius: 8, padding: '9px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Changer le code
            </button>
          </>
        ) : (
          <button onClick={generer} disabled={envoi}
            style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '9px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {envoi ? 'Création…' : 'Créer le code du domicile'}
          </button>
        )}
      </div>
    </div>
  )
}
