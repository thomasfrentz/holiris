'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'

export default function Profil() {
  const [user, setUser] = useState(null)
  const [familles, setFamilles] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin } = useSenior()

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [lien, setLien] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  // Ajouter un senior
  const [showAddSenior, setShowAddSenior] = useState(false)
  const [addMode, setAddMode] = useState(null) // 'creer'
  const [seniorPrenom, setSeniorPrenom] = useState('')
  const [seniorNom, setSeniorNom] = useState('')
  const [seniorDate, setSeniorDate] = useState('')
  const [seniorVille, setSeniorVille] = useState('')
  const [seniorLien, setSeniorLien] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const liens = ['Fils', 'Fille', 'Petit-fils', 'Petite-fille', 'Neveu', 'Nièce', 'Conjoint(e)', 'Frère', 'Sœur', 'Autre']

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: familleData } = await supabase
        .from('famille').select('*').eq('user_id', user.id)

      if (familleData?.length) {
        setFamilles(familleData)
        const f = familleData[0]
        const parts = (f.name || '').split(' ')
        setPrenom(parts[0] || '')
        setNom(parts.slice(1).join(' ') || '')
        setLien(f.role || '')
        setWhatsapp(f.whatsapp || '')
      }
      setLoading(false)
    }
    loadData()
  }, [])

  async function saveProfil() {
    if (!prenom || !nom) return
    setSaving(true)
    const whatsappFormatted = whatsapp.replace(/\s/g, '').replace(/^0/, '+33')

    await supabase.from('famille')
      .update({ name: prenom + ' ' + nom, role: lien, whatsapp: whatsappFormatted || null })
      .eq('user_id', user.id)

    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
    setSaving(false)
  }

  async function creerSenior() {
    if (!seniorPrenom || !seniorNom || !seniorDate || !seniorVille || !seniorLien) return
    setCreateLoading(true)

    // Le serveur crée le senior et la fiche famille ensemble
    const res = await fetch('/api/dossier', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        seniorPrenom, seniorNom, seniorDateNaissance: seniorDate, seniorVille,
        profilNom: prenom + ' ' + nom, profilLien: seniorLien,
      })
    })
    const result = await res.json()
    if (!result.success) { setCreateLoading(false); return }

    setShowAddSenior(false)
    setAddMode(null)
    window.location.reload()
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px', border: '1px solid #E8EFEB',
    borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit',
    boxSizing: 'border-box', background: '#FAFCFC', color: '#1F2A24',
  }

  const labelStyle = {
    fontSize: 11, fontWeight: 600, color: '#7FAF9B',
    letterSpacing: '0.12em', textTransform: 'uppercase',
    display: 'block', marginBottom: 6,
  }

  const cardStyle = {
    background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12,
    padding: '24px', maxWidth: 520, marginBottom: 16,
  }

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA' }}>Chargement...</div>
    </div>
  )

  return (
    <Layout senior={selectedSenior} seniors={seniors} selectedSeniorId={selectedSeniorId} switchSenior={switchSenior} isAdmin={isAdmin}>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Compte</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>Mon profil</h1>
        <p style={{ color: '#9BB5AA', fontSize: 13, marginTop: 6 }}>{user?.email}</p>
      </div>

      {/* Mes informations */}
      <div style={cardStyle}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Mes informations</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Prénom</label>
            <input placeholder="Votre prénom" value={prenom} onChange={e => setPrenom(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Nom</label>
            <input placeholder="Votre nom" value={nom} onChange={e => setNom(e.target.value)} style={inputStyle} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Lien avec {selectedSenior?.name}</label>
          <select value={lien} onChange={e => setLien(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">Sélectionnez votre lien</option>
            {liens.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={labelStyle}>Numéro WhatsApp</label>
          <input placeholder="Ex: 06 12 34 56 78" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
            style={{ ...inputStyle, borderColor: '#C8DDD4' }} />
          <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 4 }}>
            Renseignez votre numéro pour envoyer et recevoir des notes via WhatsApp
          </div>
        </div>
        {saved && (
          <div style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
            Profil sauvegardé ✓
          </div>
        )}
        <button onClick={saveProfil} disabled={saving || !prenom || !nom}
          style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!prenom || !nom) ? 0.5 : 1 }}>
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      {/* Mes proches */}
      <div style={cardStyle}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Mes proches</div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {seniors.map(s => (
            <div key={s.id} style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px',
              background: s.id === selectedSeniorId ? '#EAF4EF' : '#F7F9F8',
              border: '1px solid ' + (s.id === selectedSeniorId ? '#C8DDD4' : '#E8EFEB'),
              borderRadius: 10, cursor: seniors.length > 1 ? 'pointer' : 'default',
            }} onClick={() => seniors.length > 1 && switchSenior(s.id)}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: s.id === selectedSeniorId ? '#7FAF9B' : '#E8EFEB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                👵
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 17, fontWeight: 500, color: '#1F2A24' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#9BB5AA' }}>{s.age} ans · {s.city}</div>
              </div>
              {s.id === selectedSeniorId && (
                <div style={{ fontSize: 10, color: '#4A8870', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Actif</div>
              )}
            </div>
          ))}
        </div>

        {/* Ajouter un senior */}
        {!showAddSenior ? (
          <button onClick={() => setShowAddSenior(true)}
            style={{ background: 'none', border: '1px dashed #C8DDD4', borderRadius: 8, padding: '10px 16px', fontSize: 13, color: '#9BB5AA', cursor: 'pointer', width: '100%', fontFamily: 'inherit' }}>
            + Ajouter un proche
          </button>
        ) : (
          <div style={{ background: '#F7F9F8', border: '1px solid #E8EFEB', borderRadius: 10, padding: 16 }}>
            {!addMode ? (
              <>
                <div style={{ fontSize: 13, color: '#6F7C75', marginBottom: 12, textAlign: 'center' }}>Comment souhaitez-vous ajouter ce proche ?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => setAddMode('creer')}
                    style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Créer un nouveau dossier
                  </button>
                  <div style={{ fontSize: 12, color: '#9BB5AA', textAlign: 'center', lineHeight: 1.5 }}>
                    Invité(e) par un proche ? Cliquez sur le lien reçu par email.
                  </div>
                  <button onClick={() => { setShowAddSenior(false); setAddMode(null) }}
                    style={{ background: 'none', border: 'none', color: '#9BB5AA', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', marginTop: 4 }}>
                    Annuler
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 12 }}>Nouveau dossier</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Prénom</label>
                    <input placeholder="Marie" value={seniorPrenom} onChange={e => setSeniorPrenom(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Nom</label>
                    <input placeholder="Dupont" value={seniorNom} onChange={e => setSeniorNom(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Date de naissance</label>
                    <input type="date" value={seniorDate} onChange={e => setSeniorDate(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ ...labelStyle, fontSize: 10 }}>Ville</label>
                    <input placeholder="Paris" value={seniorVille} onChange={e => setSeniorVille(e.target.value)} style={inputStyle} />
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ ...labelStyle, fontSize: 10 }}>Votre lien</label>
                  <select value={seniorLien} onChange={e => setSeniorLien(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">Sélectionner...</option>
                    {liens.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={creerSenior} disabled={createLoading || !seniorPrenom || !seniorNom || !seniorDate || !seniorVille || !seniorLien}
                    style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flex: 1, opacity: (!seniorPrenom || !seniorNom || !seniorDate || !seniorVille || !seniorLien) ? 0.5 : 1 }}>
                    {createLoading ? 'Création...' : 'Créer →'}
                  </button>
                  <button onClick={() => setAddMode(null)}
                    style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    ←
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* Déconnexion */}
      <div style={{ maxWidth: 520 }}>
        <button onClick={logout}
          style={{ width: '100%', background: '#FBECED', color: '#C4606A', border: '1px solid #F2C4C8', borderRadius: 8, padding: '12px 0', fontSize: 13, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
          Se déconnecter
        </button>
      </div>

    </Layout>
  )
}
