'use client'
import { useState, Suspense } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter, useSearchParams } from 'next/navigation'

// Lien « mot de passe oublié » : le jeton n'est utilisé qu'à l'enregistrement du nouveau mot de passe
// (pas à l'ouverture de la page, que les messageries peuvent visiter d'avance pour en faire un aperçu)
function NouveauMotDePasse() {
  const [motDePasse, setMotDePasse] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [erreur, setErreur] = useState('')
  const [chargement, setChargement] = useState(false)
  const router = useRouter()
  const tokenHash = useSearchParams().get('token_hash')
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)

  async function enregistrer() {
    setErreur('')
    if (motDePasse.length < 6) return setErreur('Le mot de passe doit contenir au moins 6 caractères.')
    if (motDePasse !== confirmation) return setErreur('Les deux mots de passe ne correspondent pas.')
    setChargement(true)
    const { data, error } = await supabase.auth.verifyOtp({ type: 'recovery', token_hash: tokenHash })
    if (error || !data?.user) {
      setErreur('Ce lien a expiré ou a déjà été utilisé. Refaites une demande depuis « Mot de passe oublié ».')
      setChargement(false)
      return
    }
    const { error: errMaj } = await supabase.auth.updateUser({ password: motDePasse })
    if (errMaj) {
      setErreur(/different|same/i.test(errMaj.message) ? 'Choisissez un mot de passe différent de l\'ancien.' : 'Le mot de passe n\'a pas pu être enregistré.')
      setChargement(false)
      return
    }
    // Arrivée dans son espace, comme après une connexion
    const uid = data.user.id
    const [{ data: g }, { data: i }, { data: f }] = await Promise.all([
      supabase.from('structure_membres').select('id').eq('user_id', uid).limit(1),
      supabase.from('intervenants').select('id').eq('user_id', uid).is('archived_at', null).limit(1),
      supabase.from('famille').select('id').eq('user_id', uid).is('archived_at', null).limit(1),
    ])
    router.push(g?.length ? '/structure' : i?.length ? '/espace-intervenant' : f?.length ? '/app' : '/famille-onboarding')
  }

  const champ = { width: '100%', padding: '12px 16px', background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(107,143,113,0.3)', borderRadius: 2, color: '#FAFCFA', fontSize: 14, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }
  const etiquette = { fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#9AB89F', display: 'block', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1E2820', fontFamily: 'var(--font-body, DM Sans, sans-serif)', padding: 16 }}>
      <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 4, padding: '48px 40px', width: '100%', maxWidth: 400 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 32, fontWeight: 300, color: '#FAFCFA', letterSpacing: '0.12em', marginBottom: 8 }}>
            Hol<span style={{ color: '#9AB89F', fontStyle: 'italic' }}>iris</span>
          </h1>
          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>NOUVEAU MOT DE PASSE</p>
        </div>
        {!tokenHash ? (
          <p style={{ color: '#e0939a', fontSize: 14, textAlign: 'center' }}>Lien incomplet. Refaites une demande depuis « Mot de passe oublié ».</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={etiquette}>Nouveau mot de passe</label>
              <input type="password" placeholder="6 caractères minimum" value={motDePasse} onChange={e => setMotDePasse(e.target.value)} style={champ} />
            </div>
            <div>
              <label style={etiquette}>Confirmer</label>
              <input type="password" value={confirmation} onChange={e => setConfirmation(e.target.value)} onKeyDown={e => e.key === 'Enter' && enregistrer()} style={champ} />
            </div>
            {erreur && <div style={{ background: 'rgba(196,122,130,0.15)', border: '1px solid rgba(196,122,130,0.3)', borderRadius: 2, padding: '10px 14px', fontSize: 13, color: '#e0939a' }}>{erreur}</div>}
            <button onClick={enregistrer} disabled={chargement || !motDePasse || !confirmation}
              style={{ background: '#6B8F71', color: '#FAFCFA', border: 'none', borderRadius: 2, padding: '13px 0', fontSize: 13, fontWeight: 500, letterSpacing: '0.06em', cursor: 'pointer', marginTop: 8, opacity: motDePasse && confirmation ? 1 : 0.6 }}>
              {chargement ? 'Enregistrement…' : 'Enregistrer et me connecter'}
            </button>
            <a href="/login" style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>← Retour à la connexion</a>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Page() {
  return <Suspense><NouveauMotDePasse /></Suspense>
}
