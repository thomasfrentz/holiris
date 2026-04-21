'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

const ADMIN_PASSWORD = 'holiris2024'

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [seniors, setSeniors] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState(null)

  // Formulaire nouveau senior
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [city, setCity] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    if (authenticated) loadSeniors()
  }, [authenticated])

  async function loadSeniors() {
    const { data } = await supabase
      .from('seniors')
      .select('*, famille(name, email)')
      .order('created_at', { ascending: false })
    setSeniors(data || [])
  }

  function generateCode(name) {
    const prefix = name.split(' ').pop().toUpperCase().slice(0, 4)
    const year = new Date().getFullYear()
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0')
    return `${prefix}-${year}-${random}`
  }

  async function createSenior() {
    if (!name || !age || !city) return
    setLoading(true)

    const invite_code = generateCode(name)

    const { data, error } = await supabase
      .from('seniors')
      .insert({ name, age: parseInt(age), city, status: 'stable', invite_code })
      .select()

    if (!error) {
      setName('')
      setAge('')
      setCity('')
      setShowForm(false)
      loadSeniors()
    }
    setLoading(false)
  }

  function copyCode(code) {
    navigator.clipboard.writeText(code)
    setCopied(code)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!authenticated) {
    return (
      <div style={{ minHeight: '100vh', background: '#12201a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif' }}>
        <div style={{ background: '#fff', borderRadius: 16, padding: 40, width: 340, textAlign: 'center' }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>🔐</div>
          <h1 style={{ fontSize: 20, fontWeight: 'bold', color: '#12201a', marginBottom: 20 }}>Espace Admin Holiris</h1>
          <input
            type="password"
            placeholder="Mot de passe admin"
            value={adminPassword}
            onChange={e => setAdminPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && adminPassword === ADMIN_PASSWORD && setAuthenticated(true)}
            style={{ width: '100%', padding: '12px 16px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, outline: 'none', boxSizing: 'border-box', marginBottom: 12, fontFamily: 'Georgia, serif' }}
          />
          <button
            onClick={() => adminPassword === ADMIN_PASSWORD ? setAuthenticated(true) : alert('Mot de passe incorrect')}
            style={{ width: '100%', background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '12px 0', fontSize: 15, fontWeight: 'bold', cursor: 'pointer' }}
          >
            Accéder
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f4f1ec', fontFamily: 'Georgia, serif' }}>
      <header style={{ background: '#12201a', padding: '16px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: '#2ecc71', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#12201a', fontSize: 16 }}>H</div>
          <div style={{ color: '#fff', fontWeight: 'bold', fontSize: 18 }}>Holiris Admin</div>
        </div>
        <div style={{ color: '#5a8a6a', fontSize: 13 }}>{seniors.length} dossier{seniors.length > 1 ? 's' : ''}</div>
      </header>

      <div style={{ padding: 28 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a' }}>Dossiers seniors</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
          >
            + Nouveau dossier
          </button>
        </div>

        {showForm && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>Nouveau senior</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 16 }}>
              <input
                placeholder="Nom complet"
                value={name}
                onChange={e => setName(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }}
              />
              <input
                placeholder="Âge"
                type="number"
                value={age}
                onChange={e => setAge(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }}
              />
              <input
                placeholder="Ville"
                value={city}
                onChange={e => setCity(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }}
              />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={createSenior}
                disabled={loading || !name || !age || !city}
                style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
              >
                {loading ? 'Création...' : 'Créer le dossier'}
              </button>
              <button
                onClick={() => setShowForm(false)}
                style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}
              >
                Annuler
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {seniors.map((s) => (
            <div key={s.id} style={{ background: '#fff', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ fontSize: 32 }}>👴</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 16, color: '#12201a' }}>{s.name}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{s.age} ans · {s.city}</div>
                {s.famille?.length > 0 && (
                  <div style={{ fontSize: 12, color: '#2ecc71', marginTop: 4 }}>
                    👨‍👩‍👧 {s.famille.map(f => f.name).join(', ')}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>Code d'invitation</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ background: '#f0f4f0', borderRadius: 8, padding: '6px 12px', fontSize: 14, fontWeight: 'bold', color: '#12201a', letterSpacing: 1 }}>
                    {s.invite_code}
                  </div>
                  <button
                    onClick={() => copyCode(s.invite_code)}
                    style={{ background: copied === s.invite_code ? '#2ecc71' : '#12201a', color: copied === s.invite_code ? '#12201a' : '#2ecc71', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}
                  >
                    {copied === s.invite_code ? '✓ Copié !' : 'Copier'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
