'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'
import AucunDossier from '../components/AucunDossier'

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
  const [email, setEmail] = useState('')
  const [pdcModifiee, setPdcModifiee] = useState({}) // seniorId -> familleId après désignation
  const [userId, setUserId] = useState(null)
  const [edition, setEdition] = useState(null) // fiche en cours de modification
  const [enregistrement, setEnregistrement] = useState(false)

  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin, loading: seniorsLoading } = useSenior()
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
      setUserId(user.id)
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
    setPrenom(''); setNom(''); setRole(''); setTelephone(''); setEmail(''); setShowForm(false)
  }

  // Message WhatsApp de bienvenue dès qu'un numéro est renseigné sur une fiche
  const bienvenue = (type, id) => fetch('/api/whatsapp-bienvenue', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }),
  }).catch(() => {})

  async function inviteMembre() {
    if (!prenom || !role || (!email.trim() && !telephone.trim())) return
    setSaving(true)
    const whatsapp = telephone ? telephone.replace(/\s/g, '').replace(/^0/, '+33') : null
    const nomComplet = prenom + (nom ? ' ' + nom : '')

    const { data, error } = await supabase.from('famille').insert({
      senior_id: selectedSeniorId,
      name: nomComplet,
      role, phone: telephone || null, whatsapp,
      email: email.trim() ? email.trim().toLowerCase() : null,
    }).select()

    if (!error && data) {

      // Email d'accès : rattachement direct si le compte existe, sinon invitation à créer un compte
      if (!email.trim()) setInviteSent(nomComplet + ' par WhatsApp')
      else try {
        const res = await fetch('/api/invitation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'famille', id: data[0].id })
        })
        const result = await res.json()
        if (result.success) setInviteSent(result.linked
          ? nomComplet + ' (compte existant, espace ajouté à son compte)'
          : nomComplet)
      } catch (e) { console.error('Erreur email famille:', e) }
      if (telephone.trim()) bienvenue('famille', data[0].id)


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

  async function renvoyerEmail(m) {
    if (!m.email) return alert('Pas d\'email pour ce membre.')
    try {
      const res = await fetch('/api/invitation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'famille', id: m.id })
      })
      const result = await res.json()
      if (result.success) {
        alert(result.linked ? 'Compte existant : espace rattaché et email envoyé ✓' : 'Email renvoyé ✓')
        if (result.linked) {
          const { data: updated } = await supabase
            .from('famille').select('*')
            .eq('senior_id', selectedSeniorId)
            .is('archived_at', null)
            .order('created_at', { ascending: false })
          setMembres(updated || [])
        }
      }
      else alert('Erreur : ' + JSON.stringify(result.error))
    } catch (e) { alert('Erreur réseau') }
  }

  const personneConfianceId = selectedSeniorId in pdcModifiee
    ? pdcModifiee[selectedSeniorId]
    : selectedSenior?.personne_confiance_id

  async function designerPersonneConfiance(familleId) {
    if (!isAdmin) return
    try {
      const res = await fetch('/api/personne-confiance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seniorId: selectedSeniorId, familleId })
      })
      const result = await res.json()
      if (result.success) setPdcModifiee(prev => ({ ...prev, [selectedSeniorId]: familleId }))
      else alert('Erreur : ' + result.error)
    } catch (e) { alert('Erreur réseau') }
  }

  // Modifier une fiche : admin, gestionnaire de la structure ou personne de confiance (vérifié par le serveur)
  const maFicheId = membres.find(m => m.user_id === userId)?.id
  const peutModifier = isAdmin || (!!personneConfianceId && maFicheId === personneConfianceId)

  function ouvrirEdition(m) {
    const [p, ...n] = (m.name || '').split(' ')
    setEdition({ id: m.id, prenom: p, nom: n.join(' '), role: m.role || '', telephone: m.phone || '', email: m.email || '', adresse: m.adresse || '' })
  }

  async function enregistrerEdition(m) {
    setEnregistrement(true)
    try {
      const res = await fetch('/api/famille', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(edition) })
      const result = await res.json()
      if (!result.success) { alert(result.error || 'Erreur'); setEnregistrement(false); return }
      const nomComplet = (edition.prenom.trim() + ' ' + edition.nom.trim()).trim()
      if (result.invite?.success) {
        setInviteSent(nomComplet + (result.invite.linked ? ' (compte existant, espace ajouté à son compte)' : ''))
        setTimeout(() => setInviteSent(null), 5000)
      }
      const { data: updated } = await supabase.from('famille').select('*')
        .eq('senior_id', selectedSeniorId).is('archived_at', null).order('created_at', { ascending: false })
      setMembres(updated || [])
      setEdition(null)
    } catch { alert('Erreur réseau') }
    setEnregistrement(false)
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

  // Aucun dossier (ex. structure sans client) : message au lieu d'un chargement sans fin
  if (!seniorsLoading && !seniors.length) return <AucunDossier isAdmin={isAdmin} />

  if (loading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA' }}>Chargement...</div>
    </div>
  )

  const MembreCard = ({ m, archivé = false }) => (
    <div style={{ background: '#fff', border: '1px solid ' + (archivé ? '#F0D9B5' : '#E8EFEB'), borderRadius: 12, padding: '16px 20px', opacity: archivé ? 0.8 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: 10, background: archivé ? '#FDF3E7' : '#EAF4EF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
          👤
        </div>
        <div style={{ flex: 1, minWidth: 120 }}>
          <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {m.name}
            {!archivé && m.id === personneConfianceId && (
              <span style={{ fontSize: 11, fontWeight: 500, color: '#8B6FAA', background: '#F3EDF7', padding: '2px 10px', borderRadius: 20 }}>Personne de confiance</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>{m.role}</div>
          <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 4, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {m.phone && <span>{m.phone}</span>}
            {m.email && <span>· {m.email}</span>}
            {m.user_id && <span style={{ color: '#4A8870', fontWeight: 500 }}>· Compte actif</span>}
            {!m.user_id && <span style={{ color: '#C4844A' }}>· En attente</span>}
            {archivé && m.archived_at && <span style={{ color: '#C4844A' }}>· Archivé le {new Date(m.archived_at).toLocaleDateString('fr-FR')}</span>}
          </div>
        </div>
        {(isAdmin || peutModifier) && (
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {peutModifier && !archivé && edition?.id !== m.id && (
              <button onClick={() => ouvrirEdition(m)}
                style={{ background: '#F4F5F5', color: '#6F7C75', border: '1px solid #E8EFEB', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                Modifier
              </button>
            )}
            {!isAdmin ? null : archivé ? (
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
              <>
                {!m.user_id && (
                  <>
                    {m.email && (
                      <button onClick={() => renvoyerEmail(m)}
                        style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                        Renvoyer email
                      </button>
                    )}
                  </>
                )}
                {m.user_id && (m.id === personneConfianceId ? (
                  <button onClick={() => designerPersonneConfiance(null)}
                    style={{ background: '#F4F5F5', color: '#6F7C75', border: '1px solid #E8EFEB', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                    Retirer confiance
                  </button>
                ) : (
                  <button onClick={() => designerPersonneConfiance(m.id)}
                    style={{ background: '#F3EDF7', color: '#8B6FAA', border: '1px solid #E0D0EC', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                    Personne de confiance
                  </button>
                ))}
                <button onClick={() => archiverMembre(m.id)}
                  style={{ background: '#FDF3E7', color: '#C4844A', border: '1px solid #F0D9B5', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  Archiver
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {!archivé && edition?.id === m.id && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0F4F2' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
            <input placeholder="Prénom *" value={edition.prenom} onChange={e => setEdition({ ...edition, prenom: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }} />
            <input placeholder="Nom" value={edition.nom} onChange={e => setEdition({ ...edition, nom: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }} />
            <select value={edition.role} onChange={e => setEdition({ ...edition, role: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }}>
              <option value="">Lien avec le senior *</option>
              {[...new Set([...roles, ...(edition.role ? [edition.role] : [])])].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="Téléphone / WhatsApp" value={edition.telephone} onChange={e => setEdition({ ...edition, telephone: e.target.value })} style={{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }} />
            <input type="email" placeholder={m.user_id ? 'Email *' : 'Email'} value={edition.email} onChange={e => setEdition({ ...edition, email: e.target.value })} style={{ ...{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }, gridColumn: '1 / -1' }} />
            <input placeholder="Adresse" value={edition.adresse} onChange={e => setEdition({ ...edition, adresse: e.target.value })} style={{ ...{ padding: '9px 12px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', minWidth: 0 }, gridColumn: '1 / -1' }} />
          </div>
          <div style={{ fontSize: 11, color: '#9BB5AA', marginBottom: 10 }}>
            {m.user_id
              ? 'Email de contact, utilisé pour les notifications. L\'identifiant de connexion de son compte ne change pas.'
              : 'Si vous changez l\'email, une nouvelle invitation est envoyée à la nouvelle adresse.'}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => enregistrerEdition(m)} disabled={enregistrement || !edition.prenom.trim() || !edition.role || (!edition.email.trim() && !edition.telephone.trim())}
              style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!edition.prenom.trim() || !edition.role || (!edition.email.trim() && !edition.telephone.trim())) ? 0.5 : 1 }}>
              {enregistrement ? 'Enregistrement...' : 'Enregistrer'}
            </button>
            <button onClick={() => setEdition(null)}
              style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
              Annuler
            </button>
          </div>
        </div>
      )}
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
          Invitation envoyée à {inviteSent}
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
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <select value={role} onChange={e => setRole(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }}>
              <option value="">Lien avec le senior *</option>
              {roles.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <input placeholder="WhatsApp (optionnel)" value={telephone} onChange={e => setTelephone(e.target.value)}
              style={{ padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC' }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <input type="email" placeholder="Email (ou au moins le numéro WhatsApp)" value={email} onChange={e => setEmail(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #C8DDD4', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', boxSizing: 'border-box' }} />
            <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 4 }}>
              Avec un email, le lien d&apos;accès est envoyé par email. Sans email, il est envoyé par WhatsApp : le proche indiquera son email en créant son compte. Avec le numéro WhatsApp, il peut aussi envoyer ses notes par WhatsApp.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={inviteMembre} disabled={saving || !prenom || !role || (!email.trim() && !telephone.trim())}
              style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!prenom || !role || (!email.trim() && !telephone.trim())) ? 0.5 : 1 }}>
              {saving ? 'Envoi...' : 'Inviter'}
            </button>
            <button onClick={resetForm}
              style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {isAdmin && !personneConfianceId && membres.length > 0 && (
        <div style={{ background: '#F3EDF7', border: '1px solid #E0D0EC', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#8B6FAA', lineHeight: 1.5 }}>
          Aucune personne de confiance n&apos;est désignée pour {selectedSenior?.name}. En cas d&apos;information médicale essentielle, c&apos;est vous qui serez prévenu(e).
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 24 }}>
        {membres.length === 0 ? (
          <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 14, color: '#9BB5AA', marginBottom: 4 }}>Aucun membre actif</div>
            <div style={{ fontSize: 13, color: '#C8DDD4' }}>Invitez les proches de {selectedSenior?.name}</div>
          </div>
        ) : membres.map(m => <div key={m.id}>{MembreCard({ m })}</div>)}
      </div>

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
              ) : archives.map(m => <div key={m.id}>{MembreCard({ m, archivé: true })}</div>)}
            </div>
          )}
        </div>
      )}

    </Layout>
  )
}
