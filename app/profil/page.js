'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'

export default function Profil() {
  const [user, setUser] = useState(null)
  const [famille, setFamille] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin } = useSenior()

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [lien, setLien] = useState('')
  const [whatsapp, setWhatsapp] = useState('')

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setUser(user)

      const { data: familleData } = await supabase
        .from('famille').select('*').eq('user_id', user.id).limit(1)

      if (familleData?.[0]) {
        const f = familleData[0]
        setFamille(f)
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
    let whatsappFormatted = whatsapp.replace(/\s/g, '').replace(/^0/, '+33')

    const { error } = await supabase.from('famille')
      .update({ name: prenom + ' ' + nom, role: lien, whatsapp: whatsappFormatted || null })
      .eq('user_id', user.id)

    if (!error) {
      if (whatsappFormatted && !famille?.whatsapp) {
        try {
          await fetch('/api/invite-famille', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ whatsapp: whatsappFormatted, prenom, seniorName: selectedSenior?.name })
          })
        } catch (e) { console.error('Erreur envoi message bienvenue:', e) }
      }
      setSaved(true)
      setFamille(prev => ({ ...prev, whatsapp: whatsappFormatted }))
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  const liens = [
    'Fils', 'Fille', 'Petit-fils', 'Petite-fille',
    'Neveu', 'Nièce', 'Conjoint(e)', 'Frère', 'Sœur', 'Autre'
  ]

  if (loading) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Chargement...</div>
    </div>
  )

  return (
    <Layout senior={selectedSenior} seniors={seniors} selectedSeniorId={selectedSeniorId} switchSenior={switchSenior} isAdmin={isAdmin}>
      <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>👤 Mon profil</h1>
      <p style={{ color: '#888', marginBottom: 28, fontSize: 13 }}>{user?.email}</p>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', maxWidth: 500 }}>
        <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 20 }}>Mes informations</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Prénom</label>
            <input placeholder="Votre prénom" value={prenom} onChange={e => setPrenom(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Nom</label>
            <input placeholder="Votre nom" value={nom} onChange={e => setNom(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }} />
          </div>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Lien avec {selectedSenior?.name}</label>
          <select value={lien} onChange={e => setLien(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff' }}>
            <option value="">Sélectionnez votre lien</option>
            {liens.map(l => <option key={l}>{l}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>📱 Numéro WhatsApp</label>
          <input placeholder="Ex: 06 12 34 56 78" value={whatsapp} onChange={e => setWhatsapp(e.target.value)}
            style={{ width: '100%', padding: '10px 14px', border: '1px solid #25D366', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }} />
          <div style={{ fontSize: 11, color: '#888', marginTop: 4 }}>
            💡 Renseignez votre numéro pour envoyer et recevoir des notes via WhatsApp
          </div>
        </div>
        {saved && (
          <div style={{ background: '#eafaf1', color: '#27ae60', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12, fontWeight: 'bold' }}>
            ✅ Profil sauvegardé !
          </div>
        )}
        <button onClick={saveProfil} disabled={saving || !prenom || !nom}
          style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '11px 24px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
          {saving ? 'Sauvegarde...' : 'Sauvegarder'}
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', maxWidth: 500, marginTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 8 }}>Mon proche</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ fontSize: 36 }}>👵</div>
          <div>
            <div style={{ fontWeight: 'bold', color: '#12201a' }}>{selectedSenior?.name}</div>
            <div style={{ fontSize: 13, color: '#888' }}>{selectedSenior?.age} ans · {selectedSenior?.city}</div>
            {lien && <div style={{ fontSize: 12, color: '#2ecc71', marginTop: 4 }}>Votre lien : {lien}</div>}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 500, marginTop: 16 }}>
        <button onClick={logout}
          style={{ width: '100%', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, padding: '12px 0', fontSize: 13, cursor: 'pointer', fontWeight: 'bold' }}>
          🚪 Se déconnecter
        </button>
      </div>
    </Layout>
  )
}
