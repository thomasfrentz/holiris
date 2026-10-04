'use client'
import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// Signature électronique d'un document par le senior (ou son représentant légal), au doigt,
// sur la borne ou sur la tablette d'un proche. Lien à usage unique, sans compte.

const C = { encre: '#1F2A24', gris: '#6F7C75', grisClair: '#9BB5AA', sauge: '#7FAF9B', saugeFonce: '#4A8870', saugeClair: '#EAF4EF', bord: '#E6EDE9', rose: '#FBEDEE', rouge: '#C4434F' }
const QUALITES = ['Tuteur·rice', 'Curateur·rice', 'Mandataire (mandat de protection future)', 'Habilitation familiale', 'Autre représentant légal']

function Signer() {
  const params = useSearchParams()
  const jeton = params.get('t')
  const depuisBorne = params.get('retour') === 'borne'
  const [doc, setDoc] = useState(null)
  const [etat, setEtat] = useState('chargement') // chargement | pret | envoi | signe | invalide
  const [erreur, setErreur] = useState('')
  const [choix, setChoix] = useState({})
  const [quiSigne, setQuiSigne] = useState('personne')
  const [nomRepresentant, setNomRepresentant] = useState('')
  const [qualite, setQualite] = useState('')
  const [accepte, setAccepte] = useState(false)
  const [traceVide, setTraceVide] = useState(true)
  const canvasRef = useRef(null)
  const dessinRef = useRef(false)

  useEffect(() => {
    fetch('/api/signer?t=' + encodeURIComponent(jeton || ''))
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.contenu) { setDoc(d); setEtat('pret') } else setEtat('invalide') })
      .catch(() => setEtat('invalide'))
  }, [jeton])

  // Zone de signature : trait au doigt ou à la souris, net sur les écrans haute définition
  useEffect(() => {
    const canvas = canvasRef.current
    if (etat !== 'pret' || !canvas) return
    const ratio = window.devicePixelRatio || 1
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1F2A24'
  }, [etat])

  const point = e => { const r = canvasRef.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top] }
  const debut = e => { e.preventDefault(); canvasRef.current.setPointerCapture(e.pointerId); dessinRef.current = true; const ctx = canvasRef.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...point(e)) }
  const trait = e => { if (!dessinRef.current) return; const ctx = canvasRef.current.getContext('2d'); ctx.lineTo(...point(e)); ctx.stroke(); setTraceVide(false) }
  const fin = () => { dessinRef.current = false }
  const effacer = () => { const c = canvasRef.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setTraceVide(true) }

  const autorisations = doc?.contenu.autorisations || []
  const nomSignataire = quiSigne === 'personne' ? doc?.contenu.senior : nomRepresentant.trim()
  const pret = accepte && !traceVide && nomSignataire && (quiSigne === 'personne' || qualite) && autorisations.every(a => typeof choix[a.cle] === 'boolean')

  async function signer() {
    setErreur('')
    setEtat('envoi')
    try {
      const res = await fetch('/api/signer', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ t: jeton, signataireNom: nomSignataire, qualite: quiSigne === 'personne' ? 'personne' : qualite, choix, signature: canvasRef.current.toDataURL('image/png'), accepte }),
      })
      const r = await res.json()
      if (r.success) { setEtat('signe'); return }
      setErreur(r.error || 'La signature n’a pas pu être enregistrée.')
    } catch { setErreur('Pas de connexion Internet. Réessayez.') }
    setEtat('pret')
  }

  const page = contenu => (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #FDFBF7 0%, #F7F2EA 55%, #F4EEF6 100%)', fontFamily: 'var(--font-body), "DM Sans", sans-serif', color: C.encre, padding: '28px 16px 48px' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>{contenu}</div>
    </div>
  )
  const carte = { background: '#fff', borderRadius: 20, padding: '22px 24px', boxShadow: '0 6px 20px rgba(74,60,40,0.06)', marginBottom: 16 }
  const choixBouton = (actif, couleur) => ({ flex: 1, padding: '14px', borderRadius: 14, border: `2px solid ${actif ? couleur : C.bord}`, background: actif ? (couleur === C.sauge ? C.saugeClair : C.rose) : '#fff', color: actif ? (couleur === C.sauge ? C.saugeFonce : C.rouge) : C.gris, fontSize: 17, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' })

  if (etat === 'chargement') return page(<p style={{ textAlign: 'center', color: C.grisClair }}>Chargement…</p>)
  if (etat === 'invalide') return page(
    <div style={{ ...carte, textAlign: 'center' }}>
      <h1 style={{ fontFamily: 'var(--font-display), serif', fontSize: 30, fontWeight: 500, marginBottom: 10 }}>Lien de signature expiré</h1>
      <p style={{ fontSize: 16, color: C.gris, lineHeight: 1.6 }}>Ce document a déjà été signé, ou le lien n&apos;est plus valable. Demandez un nouveau lien depuis la page Documents de l&apos;espace Holiris.</p>
      {depuisBorne && <a href="/borne?documents=1" style={{ display: 'inline-block', marginTop: 20, color: C.saugeFonce, fontSize: 17 }}>← Retour à la borne</a>}
    </div>
  )
  if (etat === 'signe') return page(
    <div style={{ ...carte, textAlign: 'center', padding: '40px 24px' }}>
      <div style={{ width: 96, height: 96, borderRadius: '50%', background: C.saugeClair, color: C.saugeFonce, fontSize: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>✓</div>
      <h1 style={{ fontFamily: 'var(--font-display), serif', fontSize: 34, fontWeight: 500, marginBottom: 10 }}>Document signé</h1>
      <p style={{ fontSize: 17, color: C.gris, lineHeight: 1.6 }}>Merci. Une copie a été envoyée par email à la famille, et le document est disponible dans la page Documents.</p>
      {depuisBorne && <a href="/borne?documents=1" style={{ display: 'inline-block', marginTop: 24, background: C.sauge, color: '#fff', borderRadius: 16, padding: '16px 32px', fontSize: 18, fontWeight: 600, textDecoration: 'none' }}>Continuer</a>}
    </div>
  )

  const c = doc.contenu
  return page(<>
    {depuisBorne && <a href="/borne?documents=1" style={{ display: 'inline-block', marginBottom: 16, background: '#fff', border: `1px solid ${C.bord}`, borderRadius: 999, padding: '10px 18px', fontSize: 15, color: C.gris, textDecoration: 'none' }}>← Retour</a>}
    <div style={{ textAlign: 'center', marginBottom: 20 }}>
      <div style={{ fontSize: 13, letterSpacing: '0.18em', textTransform: 'uppercase', color: C.grisClair }}>Document à signer · {c.senior}</div>
      <h1 style={{ fontFamily: 'var(--font-display), serif', fontSize: 36, fontWeight: 500, lineHeight: 1.15, marginTop: 6 }}>{c.titre}</h1>
    </div>

    <div style={carte}>
      {c.sections.map((s, i) => (
        <div key={i} style={{ marginBottom: 14 }}>
          {s.titre && <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{s.titre}</div>}
          <p style={{ fontSize: 17, lineHeight: 1.65, color: '#3A4540' }}>{s.texte}</p>
        </div>
      ))}
      {autorisations.map(a => (
        <div key={a.cle} style={{ borderTop: `1px solid ${C.bord}`, paddingTop: 14, marginTop: 14 }}>
          <p style={{ fontSize: 17, lineHeight: 1.6, marginBottom: 10 }}>{a.libelle}</p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => setChoix({ ...choix, [a.cle]: true })} style={choixBouton(choix[a.cle] === true, C.sauge)}>Oui, j&apos;accepte</button>
            <button onClick={() => setChoix({ ...choix, [a.cle]: false })} style={choixBouton(choix[a.cle] === false, C.rouge)}>Non</button>
          </div>
        </div>
      ))}
    </div>

    <div style={carte}>
      <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 10 }}>Qui signe ?</div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setQuiSigne('personne')} style={choixBouton(quiSigne === 'personne', C.sauge)}>{c.senior}</button>
        <button onClick={() => setQuiSigne('representant')} style={choixBouton(quiSigne === 'representant', C.sauge)}>Son représentant légal</button>
      </div>
      {quiSigne === 'representant' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <input placeholder="Prénom et nom du représentant" value={nomRepresentant} onChange={e => setNomRepresentant(e.target.value)}
            style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${C.bord}`, fontSize: 17, fontFamily: 'inherit', outline: 'none' }} />
          <select value={qualite} onChange={e => setQualite(e.target.value)}
            style={{ padding: '14px 16px', borderRadius: 12, border: `1px solid ${C.bord}`, fontSize: 17, fontFamily: 'inherit', background: '#fff' }}>
            <option value="">Qualité du représentant</option>
            {QUALITES.map(q => <option key={q}>{q}</option>)}
          </select>
        </div>
      )}
    </div>

    <div style={carte}>
      <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 17, lineHeight: 1.5, cursor: 'pointer' }}>
        <input type="checkbox" checked={accepte} onChange={e => setAccepte(e.target.checked)} style={{ width: 26, height: 26, marginTop: 1, accentColor: C.sauge, flexShrink: 0 }} />
        <span>{c.engagement}</span>
      </label>
      <div style={{ fontSize: 15, color: C.gris, margin: '18px 0 8px' }}>Signez avec le doigt dans le cadre :</div>
      <canvas ref={canvasRef} onPointerDown={debut} onPointerMove={trait} onPointerUp={fin} onPointerLeave={fin}
        style={{ width: '100%', height: 200, border: `2px dashed ${C.grisClair}`, borderRadius: 16, background: '#FCFCFB', touchAction: 'none', display: 'block' }} />
      <button onClick={effacer} style={{ marginTop: 8, background: 'none', border: 'none', color: C.gris, fontSize: 15, textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit' }}>Effacer la signature</button>
    </div>

    {erreur && <div style={{ background: C.rose, borderRadius: 14, padding: '12px 16px', color: '#8E2F38', fontSize: 15, marginBottom: 14 }}>{erreur}</div>}
    <button onClick={signer} disabled={!pret || etat === 'envoi'}
      style={{ width: '100%', background: C.sauge, color: '#fff', border: 'none', borderRadius: 18, padding: '20px', fontSize: 19, fontWeight: 600, cursor: pret ? 'pointer' : 'default', fontFamily: 'inherit', opacity: pret ? 1 : 0.5 }}>
      {etat === 'envoi' ? 'Enregistrement…' : 'Signer le document'}
    </button>
    <p style={{ fontSize: 13, color: C.grisClair, textAlign: 'center', marginTop: 12 }}>La signature, la date et l&apos;heure sont enregistrées avec le texte exact du document.</p>
  </>)
}

export default function Page() {
  return <Suspense><Signer /></Suspense>
}
