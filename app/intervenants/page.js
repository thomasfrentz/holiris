'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'

export default function Intervenants() {
  const [intervenants, setIntervenants] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copied, setCopied] = useState(null)
  const [emailSent, setEmailSent] = useState(null)
  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin } = useSenior()

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const roleIcons = {
    'Infirmière': '💉', 'Infirmier': '💉',
    'Kinésithérapeute': '🦵', 'Aide à domicile': '🤝',
    'Médecin': '🏥', 'Cardiologue': '❤️',
    'Pharmacien': '💊', 'Autre': '👤',
  }

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (!selectedSeniorId) return

      const { data } = await supabase
        .from('intervenants').select('*')
        .eq('senior_id', selectedSeniorId)
        .order('created_at', { ascending: false })
      setIntervenants(data || [])
      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId])

  async function addIntervenant() {
    if (!prenom || !nom || !role || !telephone) return
    setSaving(true)
    const whatsapp = telephone.replace(/\s/g, '').replace(/^0/, '+33')

    const { data, error } = await supabase.from('intervenants').insert({
      name: prenom + ' ' + nom, role, phone: telephone, whatsapp,
      email: email || null, senior_id: selectedSeniorId
    }).select()

    if (!error && data) {
      if (email && data[0]) {
        try {
          const res = await fetch('/api/invite-intervenant-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              intervenantId: data[0].id, email, prenom, nom, role,
              seniorName: selectedSenior?.name, phone: telephone
            })
          })
          const result = await res.json()
          if (result.success) setEmailSent(prenom + ' ' + nom)
        } catch (e) { console.error('Erreur invitation:', e) }
      }
      setPrenom(''); setNom(''); setRole(''); setTelephone(''); setEmail('')
      setShowForm(false)
      const { data: updated } = await supabase.from('intervenants').select('*')
        .eq('senior_id', selectedSeniorId).order('created_at', { ascending: false })
      setIntervenants(updated || [])
      setTimeout(() => setEmailSent(null), 5000)
    }
    setSaving(false)
  }

  async function deleteIntervenant(id) {
    if (!isAdmin) return
    await supabase.from('intervenants').delete().eq('id', id)
    setIntervenants(prev => prev.filter(i => i.id !== id))
  }

  function copyInvitation(intervenant) {
    const message = 'Bonjour ' + intervenant.name.split(' ')[0] + ' 👋\n\nJe vous invite à utiliser Holiris pour le suivi de ' + selectedSenior?.name + '.\n\nPour créer votre compte : https://holiris.fr/login?signup=true\n\nMerci pour votre accompagnement 🌸'
    navigator.clipboard.writeText(message).then(() => {
      setCopied(intervenant.id)
      setTimeout(() => setCopied(null), 3000)
    })
  }

  if (loading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA' }}>Chargement...</div>
    </div>
  )

  return (
    <Layout senior={selectedSenior} seniors={seniors} selectedSeniorId={selectedSeniorId} switchSenior={switchSenior} isAdmin={isAdmin}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Équipe</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>Intervenants</h1>
          <p style={{ color: '#9BB5AA', fontSize: 13, marginTop: 6 }}>{intervenants.length} intervenant{intervenants.length > 1 ? 's' : ''} · {selectedSenior?.name}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Ajouter
        </button>
      </div>

      {emailSent && (
        <div style={{ background: '#EAF4EF', border: '1px solid #C8DDD4', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#4A8870', fontWeight: 500 }}>
          Email et SMS envoyés à {emailSent}
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Nouvel intervenant</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input placeholder="Prénom" value={prenom} onChange={e => setPrenom(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }} />
            <input placeholder="Nom" value={nom} onChange={e => setNom(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <select value={role} onChange={e => setRole(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }}>
              <option value="">Rôle / Fonction</option>
              <option>Infirmière</option><option>Infirmier</option>
              <option>Kinésithérapeute</option><option>Aide à domicile</option>
              <option>Médecin</option><option>Cardiologue</option>
              <option>Pharmacien</option><option>Autre</option>
            </select>
            <input placeholder="Téléphone (ex: 06 12 34 56 78)" value={telephone} onChange={e => setTelephone(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input placeholder="Email (optionnel — pour envoyer l'invitation)" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8DDD4', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 4 }}>
              Un email + SMS avec le code d'accès seront envoyés automatiquement
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addIntervenant} disabled={saving || !prenom || !nom || !role || !telephone}
              style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!prenom || !nom || !role || !telephone) ? 0.5 : 1 }}>
              {saving ? 'Ajout...' : 'Ajouter'}
            </button>
            <button onClick={() => setShowForm(false)}
              style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {intervenants.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#9BB5AA', marginBottom: 4 }}>Aucun intervenant</div>
            <div style={{ fontSize: 13, color: '#C8DDD4' }}>Ajoutez les professionnels qui s'occupent de {selectedSenior?.name}</div>
          </div>
        ) : intervenants.map((i) => (
          <div key={i.id} style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EAF4EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {roleIcons[i.role] ?? '👤'}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24' }}>{i.name}</div>
                <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>{i.role}</div>
                <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span>{i.phone}</span>
                  {i.email && <span>· {i.email}</span>}
                  {i.user_id && <span style={{ color: '#4A8870', fontWeight: 500 }}>· Compte actif</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => copyInvitation(i)}
                  style={{ background: copied === i.id ? '#EAF4EF' : '#F4F5F5', color: copied === i.id ? '#4A8870' : '#6F7C75', border: '1px solid ' + (copied === i.id ? '#C8DDD4' : '#E8EFEB'), borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                  {copied === i.id ? 'Copié ✓' : 'Copier SMS'}
                </button>
                {isAdmin && (
                  <button onClick={() => deleteIntervenant(i.id)}
                    style={{ background: '#FBECED', color: '#C4606A', border: '1px solid #F2C4C8', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>
                    🗑️
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Layout>
  )
}
