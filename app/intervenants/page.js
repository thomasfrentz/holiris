'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSenior } from '../lib/useSenior'

export default function Intervenants() {
  const [intervenants, setIntervenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(null)
  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin } = useSenior()

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [telephone, setTelephone] = useState('')

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const navItems = [
    { icon: '⚡', label: 'Flux en temps réel', href: '/app' },
    { icon: '📅', label: 'Agenda', href: '/agenda' },
    { icon: '📝', label: 'Carnet de suivi', href: '/carnet' },
    { icon: '👥', label: 'Intervenants', href: '/intervenants' },
    { icon: '🤖', label: 'Assistant IA', href: '/assistant' },
    { icon: '👤', label: 'Mon profil', href: '/profil' },
  ]

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (!selectedSeniorId) return

      const { data: intervenantsData } = await supabase
        .from('intervenants')
        .select('*')
        .eq('senior_id', selectedSeniorId)
        .order('created_at', { ascending: false })
      setIntervenants(intervenantsData || [])
      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId])

  async function addIntervenant() {
    if (!prenom || !nom || !role || !telephone) return
    setSaving(true)

    let whatsapp = telephone.replace(/\s/g, '').replace(/^0/, '+33')

    const { error } = await supabase.from('intervenants').insert({
      name: prenom + ' ' + nom,
      role, phone: telephone, whatsapp,
      senior_id: selectedSeniorId
    })

    if (!error) {
      setPrenom(''); setNom(''); setRole(''); setTelephone('')
      setShowForm(false)

      const { data } = await supabase
        .from('intervenants').select('*')
        .eq('senior_id', selectedSeniorId)
        .order('created_at', { ascending: false })
      setIntervenants(data || [])
    }
    setSaving(false)
  }

  async function deleteIntervenant(id) {
    if (!isAdmin) return
    await supabase.from('intervenants').delete().eq('id', id)
    setIntervenants(prev => prev.filter(i => i.id !== id))
  }

  function copyInvitation(intervenant) {
    const message = 'Bonjour ' + intervenant.name.split(' ')[0] + ' 👋\n\nJe vous invite à utiliser Holiris pour le suivi de ' + selectedSenior?.name + '.\n\nAprès chaque passage, envoyez simplement un message vocal ou texte sur WhatsApp au +15556480002.\n\n✅ Partagez : état général, humeur, activités\n❌ Ne partagez pas : diagnostics, ordonnances, données médicales\n\nPour créer votre compte : https://holiris.fr/login\n\nMerci pour votre accompagnement 🌸'

    navigator.clipboard.writeText(message).then(() => {
      setCopied(intervenant.id)
      setTimeout(() => setCopied(null), 3000)
    })
  }

  const roleIcons = {
    'Infirmière': '💉', 'Infirmier': '💉',
    'Kinésithérapeute': '🦵', 'Aide à domicile': '🤝',
    'Médecin': '🏥', 'Cardiologue': '❤️',
    'Pharmacien': '💊', 'Autre': '👤',
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
                color: item.href === '/intervenants' ? '#2ecc71' : '#9abaa8',
                background: item.href === '/intervenants' ? 'rgba(46,204,113,0.15)' : 'none',
                fontWeight: item.href === '/intervenants' ? 'bold' : 'normal',
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
            <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>👥 Intervenants</h1>
            <p style={{ color: '#888', fontSize: 13 }}>{intervenants.length} intervenant{intervenants.length > 1 ? 's' : ''} pour {selectedSenior?.name}</p>
          </div>
          <button onClick={() => setShowForm(!showForm)}
            style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
            + Ajouter
          </button>
        </div>

        {showForm && (
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>Nouvel intervenant</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <input placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }} />
              <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
              <select value={role} onChange={e => setRole(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff' }}>
                <option value="">Rôle / Fonction</option>
                <option>Infirmière</option><option>Infirmier</option>
                <option>Kinésithérapeute</option><option>Aide à domicile</option>
                <option>Médecin</option><option>Cardiologue</option>
                <option>Pharmacien</option><option>Autre</option>
              </select>
              <input placeholder="Téléphone (ex: 06 12 34 56 78)" value={telephone} onChange={e => setTelephone(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }} />
            </div>
            <div style={{ background: '#f0f9f4', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#2d5a47', marginBottom: 16 }}>
              💡 Après l'ajout, copiez le message d'invitation et envoyez-le par SMS ou WhatsApp.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addIntervenant} disabled={saving || !prenom || !nom || !role || !telephone}
                style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
                {saving ? 'Ajout...' : 'Ajouter'}
              </button>
              <button onClick={() => setShowForm(false)}
                style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
                Annuler
              </button>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {intervenants.map((i) => (
            <div key={i.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ fontSize: 32 }}>{roleIcons[i.role] ?? '👤'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: 15, color: '#12201a' }}>{i.name}</div>
                  <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{i.role}</div>
                  <div style={{ fontSize: 12, color: '#5a8a6a', marginTop: 4 }}>
                    📱 {i.phone}
                    {i.whatsapp && <span style={{ marginLeft: 8, color: '#25D366' }}>· WhatsApp ✓</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => copyInvitation(i)}
                    style={{ background: copied === i.id ? '#eafaf1' : '#f0f9f4', color: copied === i.id ? '#27ae60' : '#2d5a47', border: '1px solid ' + (copied === i.id ? '#2ecc71' : '#b8d8bc'), borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>
                    {copied === i.id ? '✅ Copié !' : '📋 Copier invitation'}
                  </button>
                  {isAdmin && (
                    <button onClick={() => deleteIntervenant(i.id)}
                      style={{ background: '#fdf0f0', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                      🗑️
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {intervenants.length === 0 && (
            <div style={{ textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Aucun intervenant</div>
              <div style={{ fontSize: 13 }}>Ajoutez les professionnels qui s'occupent de {selectedSenior?.name}</div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
