'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'

export default function Famille() {
  const [membres, setMembres] = useState([])
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showArchives, setShowArchives] = useState(false)
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

  const roles = [
    'Fils / Fille', 'Petit-fils / Petite-fille', 'Frère / Sœur',
    'Neveu / Nièce', 'Conjoint(e)', 'Ami(e) proche', 'Voisin(e)', 'Autre',
  ]

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (!selectedSeniorId) return

      const { data: actifs } = await supabase
        .from('famille').select('*')
        .eq('senior_id', selectedSeniorId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })

      const { data: archivés } = await supabase
        .from('famille').select('*')
        .eq('senior_id', selectedSeniorId)
        .not('archived_at', 'is', null)
        .order('archived_at', { ascending: false })

      setMembres(actifs || [])
      setArchives(archivés || [])
      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId])

  function resetForm() {
    setPrenom(''); setNom(''); setRole(''); setTelephone(''); setShowForm(false)
  }

  async function inviteMembre() {
    if (!prenom || !role || !telephone) return
    setSaving(true)
    const whatsapp = telephone.replace(/\s/g, '').replace(/^0/, '+33')

    const { data, error } = await supabase.from('famille').insert({
      senior_id: selectedSeniorId,
      name: prenom + (nom ? ' ' + nom : ''),
      role, phone: telephone, whatsapp,
    }).select()

    if (!error && data) {
      try {
        const res = await fetch('/api/invite-famille', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ familleId: data[0].id, prenom, seniorName: selectedSenior?.name, whatsapp })
        })
        const result = await res.json()
        if (result.success) setInviteSent(prenom + (nom ? ' ' + nom : ''))
      } catch (e) { console.error('Erreur invitation:', e) }

      const { data: updated } = await supabase
        .from('famille').select('*')
        .eq('senior_id', selectedSeniorId)
        .is('archived_at', null)
        .order('created_at', { ascending: false })
      setMembres(updated || [])
      resetForm()
      setTimeout(() => setInviteSent(null), 5000)
    }
    setSaving(false)
  }

  async function archiverMembre(id) {
    if (!isAdmin) return
    await supabase.from('famille').update({ archived_at: new Date().toISOString() }).eq('id', id)
    const membre = membres.find(m => m.id === id)
    setMembres(prev => prev.filter(m => m.id !== id))
    if (membre) setArchives(prev => [{ ...membre, archived_at: new Date().toISOString() }, ...prev])
  }

  async function restaurerMembre(id) {
    if (!isAdmin) return
    await supabase.from('famille').update({ archived_at: null }).eq('id', id)
    const membre = archives.find(m => m.id === id)
    setArchives(prev => prev.filter(m => m.id !== id))
    if (membre) setMembres(prev => [{ ...membre, archived_at: null }, ...prev])
  }

  async function supprimerDefinitivement(id) {
    if (!isAdmin) return
    if (!confirm('Supprimer définitivement ce membre ?')) return
    await supabase.from('famille').delete().eq('id', id)
    setArchives(prev => prev.filter(m => m.id !== id))
  }

  if (loading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA' }}>Chargement...</div>
    </div>
  )

  const MembreCard = ({ m, archivé = false }) => (
    <div style={{ background: '#fff', border: '1px solid ' + (archivé ? '#F0D9B5' : '#E8EFEB'), borderRadius: 12, padding: '16px 20px', opacity: archivé ? 0.8 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: archivé ? '#FDF3E7' : '#EAF4EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          👤
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24' }}>{m.name}</div>
          <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>{m.role}</div>
          <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {m.phone && <span>{m.phone}</span>}
            {m.user_id && <span style={{ color: '#4A8870', fontWeight: 500 }}>· Compte actif</span>}
            {!m.user_id && m.code_acces && <span style={{ color: '#C4844A' }}>· Invitation envoyée</span>}
            {archivé && m.archived_at && <span style={{ color: '#C4844A' }}>· Archivé le {new Date(m.archived_at).toLocaleDateString('fr-FR')}</span>}
          </div>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            {archivé ? (
              <>
                <button onClick={() => restaurerMembre(m.id)}
                  style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                  Restaurer
                </button>
                <button onClick={() => supprimerDefinitivement(m.id)}
                  style={{ background: '#FBECED', color: '#C4606A', border: '1px solid #F2C4C8', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
                  🗑️
                </button>
              </>
            ) : (
              <button onClick={() => archiverMembre(m.id)}
                style={{ background: '#FDF3E7', color: '#C4844A', border: '1px solid #F0D9B5', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                Archiver
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )

  return (
    <Layout senior={selectedSenior} seniors={seniors} selectedSeniorId={selectedSeniorId} switchSenior={switchSenior} isAdmin={isAdmin}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Entourage</div>
          <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>Famille</h1>
          <p style={{ color: '#9BB5AA', fontSize: 13, marginTop: 6 }}>{membres.length} membre{membres.length > 1 ? 's' : ''} · {selectedSenior?.name}</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
          + Inviter
        </button>
      </div>

      {inviteSent && (
        <div style={{ background: '#EAF4EF', border: '1px solid #C8DDD4', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#4A8870', fontWeight: 500 }}>
          Invitation WhatsApp envoyée à {inviteSent}
        </div>
      )}

      {showForm && (
        <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Inviter un proche</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <input placeholder="Prénom *" value={prenom} onChange={e => setPrenom(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }} />
            <input placeholder="Nom (optionnel)" value={nom} onChange={e => setNom(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <select value={role} onChange={e => setRole(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }}>
              <option value="">Lien avec le senior *</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="WhatsApp (ex: 06 12 34 56 78) *" value={telephone} onChange={e => setTelephone(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }} />
          </div>
          <div style={{ fontSize: 11, color: '#9BB5AA', marginBottom: 16 }}>
            Un message WhatsApp avec le code d'accès sera envoyé automatiquement
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={inviteMembre} disabled={saving || !prenom || !role || !telephone}
              style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!prenom || !role || !telephone) ? 0.5 : 1 }}>
              {saving ? 'Envoi...' : 'Inviter'}
            </button>
            <button onClick={resetForm}
              style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Membres actifs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {membres.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#9BB5AA', marginBottom: 4 }}>Aucun membre actif</div>
            <div style={{ fontSize: 13, color: '#C8DDD4' }}>Invitez les proches de {selectedSenior?.name}</div>
          </div>
        ) : membres.map(m => <MembreCard key={m.id} m={m} />)}
      </div>

      {/* Archives */}
      {(archives.length > 0 || isAdmin) && (
        <div>
          <button onClick={() => setShowArchives(!showArchives)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
            display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: 0,
          }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#C4844A', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
              Archives {archives.length > 0 && `(${archives.length})`}
            </div>
            <div style={{ fontSize: 11, color: '#C4844A' }}>{showArchives ? '▲' : '▼'}</div>
          </button>

          {showArchives && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {archives.length === 0 ? (
                <div style={{ fontSize: 13, color: '#C8DDD4', padding: '12px 0' }}>Aucun membre archivé.</div>
              ) : archives.map(m => <MembreCard key={m.id} m={m} archivé={true} />)}
            </div>
          )}
        </div>
      )}

    </Layout>
  )
}
