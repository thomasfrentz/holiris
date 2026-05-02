'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

const ADMIN_PASSWORD = 'holiris2024'

function calculerAge(dateNaissance) {
  if (!dateNaissance) return null
  return Math.floor((new Date() - new Date(dateNaissance)) / (365.25 * 24 * 60 * 60 * 1000))
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false)
  const [adminPassword, setAdminPassword] = useState('')
  const [seniors, setSeniors] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState(null)

  // Formulaire nouveau senior
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
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
    setSeniors((data || []).map(s => ({
      ...s,
      age: s.date_naissance ? calculerAge(s.date_naissance) : s.age
    })))
  }

  function generateCode(name) {
    const prefix = name.split(' ').pop().toUpperCase().slice(0, 4)
    const year = new Date().getFullYear()
    const random = Math.floor(Math.random() * 999).toString().padStart(3, '0')
    return `${prefix}-${year}-${random}`
  }

  async function createSenior() {
    if (!prenom || !nom || !dateNaissance || !city) return
    setLoading(true)

    const fullName = prenom + ' ' + nom
    const age = calculerAge(dateNaissance)
    const invite_code = generateCode(fullName)

    const { error } = await supabase
      .from('seniors')
      .insert({ name: fullName, age, date_naissance: dateNaissance, city, status: 'stable', invite_code })

    if (!error) {
      setPrenom(''); setNom(''); setDateNaissance(''); setCity('')
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

  const inputStyle = {
    padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8,
    fontSize: 14, outline: 'none', fontFamily: "'Inter', sans-serif",
    background: '#FAFCFC', color: '#1F2A24', width: '100%', boxSizing: 'border-box',
  }

  // ── Auth ──
  if (!authenticated) return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500;600&display=swap');`}</style>
      <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 16, padding: '40px 36px', width: 360, textAlign: 'center', boxShadow: '0 4px 24px rgba(127,175,155,0.1)' }}>
        <svg width="44" height="44" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 16 }}>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.5" fill="none"/>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.5" fill="none"/>
          <circle cx="32" cy="32" r="5" fill="#7FAF9B"/>
          <circle cx="32" cy="32" r="2.2" fill="#fff"/>
        </svg>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#1F2A24', marginBottom: 4 }}>Holiris</div>
        <div style={{ fontSize: 10, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 28 }}>Espace Admin</div>
        <input
          type="password"
          placeholder="Mot de passe admin"
          value={adminPassword}
          onChange={e => setAdminPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && adminPassword === ADMIN_PASSWORD && setAuthenticated(true)}
          style={{ ...inputStyle, marginBottom: 12, textAlign: 'center' }}
        />
        <button
          onClick={() => adminPassword === ADMIN_PASSWORD ? setAuthenticated(true) : alert('Mot de passe incorrect')}
          style={{ width: '100%', background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '13px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Accéder →
        </button>
      </div>
    </div>
  )

  // ── Dashboard admin ──
  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F8', fontFamily: "'Inter', system-ui, sans-serif", color: '#1F2A24' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500;600&display=swap');`}</style>

      {/* Header */}
      <header style={{ background: '#fff', borderBottom: '1px solid #EBF0EC', padding: '16px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="30" height="30" viewBox="0 0 64 64" fill="none">
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="2" fill="none"/>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="2" fill="none"/>
            <circle cx="32" cy="32" r="4" fill="#7FAF9B"/>
            <circle cx="32" cy="32" r="1.8" fill="#fff"/>
          </svg>
          <div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1F2A24', lineHeight: 1 }}>Holiris</div>
            <div style={{ fontSize: 9, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase' }}>Admin</div>
          </div>
        </div>
        <div style={{ fontSize: 13, color: '#9BB5AA' }}>{seniors.length} dossier{seniors.length > 1 ? 's' : ''}</div>
      </header>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 24px' }}>

        {/* Titre */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
          <div>
            <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Gestion</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>Dossiers seniors</h1>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            + Nouveau dossier
          </button>
        </div>

        {/* Formulaire */}
        {showForm && (
          <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '24px', marginBottom: 24, boxShadow: '0 2px 12px rgba(127,175,155,0.08)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Nouveau dossier</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label style={{ fontSize: 11, color: '#9BB5AA', display: 'block', marginBottom: 6, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Prénom</label>
                <input placeholder="Marie" value={prenom} onChange={e => setPrenom(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#9BB5AA', display: 'block', marginBottom: 6, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Nom</label>
                <input placeholder="Dupont" value={nom} onChange={e => setNom(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={{ fontSize: 11, color: '#9BB5AA', display: 'block', marginBottom: 6, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Date de naissance</label>
                <input type="date" value={dateNaissance} onChange={e => setDateNaissance(e.target.value)} style={inputStyle} />
                {dateNaissance && (
                  <div style={{ fontSize: 11, color: '#7FAF9B', marginTop: 4 }}>
                    {calculerAge(dateNaissance)} ans
                  </div>
                )}
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#9BB5AA', display: 'block', marginBottom: 6, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Ville</label>
                <input placeholder="Paris" value={city} onChange={e => setCity(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={createSenior} disabled={loading || !prenom || !nom || !dateNaissance || !city}
                style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!prenom || !nom || !dateNaissance || !city) ? 0.5 : 1 }}>
                {loading ? 'Création...' : 'Créer le dossier'}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Liste seniors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {seniors.map((s) => (
            <div key={s.id} style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1F2A24' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 3 }}>
                  {s.age} ans · {s.city}
                  {s.date_naissance && <span> · Né(e) le {new Date(s.date_naissance).toLocaleDateString('fr-FR')}</span>}
                </div>
                {s.famille?.length > 0 && (
                  <div style={{ fontSize: 12, color: '#4A8870', marginTop: 6 }}>
                    {s.famille.map(f => f.name).filter(Boolean).join(', ')}
                  </div>
                )}
              </div>
              {s.invite_code && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 10, color: '#9BB5AA', marginBottom: 6, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Code invitation</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#EAF4EF', borderRadius: 6, padding: '6px 12px', fontSize: 13, fontWeight: 600, color: '#4A8870', letterSpacing: '0.08em', fontFamily: 'monospace' }}>
                      {s.invite_code}
                    </div>
                    <button onClick={() => copyCode(s.invite_code)}
                      style={{ background: copied === s.invite_code ? '#EAF4EF' : '#7FAF9B', color: copied === s.invite_code ? '#4A8870' : '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                      {copied === s.invite_code ? 'Copié ✓' : 'Copier'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {seniors.length === 0 && (
            <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 14, color: '#9BB5AA' }}>Aucun dossier senior pour le moment.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
