'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'

export default function Intervenants() {
  const [intervenants, setIntervenants] = useState([])
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showArchives, setShowArchives] = useState(false)
  const [saving, setSaving] = useState(false)
  const [emailSent, setEmailSent] = useState(null)
  const [copied, setCopied] = useState(null)
  const [messageModal, setMessageModal] = useState(null)
  const [messageTexte, setMessageTexte] = useState('')
  const [messageSending, setMessageSending] = useState(false)
  const [messageResult, setMessageResult] = useState(null)
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

  async function loadData() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }
    if (!selectedSeniorId) return

    const { data: actifs } = await supabase
      .from('intervenants').select('*')
      .eq('senior_id', selectedSeniorId)
      .is('archived_at', null)
      .order('created_at', { ascending: false })

    const { data: archivés } = await supabase
      .from('intervenants').select('*')
      .eq('senior_id', selectedSeniorId)
      .not('archived_at', 'is', null)
      .order('archived_at', { ascending: false })

    setIntervenants(actifs || [])
    setArchives(archivés || [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [selectedSeniorId])

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
            body: JSON.stringify({ intervenantId: data[0].id, email, prenom, nom, role, seniorName: selectedSenior?.name })
          })
          const result = await res.json()
          if (result.success) setEmailSent(prenom + ' ' + nom)
        } catch (e) { console.error('Erreur email:', e) }
      }

      if (whatsapp && data[0]) {
        try {
          await fetch('/api/whatsapp-intervenant', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ whatsapp, prenom, seniorName: selectedSenior?.name, type: 'template', intervenantId: data[0].id })
          })
        } catch (e) { console.error('Erreur WA:', e) }
      }

      setPrenom(''); setNom(''); setRole(''); setTelephone(''); setEmail('')
      setShowForm(false)
      setTimeout(() => setEmailSent(null), 5000)
      loadData()
    }
    setSaving(false)
  }

  async function renvoyerInvitation(i) {
    if (!i.whatsapp) return alert('Pas de numéro WhatsApp.')
    try {
      const res = await fetch('/api/whatsapp-intervenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: i.whatsapp, prenom: i.name.split(' ')[0], seniorName: selectedSenior?.name, type: 'template', intervenantId: i.id })
      })
      const data = await res.json()
      if (data.success) alert('Invitation renvoyée ✓')
      else alert('Erreur : ' + JSON.stringify(data.error))
    } catch (e) { alert('Erreur réseau') }
  }

  async function copierLien(i) {
    const token = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10)
    await supabase.from('intervenants').update({ invite_token: token }).eq('id', i.id)
    const lien = `https://holiris.fr/rejoindre?token=${token}`

    try {
      await navigator.clipboard.writeText(lien)
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = lien
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
    }

    setCopied(i.id)
    setTimeout(() => setCopied(null), 3000)
  }

  async function envoyerMessageLibre() {
    if (!messageTexte.trim() || !messageModal) return
    setMessageSending(true)
    setMessageResult(null)
    try {
      const res = await fetch('/api/whatsapp-intervenant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp: messageModal.whatsapp, type: 'libre', message: messageTexte })
      })
      const data = await res.json()
      if (data.success) {
        setMessageResult('success')
        setTimeout(() => { setMessageModal(null); setMessageTexte(''); setMessageResult(null) }, 2000)
      } else {
        setMessageResult('error')
      }
    } catch (e) { setMessageResult('error') }
    setMessageSending(false)
  }

  async function archiverIntervenant(id) {
    const { error } = await supabase.from('intervenants').update({ archived_at: new Date().toISOString() }).eq('id', id)
    if (!error) loadData()
  }

  async function restaurerIntervenant(id) {
    const { error } = await supabase.from('intervenants').update({ archived_at: null }).eq('id', id)
    if (!error) loadData()
  }

  async function supprimerDefinitivement(id) {
    if (!confirm('Supprimer définitivement cet intervenant ?')) return
    await supabase.from('intervenants').delete().eq('id', id)
    loadData()
  }

  if (loading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA' }}>Chargement...</div>
    </div>
  )

  return (
    <Layout senior={selectedSenior} seniors={seniors} selectedSeniorId={selectedSeniorId} switchSenior={switchSenior} isAdmin={isAdmin}>

      {messageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 480, boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 8 }}>Message WhatsApp</div>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1F2A24', marginBottom: 4 }}>{messageModal.name}</div>
            <div style={{ fontSize: 12, color: '#9BB5AA', marginBottom: 20 }}>{messageModal.whatsapp} · {messageModal.role}</div>
            <div style={{ background: '#FDF3E7', border: '1px solid #F0D9B5', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#C4844A', marginBottom: 16 }}>
              Ce message ne peut être envoyé que si l'intervenant a déjà écrit au numéro Holiris (+1 218-443-9755).
            </div>
            <textarea
              placeholder={'Votre message à ' + messageModal.name.split(' ')[0] + '...'}
              value={messageTexte} onChange={e => setMessageTexte(e.target.value)} rows={4}
              style={{ width: '100%', padding: '12px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box', marginBottom: 12, background: '#FAFCFC' }}
            />
            {messageResult === 'success' && <div style={{ background: '#EAF4EF', color: '#4A8870', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>Message envoyé ✓</div>}
            {messageResult === 'error' && <div style={{ background: '#FBECED', color: '#C4606A', borderRadius: 8, padding: '10px 14px', fontSize: 13, marginBottom: 12 }}>Erreur — l'intervenant doit d'abord écrire au numéro Holiris.</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={envoyerMessageLibre} disabled={messageSending || !messageTexte.trim()}
                style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '11px 24px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!messageTexte.trim() || messageSending) ? 0.5 : 1 }}>
                {messageSending ? 'Envoi...' : 'Envoyer →'}
              </button>
              <button onClick={() => { setMessageModal(null); setMessageTexte(''); setMessageResult(null) }}
                style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '11px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

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
          Email d'invitation envoyé à {emailSent}
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
            <input placeholder="Email (optionnel)" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8DDD4', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 4 }}>
              Lien d'invitation envoyé automatiquement par WhatsApp · Email si renseigné
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {intervenants.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#9BB5AA', marginBottom: 4 }}>Aucun intervenant actif</div>
            <div style={{ fontSize: 13, color: '#C8DDD4' }}>Ajoutez les professionnels qui s'occupent de {selectedSenior?.name}</div>
          </div>
        ) : intervenants.map(i => (
          <div key={i.id} style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: '#EAF4EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {roleIcons[i.role] ?? '👤'}
              </div>
              <div style={{ flex: 1, minWidth: 120 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24' }}>{i.name}</div>
                <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>{i.role}</div>
                <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {i.phone && <span>{i.phone}</span>}
                  {i.email && <span>· {i.email}</span>}
                  {i.user_id && <span style={{ color: '#4A8870', fontWeight: 500 }}>· Compte actif</span>}
                  {!i.user_id && <span style={{ color: '#C4844A' }}>· En attente</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {!i.user_id && (
                  <>
                    <button onClick={() => renvoyerInvitation(i)}
                      style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                      Inviter WA
                    </button>
                    <button onClick={() => copierLien(i)}
                      style={{ background: copied === i.id ? '#EAF4EF' : '#F3EDF7', color: copied === i.id ? '#4A8870' : '#8B6FAA', border: '1px solid ' + (copied === i.id ? '#C8DDD4' : '#E0D0EC'), borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                      {copied === i.id ? 'Copié ✓' : 'Copier lien'}
                    </button>
                  </>
                )}
                <button onClick={() => { setMessageModal(i); setMessageTexte(''); setMessageResult(null) }}
                  style={{ background: '#F3EDF7', color: '#8B6FAA', border: '1px solid #E0D0EC', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                  Message
                </button>
                <button onClick={() => archiverIntervenant(i.id)}
                  style={{ background: '#FDF3E7', color: '#C4844A', border: '1px solid #F0D9B5', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                  Archiver
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

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
              <div style={{ fontSize: 13, color: '#C8DDD4', padding: '12px 0' }}>Aucun intervenant archivé.</div>
            ) : archives.map(i => (
              <div key={i.id} style={{ background: '#fff', border: '1px solid #F0D9B5', borderRadius: 12, padding: '16px 20px', opacity: 0.8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, background: '#FDF3E7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                    {roleIcons[i.role] ?? '👤'}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24' }}>{i.name}</div>
                    <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>{i.role}</div>
                    <div style={{ fontSize: 12, color: '#C4844A', marginTop: 4 }}>Archivé le {new Date(i.archived_at).toLocaleDateString('fr-FR')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    <button onClick={() => restaurerIntervenant(i.id)}
                      style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                      Restaurer
                    </button>
                    <button onClick={() => supprimerDefinitivement(i.id)}
                      style={{ background: '#FBECED', color: '#C4606A', border: '1px solid #F2C4C8', borderRadius: 8, padding: '6px 10px', fontSize: 12, cursor: 'pointer' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </Layout>
  )
}
