'use client'
import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

export default function FamilleOnboarding() {
  const [etape, setEtape] = useState('choix') // choix | code | creer_senior | creer_profil
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Formulaire senior
  const [seniorNom, setSeniorNom] = useState('')
  const [seniorPrenom, setSeniorPrenom] = useState('')
  const [seniorDateNaissance, setSeniorDateNaissance] = useState('')
  const [seniorVille, setSeniorVille] = useState('')

  // Formulaire profil proche
  const [profilPrenom, setProfilPrenom] = useState('')
  const [profilNom, setProfilNom] = useState('')
  const [profilLien, setProfilLien] = useState('')
  const [seniorCreatedId, setSeniorCreatedId] = useState(null)

  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  async function activateCode() {
    if (!code.trim()) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: familleData } = await supabase
      .from('famille').select('*')
      .eq('code_acces', code.trim().toUpperCase()).limit(1)

    if (!familleData?.length) {
      setError('Code invalide. Vérifiez le message reçu.')
      setLoading(false)
      return
    }

    const famille = familleData[0]
    if (famille.user_id && famille.user_id !== user.id) {
      setError('Ce code a déjà été utilisé.')
      setLoading(false)
      return
    }

    await supabase.from('famille').update({ user_id: user.id }).eq('id', famille.id)
    router.push('/app')
  }

  async function creerSenior() {
    if (!seniorNom || !seniorPrenom || !seniorDateNaissance || !seniorVille) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    // Calculer l'âge
    const age = Math.floor((new Date() - new Date(seniorDateNaissance)) / (365.25 * 24 * 60 * 60 * 1000))

    const { data: senior, error: seniorError } = await supabase
      .from('seniors').insert({
        name: seniorPrenom + ' ' + seniorNom,
        age,
        date_naissance: seniorDateNaissance,
        city: seniorVille,
      }).select().single()

    if (seniorError) {
      setError('Erreur lors de la création du dossier.')
      setLoading(false)
      return
    }

    setSeniorCreatedId(senior.id)
    setLoading(false)
    setEtape('creer_profil')
  }

  async function creerProfil() {
    if (!profilPrenom || !profilNom || !profilLien) return
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    await supabase.from('famille').insert({
      senior_id: seniorCreatedId,
      user_id: user.id,
      name: profilPrenom + ' ' + profilNom,
      role: profilLien,
      email: user.email,
    })

    router.push('/app')
  }

  const liens = ['Fils', 'Fille', 'Petit-fils', 'Petite-fille', 'Neveu', 'Nièce', 'Conjoint(e)', 'Frère', 'Sœur', 'Autre']

  const containerStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)',
    fontFamily: "'Inter', system-ui, sans-serif", padding: '24px',
  }

  const cardStyle = {
    background: '#fff', border: '1px solid #E8EFEB', borderRadius: 16,
    padding: '40px 36px', width: '100%', maxWidth: 440,
    boxShadow: '0 4px 24px rgba(127,175,155,0.1)',
  }

  const inputStyle = {
    width: '100%', padding: '12px 14px', border: '1px solid #E8EFEB',
    borderRadius: 8, fontSize: 14, outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box', color: '#1F2A24',
    background: '#FAFCFC',
  }

  const btnPrimary = {
    width: '100%', background: '#7FAF9B', color: '#fff', border: 'none',
    borderRadius: 8, padding: '13px 0', fontSize: 14, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', marginTop: 8,
  }

  const btnSecondary = {
    width: '100%', background: 'transparent', color: '#4A8870',
    border: '1.5px solid #7FAF9B', borderRadius: 8, padding: '13px 0',
    fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
  }

  const Logo = () => (
    <div style={{ textAlign: 'center', marginBottom: 32 }}>
      <svg width="44" height="44" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 12 }}>
        <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.5" fill="none"/>
        <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.5" fill="none"/>
        <circle cx="32" cy="32" r="5" fill="#7FAF9B"/>
        <circle cx="32" cy="32" r="2.2" fill="#fff"/>
      </svg>
      <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#1F2A24', letterSpacing: '0.05em' }}>Holiris</div>
    </div>
  )

  // ── Étape 1 : choix ──
  if (etape === 'choix') return (
    <div style={containerStyle}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap');`}</style>
      <div style={cardStyle}>
        <Logo />
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: '#1F2A24', textAlign: 'center', marginBottom: 8 }}>
          Bienvenue sur Holiris
        </h2>
        <p style={{ fontSize: 13, color: '#9BB5AA', textAlign: 'center', lineHeight: 1.6, marginBottom: 32, fontWeight: 300 }}>
          Comment souhaitez-vous commencer ?
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button onClick={() => setEtape('creer_senior')} style={{ ...btnPrimary, marginTop: 0, padding: '16px 0' }}>
            Créer le dossier de mon proche
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ flex: 1, height: 1, background: '#E8EFEB' }} />
            <span style={{ fontSize: 11, color: '#C8DDD4', letterSpacing: '0.1em' }}>OU</span>
            <div style={{ flex: 1, height: 1, background: '#E8EFEB' }} />
          </div>
          <button onClick={() => setEtape('code')} style={{ ...btnSecondary }}>
            J'ai un code d'accès
          </button>
        </div>

        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a href="/login" style={{ fontSize: 12, color: '#C8DDD4', textDecoration: 'none' }}>← Retour à la connexion</a>
        </div>
      </div>
    </div>
  )

  // ── Étape 2 : code ──
  if (etape === 'code') return (
    <div style={containerStyle}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap');`}</style>
      <div style={cardStyle}>
        <Logo />
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: '#1F2A24', textAlign: 'center', marginBottom: 8 }}>
          Code d'accès
        </h2>
        <p style={{ fontSize: 13, color: '#9BB5AA', textAlign: 'center', lineHeight: 1.6, marginBottom: 28, fontWeight: 300 }}>
          Entrez le code reçu par WhatsApp pour accéder au suivi de votre proche.
        </p>

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: 8 }}>Code d'accès</label>
          <input
            placeholder="Ex: ABC123"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && activateCode()}
            style={{ ...inputStyle, fontFamily: 'monospace', letterSpacing: '0.2em', textAlign: 'center', fontSize: 16 }}
          />
        </div>

        {error && (
          <div style={{ background: '#FBECED', border: '1px solid #F2C4C8', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C4606A', marginBottom: 16 }}>
            {error}
          </div>
        )}

        <button onClick={activateCode} disabled={loading || !code.trim()} style={btnPrimary}>
          {loading ? 'Activation...' : 'Activer mon accès →'}
        </button>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button onClick={() => { setEtape('choix'); setError('') }} style={{ background: 'none', border: 'none', color: '#9BB5AA', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Retour
          </button>
        </div>
      </div>
    </div>
  )

  // ── Étape 3 : créer senior ──
  if (etape === 'creer_senior') return (
    <div style={containerStyle}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap');`}</style>
      <div style={cardStyle}>
        <Logo />
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: '#1F2A24', textAlign: 'center', marginBottom: 8 }}>
          Créer le dossier
        </h2>
        <p style={{ fontSize: 13, color: '#9BB5AA', textAlign: 'center', lineHeight: 1.6, marginBottom: 28, fontWeight: 300 }}>
          Renseignez les informations de votre proche.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Prénom</label>
              <input placeholder="Marie" value={seniorPrenom} onChange={e => setSeniorPrenom(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Nom</label>
              <input placeholder="Dupont" value={seniorNom} onChange={e => setSeniorNom(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Date de naissance</label>
            <input type="date" value={seniorDateNaissance} onChange={e => setSeniorDateNaissance(e.target.value)} style={inputStyle} />
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Ville</label>
            <input placeholder="Paris" value={seniorVille} onChange={e => setSeniorVille(e.target.value)} style={inputStyle} />
          </div>
        </div>

        {error && (
          <div style={{ background: '#FBECED', border: '1px solid #F2C4C8', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C4606A', marginTop: 14 }}>
            {error}
          </div>
        )}

        <button onClick={creerSenior} disabled={loading || !seniorNom || !seniorPrenom || !seniorDateNaissance || !seniorVille} style={{ ...btnPrimary, opacity: (!seniorNom || !seniorPrenom || !seniorDateNaissance || !seniorVille) ? 0.5 : 1 }}>
          {loading ? 'Création...' : 'Continuer →'}
        </button>

        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <button onClick={() => { setEtape('choix'); setError('') }} style={{ background: 'none', border: 'none', color: '#9BB5AA', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
            ← Retour
          </button>
        </div>
      </div>
    </div>
  )

  // ── Étape 4 : créer profil proche ──
  if (etape === 'creer_profil') return (
    <div style={containerStyle}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500&display=swap');`}</style>
      <div style={cardStyle}>
        <Logo />
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 400, color: '#1F2A24', textAlign: 'center', marginBottom: 8 }}>
          Votre profil
        </h2>
        <p style={{ fontSize: 13, color: '#9BB5AA', textAlign: 'center', lineHeight: 1.6, marginBottom: 28, fontWeight: 300 }}>
          Dossier créé ! Maintenant renseignez vos informations.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Votre prénom</label>
              <input placeholder="Jean" value={profilPrenom} onChange={e => setProfilPrenom(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Votre nom</label>
              <input placeholder="Dupont" value={profilNom} onChange={e => setProfilNom(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }}>Votre lien avec le senior</label>
            <select value={profilLien} onChange={e => setProfilLien(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
              <option value="">Sélectionner...</option>
              {liens.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{ background: '#FBECED', border: '1px solid #F2C4C8', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C4606A', marginTop: 14 }}>
            {error}
          </div>
        )}

        <button onClick={creerProfil} disabled={loading || !profilPrenom || !profilNom || !profilLien} style={{ ...btnPrimary, opacity: (!profilPrenom || !profilNom || !profilLien) ? 0.5 : 1 }}>
          {loading ? 'Création...' : 'Accéder à mon espace →'}
        </button>
      </div>
    </div>
  )
}
