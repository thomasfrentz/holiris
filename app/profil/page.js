'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Profil() {
  const [user, setUser] = useState(null)
  const [senior, setSenior] = useState(null)
  const [famille, setFamille] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
        .from('famille')
        .select('*')
        .eq('user_id', user.id)
        .limit(1)

      if (familleData?.[0]) {
        const f = familleData[0]
        setFamille(f)
        const parts = (f.name || '').split(' ')
        setPrenom(parts[0] || '')
        setNom(parts.slice(1).join(' ') || '')
        setLien(f.role || '')
        setWhatsapp(f.whatsapp || '')
      }

      const { data: seniors } = await supabase
        .from('seniors')
        .select('*')
        .eq('id', familleData?.[0]?.senior_id)
      setSenior(seniors?.[0])

      setLoading(false)
    }
    loadData()
  }, [])

  async function saveProfil() {
    if (!prenom || !nom) return
    setSaving(true)

    let whatsappFormatted = whatsapp.replace(/\s/g, '').replace(/^0/, '+33')

    const { error } = await supabase
      .from('famille')
      .update({
        name: prenom + ' ' + nom,
        role: lien,
        whatsapp: whatsappFormatted || null
      })
      .eq('user_id', user.id)

    if (!error) {
      // Envoyer message de bienvenue si numéro renseigné pour la première fois
      if (whatsappFormatted && !famille?.whatsapp) {
        try {
          await fetch('/api/invite-famille', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              whatsapp: whatsappFormatted,
              prenom,
              seniorName: senior?.name
            })
          })
          console.log('Message de bienvenue envoyé')
        } catch (e) {
          console.error('Erreur envoi message bienvenue:', e)
        }
      }

      setSaved(true)
      setFamille(prev => ({ ...prev, whatsapp: whatsappFormatted }))
      setTimeout(() => setSaved(false), 3000)
    }
    setSaving(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    window.location.href = '/login'
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
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <aside style={{ width: 260, background: '#12201a', color: '#e8f0eb', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 42, height: 42, background: '#2ecc71', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#12201a', fontSize: 18 }}>H</div>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: 18 }}>Holiris</div>
            <div style={{ fontSize: 10, color: '#5a8a6a', letterSpacing: 1 }}>PYRÉNÉES-ORIENTALES</div>
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
          <div style={{ fontSize: 28, marginBottom: 6 }}>👵</div>
          <div style={{ fontWeight: 'bold' }}>{senior?.name}</div>
          <div style={{ fontSize: 12, color: '#7aaa8a', marginTop: 2 }}>{senior?.age} ans · {senior?.city}</div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {[
            { icon: '⚡', label: 'Flux en temps réel', href: '/' },
            { icon: '📅', label: 'Agenda', href: '/agenda' },
            { icon: '📝', label: 'Carnet de suivi', href: '/carnet' },
            { icon: '👥', label: 'Intervenants', href: '/intervenants' },
            { icon: '🤖', label: 'Assistant IA', href: '/assistant' },
            { icon: '👤', label: 'Mon profil', href: '/profil' },
          ].map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                color: item.href === '/profil' ? '#2ecc71' : '#9abaa8',
                background: item.href === '/profil' ? 'rgba(46,204,113,0.15)' : 'none',
                fontWeight: item.href === '/profil' ? 'bold' : 'normal',
                cursor: 'pointer', fontSize: 14
              }}>
                <span>{item.icon}</span>{item.label}
              </div>
            </Link>
          ))}
        </nav>

        <div style={{ marginTop: 'auto' }}>
          <button onClick={logout}
            style={{ width: '100%', background: 'rgba(231,76,60,0.15)', color: '#ff8070', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 8, padding: '10px 0', fontSize: 13, cursor: 'pointer', fontWeight: 'bold' }}>
            🚪 Se déconnecter
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
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
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>
              Lien avec {senior?.name}
            </label>
            <select value={lien} onChange={e => setLien(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff' }}>
              <option value="">Sélectionnez votre lien</option>
              {liens.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>
              📱 Numéro WhatsApp
            </label>
            <input
              placeholder="Ex: 06 12 34 56 78"
              value={whatsapp}
              onChange={e => setWhatsapp(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #25D366', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }}
            />
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
              <div style={{ fontWeight: 'bold', color: '#12201a' }}>{senior?.name}</div>
              <div style={{ fontSize: 13, color: '#888' }}>{senior?.age} ans · {senior?.city}</div>
              {lien && <div style={{ fontSize: 12, color: '#2ecc71', marginTop: 4 }}>Votre lien : {lien}</div>}
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
