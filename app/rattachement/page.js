'use client'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

// Réponse d'un proche à la demande d'une structure de rejoindre le dossier d'un senior.
// Lien reçu par email, sans compte, utilisable une fois.

const C = { encre: '#1F2A24', gris: '#6F7C75', grisClair: '#9BB5AA', sauge: '#7FAF9B', saugeFonce: '#4A8870', saugeClair: '#EAF4EF', bord: '#E8EFEB', rouge: '#C4606A' }

function Rattachement() {
  const jeton = useSearchParams().get('t')
  const [demande, setDemande] = useState(null)
  const [etat, setEtat] = useState('chargement') // chargement | pret | envoi | acceptee | refusee | invalide
  const [erreur, setErreur] = useState('')

  useEffect(() => {
    fetch('/api/rattachement?t=' + encodeURIComponent(jeton || ''))
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        if (!d) { setEtat('invalide'); return }
        setDemande(d)
        setEtat(d.statut === 'en_attente' ? 'pret' : d.statut)
      })
      .catch(() => setEtat('invalide'))
  }, [jeton])

  async function repondre(decision) {
    setErreur(''); setEtat('envoi')
    const r = await fetch('/api/rattachement', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: jeton, decision }) })
      .then(res => res.json()).catch(() => ({}))
    if (!r.success) { setErreur(r.error || 'Une erreur est survenue, réessayez.'); setEtat('pret'); return }
    setEtat(r.accepte ? 'acceptee' : 'refusee')
  }

  const btn = { width: '100%', border: 'none', borderRadius: 8, padding: '13px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', fontFamily: "'Inter', system-ui, sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500&display=swap');`}</style>
      <div style={{ background: '#fff', border: '1px solid ' + C.bord, borderRadius: 16, padding: '40px 36px', width: '100%', maxWidth: 440, textAlign: 'center', boxShadow: '0 4px 24px rgba(127,175,155,0.1)' }}>
        <svg width="44" height="44" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 16 }} aria-hidden="true">
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.5" />
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.5" />
          <circle cx="32" cy="32" r="5" fill="#7FAF9B" />
          <circle cx="32" cy="32" r="2.2" fill="#fff" />
        </svg>

        {etat === 'chargement' && <p style={{ color: C.grisClair, fontSize: 14 }}>Chargement…</p>}

        {etat === 'invalide' && (<>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: C.encre, marginBottom: 10 }}>Lien expiré</div>
          <p style={{ fontSize: 14, color: C.gris, lineHeight: 1.6 }}>Ce lien n&apos;est plus valable. En cas de question : <a href="mailto:thomas.frentz@holiris.fr" style={{ color: C.saugeFonce }}>thomas.frentz@holiris.fr</a></p>
        </>)}

        {(etat === 'pret' || etat === 'envoi') && demande && (<>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: C.encre, marginBottom: 20 }}>Demande d&apos;une structure</div>
          <div style={{ background: C.saugeClair, border: '1px solid #C8DDD4', borderRadius: 10, padding: '16px 20px', marginBottom: 20, textAlign: 'left', fontSize: 14, color: C.gris, lineHeight: 1.6 }}>
            <strong style={{ color: C.encre }}>{demande.structure}</strong> demande à rejoindre le dossier Holiris de <strong style={{ color: C.encre }}>{demande.senior}</strong>.
          </div>
          <p style={{ fontSize: 13, color: C.gris, lineHeight: 1.6, marginBottom: 24, textAlign: 'left' }}>
            Si vous acceptez, ses gestionnaires pourront suivre les notes, l&apos;agenda et les alertes de {demande.senior}, et affecter leurs salariés intervenants au dossier.
          </p>
          {erreur && <div style={{ background: '#FBECED', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: C.rouge, marginBottom: 14 }}>{erreur}</div>}
          <button onClick={() => repondre('accepter')} disabled={etat === 'envoi'} style={{ ...btn, background: C.sauge, color: '#fff', marginBottom: 10 }}>
            {etat === 'envoi' ? '…' : 'Accepter'}
          </button>
          <button onClick={() => repondre('refuser')} disabled={etat === 'envoi'} style={{ ...btn, background: '#fff', color: C.gris, border: '1.5px solid ' + C.bord }}>
            Refuser
          </button>
        </>)}

        {etat === 'acceptee' && (<>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: C.saugeFonce, marginBottom: 10 }}>Demande acceptée ✓</div>
          <p style={{ fontSize: 14, color: C.gris, lineHeight: 1.6 }}>{demande?.structure} suit désormais le dossier de {demande?.senior}. Pour revenir sur ce choix, écrivez à <a href="mailto:thomas.frentz@holiris.fr" style={{ color: C.saugeFonce }}>thomas.frentz@holiris.fr</a>.</p>
        </>)}

        {etat === 'refusee' && (<>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, color: C.encre, marginBottom: 10 }}>Demande refusée</div>
          <p style={{ fontSize: 14, color: C.gris, lineHeight: 1.6 }}>Rien ne change : {demande?.structure} n&apos;a pas accès au dossier de {demande?.senior}.</p>
        </>)}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense fallback={null}><Rattachement /></Suspense>
}
