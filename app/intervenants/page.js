'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'
import AucunDossier from '../components/AucunDossier'

export default function Intervenants() {
  const [intervenants, setIntervenants] = useState([])
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showArchives, setShowArchives] = useState(false)
  const [saving, setSaving] = useState(false)
  const [emailSent, setEmailSent] = useState(null)
  const [medecinModifie, setMedecinModifie] = useState({}) // seniorId -> intervenantId après désignation
  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin, loading: seniorsLoading } = useSenior()

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [role, setRole] = useState('')
  const [telephone, setTelephone] = useState('')
  const [email, setEmail] = useState('')
  const [edition, setEdition] = useState(null) // fiche en cours de modification : { id, prenom, nom, role, telephone, email }

  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const ROLES = ['Infirmière', 'Infirmier', 'Kinésithérapeute', 'Aide à domicile', 'Médecin', 'Cardiologue', 'Pharmacien', 'Autre']

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

  const emailValide = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())
  const versWhatsapp = t => t ? t.replace(/\s/g, '').replace(/^0/, '+33') : null

  // Email d'accès : rattachement direct si le compte existe, sinon invitation à créer un compte
  async function inviter(id, nomComplet) {
    try {
      const res = await fetch('/api/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'intervenant', id })
      })
      const result = await res.json()
      if (result.success) setEmailSent('Email d\'invitation envoyé à ' + nomComplet
        + (result.linked ? ' (compte existant, espace ajouté à son compte)' : ''))
    } catch (e) { console.error('Erreur email:', e) }
  }

  // Message WhatsApp de bienvenue dès qu'un numéro est renseigné sur une fiche
  const bienvenue = (type, id) => fetch('/api/whatsapp-bienvenue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }),
  }).catch(() => {})

  // Téléphone et email facultatifs : sans eux, l'intervenant laisse ses notes sur la borne
  async function addIntervenant() {
    if (!prenom || !nom || !role || (email && !emailValide(email))) return
    setSaving(true)

    const { data, error } = await supabase.from('intervenants').insert({
      name: prenom + ' ' + nom, role, phone: telephone || null, whatsapp: versWhatsapp(telephone),
      email: email ? email.trim().toLowerCase() : null, senior_id: selectedSeniorId
    }).select()

    if (!error && data) {
      if (telephone.trim()) bienvenue('intervenant', data[0].id)
      if (email) await inviter(data[0].id, prenom + ' ' + nom)
      else setEmailSent(prenom + ' ' + nom + ' est ajouté : il peut laisser ses notes sur la borne. Ajoutez son email plus tard pour lui envoyer un accès.')

      setPrenom(''); setNom(''); setRole(''); setTelephone(''); setEmail('')
      setShowForm(false)
      setTimeout(() => setEmailSent(null), 6000)
      loadData()
    }
    setSaving(false)
  }

  function ouvrirEdition(i) {
    const [p, ...n] = (i.name || '').split(' ')
    setEdition({ id: i.id, prenom: p, nom: n.join(' '), role: i.role || '', telephone: i.phone || '', email: i.email || '' })
  }

  // Modification d'une fiche. Sans compte, l'invitation part dès qu'un nouvel email est renseigné ;
  // avec un compte, l'email de la fiche sert aux notifications (l'identifiant de connexion ne change pas).
  async function enregistrerEdition(i) {
    const nouvelEmail = edition.email.trim().toLowerCase()
    if (!edition.prenom.trim() || !edition.role || (nouvelEmail && !emailValide(nouvelEmail))) return
    setSaving(true)
    const nomComplet = (edition.prenom.trim() + ' ' + edition.nom.trim()).trim()
    const emailChange = nouvelEmail !== (i.email || '')
    const { error } = await supabase.from('intervenants').update({
      name: nomComplet, role: edition.role,
      phone: edition.telephone || null, whatsapp: versWhatsapp(edition.telephone), email: nouvelEmail || null,
      // Sans compte, un nouvel email invalide l'ancien lien d'invitation (envoyé à l'ancienne adresse)
      ...(emailChange && !i.user_id ? { invite_token: null } : {}),
    }).eq('id', i.id)
    if (!error) {
      if (edition.telephone.trim() && versWhatsapp(edition.telephone) !== (i.whatsapp || versWhatsapp(i.phone))) bienvenue('intervenant', i.id)
      if (!i.user_id && nouvelEmail && emailChange) await inviter(i.id, nomComplet)
      setEdition(null)
      setTimeout(() => setEmailSent(null), 6000)
      loadData()
    } else alert('Erreur : ' + error.message)
    setSaving(false)
  }

  async function renvoyerEmail(i) {
    if (!i.email) return alert('Pas d\'email pour cet intervenant.')
    try {
      const res = await fetch('/api/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'intervenant', id: i.id })
      })
      const result = await res.json()
      if (result.success) {
        alert(result.linked ? 'Compte existant : espace rattaché et email envoyé ✓' : 'Email renvoyé ✓')
        if (result.linked) loadData()
      }
      else alert('Erreur : ' + JSON.stringify(result.error))
    } catch (e) { alert('Erreur réseau') }
  }

  const medecinTraitantId = selectedSeniorId in medecinModifie
    ? medecinModifie[selectedSeniorId]
    : selectedSenior?.medecin_traitant_id

  // Le médecin traitant reçoit un compte rendu par email la veille de chaque RDV « Médical »
  async function designerMedecin(intervenantId) {
    const res = await fetch('/api/medecin-traitant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seniorId: selectedSeniorId, intervenantId })
    })
    const result = await res.json()
    if (result.success) setMedecinModifie(prev => ({ ...prev, [selectedSeniorId]: intervenantId }))
    else alert(result.error || 'Erreur')
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

  // Aucun dossier (ex. structure sans client) : message au lieu d'un chargement sans fin
  if (!seniorsLoading && !seniors.length) return <AucunDossier isAdmin={isAdmin} />

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
          {emailSent}
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
              {ROLES.map(r => <option key={r}>{r}</option>)}
            </select>
            <input placeholder="Téléphone (facultatif)" value={telephone} onChange={e => setTelephone(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input type="email" placeholder="Email (facultatif)" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8DDD4', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 4 }}>
              Sans email ni téléphone, l&apos;intervenant laisse ses notes sur la borne. Avec un email, il reçoit un lien pour créer son compte ; avec un numéro WhatsApp, il peut aussi envoyer ses notes par WhatsApp.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addIntervenant} disabled={saving || !prenom || !nom || !role || (email && !emailValide(email))}
              style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!prenom || !nom || !role || (email && !emailValide(email))) ? 0.5 : 1 }}>
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
                <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {i.name}
                  {i.id === medecinTraitantId && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#4A8870', background: '#EAF4EF', padding: '2px 10px', borderRadius: 20 }}>Médecin traitant</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>{i.role}</div>
                <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {i.phone && <span>{i.phone}</span>}
                  {i.email && <span>{i.phone ? '· ' : ''}{i.email}</span>}
                  {i.user_id && <span style={{ color: '#4A8870', fontWeight: 500 }}>· Compte actif</span>}
                  {!i.user_id && i.email && <span style={{ color: '#C4844A' }}>· Invitation envoyée</span>}
                  {!i.user_id && !i.email && <span style={{ color: '#8B6FAA' }}>{i.phone ? '· ' : ''}Notes sur la borne · sans compte</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                {edition?.id !== i.id && (
                  <button onClick={() => ouvrirEdition(i)}
                    style={{ background: '#F4F5F5', color: '#6F7C75', border: '1px solid #E8EFEB', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                    Modifier
                  </button>
                )}
                {!i.user_id && (
                  <>
                    {i.email && (
                      <button onClick={() => renvoyerEmail(i)}
                        style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                        Renvoyer email
                      </button>
                    )}
                  </>
                )}
                {(i.id === medecinTraitantId || /m[ée]decin|docteur|g[ée]n[ée]raliste/i.test(i.role || '')) && (i.id === medecinTraitantId ? (
                  <button onClick={() => designerMedecin(null)}
                    style={{ background: '#F4F5F5', color: '#6F7C75', border: '1px solid #E8EFEB', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Retirer médecin traitant
                  </button>
                ) : (
                  <button onClick={() => designerMedecin(i.id)} title="Reçoit un compte rendu par email la veille de chaque consultation"
                    style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                    Médecin traitant
                  </button>
                ))}
                <a href="/messages"
                  style={{ background: '#F3EDF7', color: '#8B6FAA', border: '1px solid #E0D0EC', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 500, fontFamily: 'inherit', textDecoration: 'none' }}>
                  Message
                </a>
                <button onClick={() => archiverIntervenant(i.id)}
                  style={{ background: '#FDF3E7', color: '#C4844A', border: '1px solid #F0D9B5', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 500 }}>
                  Archiver
                </button>
              </div>
            </div>
            {edition?.id === i.id && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0F4F2' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  <input placeholder="Prénom" value={edition.prenom} onChange={e => setEdition({ ...edition, prenom: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }} />
                  <input placeholder="Nom" value={edition.nom} onChange={e => setEdition({ ...edition, nom: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }} />
                  <select value={edition.role} onChange={e => setEdition({ ...edition, role: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }}>
                    <option value="">Rôle / Fonction</option>
                    {[...new Set([...ROLES, ...(edition.role ? [edition.role] : [])])].map(r => <option key={r}>{r}</option>)}
                  </select>
                  <input placeholder="Téléphone (facultatif)" value={edition.telephone} onChange={e => setEdition({ ...edition, telephone: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }} />
                  <input type="email" placeholder="Email (facultatif)" value={edition.email} onChange={e => setEdition({ ...edition, email: e.target.value })}
                    style={{ ...{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }, gridColumn: '1 / -1' }} />
                </div>
                <div style={{ fontSize: 11, color: '#9BB5AA', marginBottom: 10 }}>
                  {i.user_id
                    ? 'Email de contact, utilisé pour les notifications. L\'identifiant de connexion de son compte ne change pas.'
                    : 'En enregistrant un nouvel email, ' + (edition.prenom || 'l\'intervenant') + ' reçoit le lien pour créer son compte.'}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => enregistrerEdition(i)} disabled={saving || !edition.prenom.trim() || !edition.role || (edition.email.trim() && !emailValide(edition.email))}
                    style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!edition.prenom.trim() || !edition.role || (edition.email.trim() && !emailValide(edition.email))) ? 0.5 : 1 }}>
                    {saving ? 'Enregistrement...' : !i.user_id && edition.email.trim() && edition.email.trim().toLowerCase() !== (i.email || '') ? 'Enregistrer et inviter' : 'Enregistrer'}
                  </button>
                  <button onClick={() => setEdition(null)}
                    style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Annuler
                  </button>
                </div>
              </div>
            )}
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
