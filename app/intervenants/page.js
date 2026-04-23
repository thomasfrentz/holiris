'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function Intervenants() {
  const [intervenants, setIntervenants] = useState([])
  const [senior, setSenior] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inviteSent, setInviteSent] = useState(null)

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [telephone, setTelephone] = useState('')

  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: familleData } = await supabase
        .from('famille')
        .select('senior_id')
        .eq('user_id', user.id)
        .limit(1)

      const seniorId = familleData?.[0]?.senior_id
      if (!seniorId) { router.push('/login'); return }

      const { data: seniors } = await supabase
        .from('seniors')
        .select('*')
        .eq('id', seniorId)
      setSenior(seniors?.[0])

      const { data: intervenantsData } = await supabase
        .from('intervenants')
        .select('*')
        .eq('senior_id', seniorId)
        .order('created_at', { ascending: false })
      setIntervenants(intervenantsData || [])

      setLoading(false)
    }
    loadData()
  }, [])

  async function addIntervenant() {
    if (!prenom || !nom || !role || !telephone) return
    setSaving(true)

    let whatsapp = telephone.replace(/\s/g, '').replace(/^0/, '+33')

    const { error } = await supabase.from('intervenants').insert({
      name: prenom + ' ' + nom,
      role,
      phone: telephone,
      whatsapp,
      senior_id: senior.id
    })

    if (!error) {
      // Envoyer le message d'invitation
      try {
        const response = await fetch('/api/invite-intervenant', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            whatsapp,
            prenom,
            nom,
            role,
            seniorName: senior.name
          })
        })
        const data = await response.json()
        if (data.success) setInviteSent(prenom + ' ' + nom)
      } catch (e) {
        console.error('Erreur envoi invitation:', e)
      }

      setPrenom('')
      setNom('')
      setRole('')
      setTelephone('')
      setShowForm(false)

      const { data } = await supabase
        .from('intervenants')
        .select('*')
        .eq('senior_id', senior.id)
        .order('created_at', { ascending: false })
      setIntervenants(data || [])

      setTimeout(() => setInviteSent(null), 5000)
    }
    setSaving(false)
  }

  async function deleteIntervenant(id) {
    await supabase.from('intervenants').delete().eq('id', id)
    setIntervenants(prev => prev.filter(i => i.id !== id))
  }

  const roleIcons = {
    'Infirmière': '💉', 'Infirmier': '💉',
    'Kinésithérapeute': '🦵', 'Aide à domicile': '🤝',
    'Médecin': '🏥', 'Cardiologue': '❤️',
    'Pharmacien': '💊', 'Autre': '👤',
  }

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
      </aside>

      <main style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>👥 Intervenants</h1>
            <p style={{ color: '#888', fontSize: 13 }}>{intervenants.length} intervenant{intervenants.length > 1 ? 's' : ''} pour {senior?.name}</p>
          </div>
          <button
            onClick={() => setShowForm(!showForm)}
            style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}
          >
            + Ajouter
          </button>
        </div>

        {inviteSent && (
          <div style={{ background: '#eafaf1', border: '1px solid #2ecc71', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#27ae60', fontWeight: 'bold' }}>
            ✅ Message d'invitation envoyé à {inviteSent} sur WhatsApp !
          </div>
        )}

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
                <option>Infirmière</option>
                <option>Infirmier</option>
                <option>Kinésithérapeute</option>
                <option>Aide à domicile</option>
                <option>Médecin</option>
                <option>Cardiologue</option>
                <option>Pharmacien</option>
                <option>Autre</option>
              </select>
              <input placeholder="Téléphone (ex: 06 12 34 56 78)" value={telephone} onChange={e => setTelephone(e.target.value)}
                style={{ padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif' }} />
            </div>
            <div style={{ background: '#f0f9f4', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#2d5a47', marginBottom: 16 }}>
              💡 Un message de bienvenue sera automatiquement envoyé sur WhatsApp pour expliquer le fonctionnement d'Holiris.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={addIntervenant} disabled={saving || !prenom || !nom || !role || !telephone}
                style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
                {saving ? 'Ajout...' : 'Ajouter et inviter'}
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
            <div key={i.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 32 }}>{roleIcons[i.role] ?? '👤'}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 15, color: '#12201a' }}>{i.name}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>{i.role}</div>
                <div style={{ fontSize: 12, color: '#5a8a6a', marginTop: 4 }}>
                  📱 {i.phone}
                  {i.whatsapp && <span style={{ marginLeft: 8, color: '#25D366' }}>· WhatsApp ✓</span>}
                </div>
              </div>
              <button onClick={() => deleteIntervenant(i.id)}
                style={{ background: '#fdf0f0', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                Supprimer
              </button>
            </div>
          ))}

          {intervenants.length === 0 && (
            <div style={{ textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 12 }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>👥</div>
              <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Aucun intervenant</div>
              <div style={{ fontSize: 13 }}>Ajoutez les professionnels qui s'occupent de {senior?.name}</div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
