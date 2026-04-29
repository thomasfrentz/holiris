'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSenior } from '../lib/useSenior'

export default function Famille() {
  const [membres, setMembres] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inviteSent, setInviteSent] = useState(null)

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [telephone, setTelephone] = useState('')

  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin } = useSenior()
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const navItems = [
    { icon: '⚡', label: 'Flux en temps réel', href: '/app' },
    { icon: '📅', label: 'Agenda', href: '/agenda' },
    { icon: '📝', label: 'Carnet de suivi', href: '/carnet' },
    { icon: '💊', label: 'Ordonnances', href: '/ordonnances' },
    { icon: '👨‍👩‍👧', label: 'Famille', href: '/famille' },
    { icon: '👥', label: 'Intervenants', href: '/intervenants' },
    { icon: '🤖', label: 'Assistant IA', href: '/assistant' },
    { icon: '👤', label: 'Mon profil', href: '/profil' },
  ]

  const roles = [
    'Fils / Fille',
    'Petit-fils / Petite-fille',
    'Frère / Sœur',
    'Neveu / Nièce',
    'Conjoint(e)',
    'Ami(e) proche',
    'Voisin(e)',
    'Autre',
  ]

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (!selectedSeniorId) return

      const { data } = await supabase
        .from('famille')
        .select('*')
        .eq('senior_id', selectedSeniorId)
        .order('created_at', { ascending: false })
      setMembres(data || [])
      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId])

  function resetForm() {
    setPrenom('')
    setNom('')
    setRole('')
    setTelephone('')
    setShowForm(false)
  }

  async function inviteMembre() {
    if (!prenom || !role || !telephone) return
    setSaving(true)

    const whatsapp = telephone.replace(/\s/g, '').replace(/^0/, '+33')

    const { data, error } = await supabase.from('famille').insert({
      senior_id: selectedSeniorId,
      name: prenom + (nom ? ' ' + nom : ''),
      role,
      phone: telephone,
      whatsapp,
    }).select()

    if (!error && data) {
      try {
        const res = await fetch('/api/invite-famille', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            familleId: data[0].id,
            prenom,
            seniorName: selectedSenior?.name,
            whatsapp
          })
        })
        const result = await res.json()
        if (result.success) setInviteSent(prenom + (nom ? ' ' + nom : ''))
      } catch (e) { console.error('Erreur invitation:', e) }

      const { data: updated } = await supabase
        .from('famille').select('*')
        .eq('senior_id', selectedSeniorId)
        .order('created_at', { ascending: false })
      setMembres(updated || [])
      resetForm()
      setTimeout(() => setInviteSent(null), 5000)
    }
    setSaving(false)
  }

  async function deleteMembre(id) {
    if (!isAdmin) return
    await supabase.from('famille').delete().eq('id', id)
    setMembres(prev => prev.filter(m => m.id !== id))
  }

  const roleIcons = {
    'Fils / Fille': '👨‍👩‍👧',
    'Petit-fils / Petite-fille': '👶',
    'Frère / Sœur': '👫',
    'Neveu / Nièce': '🧑',
    'Conjoint(e)': '💑',
    'Ami(e) proche': '🤝',
    'Voisin(e)': '🏠',
    'Autre': '👤',
  }

  if (loading || !selectedSenior) return (
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

        {isAdmin && seniors.length > 1 ? (
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 11, color: '#5a8a6a', marginBottom: 8, letterSpacing: 1 }}>DOSSIER ACTIF</div>
            <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
              style={{ width: '100%', background: '#1a3028', color: '#e8f0eb', border: '1px solid #2ecc71', borderRadius: 8, padding: '8px 10px', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
              {seniors.map(s => <option key={s.id} value={s.id}>{s.name} · {s.age} ans</option>)}
            </select>
            <div style={{ fontSize: 11, color: '#7aaa8a', marginTop: 6 }}>{selectedSenior?.city}</div>
          </div>
        ) : (
          <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 6 }}>👵</div>
            <div style={{ fontWeight: 'bold' }}>{selectedSenior?.name}</div>
            <div style={{ fontSize: 12, color: '#7aaa8a', marginTop: 2 }}>{selectedSenior?.age} ans · {selectedSenior?.city}</div>
          </div>
        )}

        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 8,
                color: item.href === '/famille' ? '#2ecc71' : '#9abaa8',
                background: item.href === '/famille' ? 'rgba(46,204,113,0.15)' : 'none',
                fontWeight: item.href === '/famille' ? 'bold' : 'normal',
                cursor: 'pointer', fontSize: 14
              }}>
                <span>{item.icon}</span>{item.label}
              </div>
            </Link>
          ))}
        </nav>

        {isAdmin && (
          <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ff8070' }}>🔐 Mode Admin</div>
            <div style={{ fontSize: 11, color: '#cc8070', marginTop: 2 }}>Suppression activée</div>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>👨‍👩‍👧 Famille</h1>
            <p style={{ color: '#888', fontSize: 13 }}>{membres.length} membre{membres.length > 1 ? 's' : ''} · {selectedSenior?.name}</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
            + Inviter
          </button>
        </div>

        {inviteSent && (
          <div style={{ background: '#eafaf1', border: '1px solid #2ecc71', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#27ae60', fontWeight: 'bold' }}>
            ✅ Invitation WhatsApp envoyée à {inviteSent} !
          </div>
        )}

        {showForm && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>Inviter un proche</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <input placeholder="Prénom *" value={prenom} onChange={e => setPrenom(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }} />
              <input placeholder="Nom (optionnel)" value={nom} onChange={e => setNom(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <select value={role} onChange={e => setRole(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff' }}>
                <option value="">Lien avec le senior *</option>
                {roles.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <input placeholder="WhatsApp (ex: 06 12 34 56 78) *" value={telephone} onChange={e => setTelephone(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }} />
            </div>
            <div style={{ fontSize: 11, color: '#5a8a6a', marginBottom: 16 }}>
              💡 Un message WhatsApp avec le code d'accès sera envoyé automatiquement
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={inviteMembre} disabled={saving || !prenom || !role || !telephone}
                style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
                {saving ? 'Envoi...' : 'Inviter'}
              </button>
              <button onClick={resetForm}
                style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {membres.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👨‍👩‍👧</div>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Aucun membre</div>
              <div style={{ fontSize: 13 }}>Invitez les proches de {selectedSenior?.name}</div>
            </div>
          ) : membres.map(m => (
            <div key={m.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 32 }}>{roleIcons[m.role] ?? '👤'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 15, color: '#12201a' }}>{m.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{m.role}</div>
                  <div style={{ fontSize: 12, color: '#5a8a6a', marginTop: 4 }}>
                    📱 {m.phone}
                    {m.user_id && <span style={{ marginLeft: 8, color: '#2ecc71' }}>· Compte actif ✓</span>}
                    {!m.user_id && m.code_acces && <span style={{ marginLeft: 8, color: '#f39c12' }}>· Invitation envoyée</span>}
                  </div>
                </div>
                {isAdmin && (
                  <button onClick={() => deleteMembre(m.id)}
                    style={{ background: '#fdf0f0', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                    🗑️
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}