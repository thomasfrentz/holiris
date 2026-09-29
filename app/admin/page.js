'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'

function calculerAge(dateNaissance) {
  if (!dateNaissance) return null
  return Math.floor((new Date() - new Date(dateNaissance)) / (365.25 * 24 * 60 * 60 * 1000))
}

export default function Admin() {
  const [acces, setAcces] = useState('verification') // verification | ok | refuse
  const router = useRouter()
  const [onglet, setOnglet] = useState('demandes')
  const [demandes, setDemandes] = useState([])
  const [demandesErreur, setDemandesErreur] = useState('')
  const [demandeEnCours, setDemandeEnCours] = useState(null)
  const [structures, setStructures] = useState([])
  const [nouvelleStructure, setNouvelleStructure] = useState({ nom: '', nomResponsable: '', email: '' })
  const [structureEnvoi, setStructureEnvoi] = useState(false)
  const [bornes, setBornes] = useState([])
  const [borneSenior, setBorneSenior] = useState('')
  const [borneCreating, setBorneCreating] = useState(false)
  const [seniors, setSeniors] = useState([])
  const [utilisateurs, setUtilisateurs] = useState([])
  const [loading, setLoading] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [copied, setCopied] = useState(null)
  const [searchUser, setSearchUser] = useState('')

  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [dateNaissance, setDateNaissance] = useState('')
  const [city, setCity] = useState('')

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => { loadData() }, [])

  async function loadData() {
    // Accès réservé au compte admin connecté (vérifié côté serveur)
    const res = await fetch('/api/admin/data')
    if (res.status === 401) { router.push('/login?redirect=' + encodeURIComponent('/admin')); return }
    if (!res.ok) { setAcces('refuse'); return }
    setAcces('ok')
    const data = await res.json()
    setSeniors((data.seniors || []).map(s => ({
      ...s,
      age: s.date_naissance ? calculerAge(s.date_naissance) : s.age
    })))
    setUtilisateurs(data.utilisateurs || [])

    // Demandes d'accès : nécessite d'être connecté avec un compte admin
    const resDemandes = await fetch('/api/admin/demandes')
    if (resDemandes.ok) {
      setDemandes((await resDemandes.json()).demandes || [])
      setDemandesErreur('')
    } else {
      setDemandesErreur('Connectez-vous à Holiris avec votre compte admin pour voir les demandes d\'accès.')
    }

    const resStructures = await fetch('/api/admin/structures')
    if (resStructures.ok) setStructures((await resStructures.json()).structures || [])

    const { data: bornesData } = await supabase
      .from('bornes')
      .select('*, seniors(name)')
      .order('created_at', { ascending: false })
    setBornes(bornesData || [])
  }

  async function traiterDemande(id, action) {
    if (action === 'refuser' && !confirm('Refuser cette demande ? Aucun email ne sera envoyé.')) return
    setDemandeEnCours(id)
    const res = await fetch('/api/admin/demandes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action })
    })
    const result = await res.json()
    if (!result.success) alert('Erreur : ' + result.error)
    setDemandeEnCours(null)
    loadData()
  }

  async function actionStructure(corps) {
    setStructureEnvoi(true)
    const res = await fetch('/api/admin/structures', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(corps)
    })
    const result = await res.json()
    setStructureEnvoi(false)
    if (!result.success) { alert('Erreur : ' + result.error); return false }
    loadData()
    return true
  }

  async function creerStructure() {
    if (await actionStructure({ action: 'creer', ...nouvelleStructure })) {
      alert('Structure créée ✓ — ' + (nouvelleStructure.email) + ' a reçu son invitation par email.')
      setNouvelleStructure({ nom: '', nomResponsable: '', email: '' })
    }
  }

  async function actionUtilisateur(u, action) {
    if (action === 'supprimer' && !confirm('Supprimer définitivement ' + (u.name || 'cet utilisateur') + ' ?\n\nSa fiche et son accès au dossier seront effacés. S\'il ne suit aucun autre senior, son compte de connexion sera aussi supprimé.')) return
    const res = await fetch('/api/admin/utilisateurs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: u.id, action })
    })
    const result = await res.json()
    if (!result.success) alert('Erreur : ' + result.error)
    else if (action === 'supprimer') alert(result.compteSupprime
      ? 'Utilisateur supprimé, ainsi que son compte de connexion.'
      : 'Utilisateur supprimé. Son compte de connexion est conservé : il a encore accès à d\'autres dossiers.')
    loadData()
  }

  async function toggleAdmin(familleId, currentValue) {
    const res = await fetch('/api/admin/role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ familleId, isAdmin: !currentValue })
    })
    const result = await res.json()
    if (!result.success) alert('Erreur : ' + result.error)
    loadData()
  }

  async function createSenior() {
    if (!prenom || !nom || !dateNaissance || !city) return
    setLoading(true)
    const fullName = prenom + ' ' + nom
    const age = calculerAge(dateNaissance)
    await supabase.from('seniors').insert({
      name: fullName, age, date_naissance: dateNaissance, city, status: 'stable'
    })
    setPrenom(''); setNom(''); setDateNaissance(''); setCity('')
    setShowForm(false)
    loadData()
    setLoading(false)
  }

  async function creerBorne() {
    if (!borneSenior) return
    setBorneCreating(true)
    const code = 'BORNE-' + Math.random().toString(36).substring(2, 7).toUpperCase()
    await supabase.from('bornes').insert({ senior_id: borneSenior, code })
    setBorneSenior('')
    loadData()
    setBorneCreating(false)
  }

  async function supprimerBorne(id) {
    if (!confirm('Supprimer cette borne ?')) return
    await supabase.from('bornes').delete().eq('id', id)
    setBornes(prev => prev.filter(b => b.id !== id))
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

  const utilisateursFiltres = utilisateurs.filter(u =>
    !searchUser ||
    u.name?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUser.toLowerCase())
  )

  if (acces !== 'ok') return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500;600&display=swap');`}</style>
      <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 16, padding: '40px 36px', width: 380, textAlign: 'center', boxShadow: '0 4px 24px rgba(127,175,155,0.1)' }}>
        <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, color: '#1F2A24', marginBottom: 4 }}>Holiris</div>
        <div style={{ fontSize: 10, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 24 }}>Espace Admin</div>
        {acces === 'verification' ? (
          <div style={{ fontSize: 14, color: '#9BB5AA' }}>Vérification…</div>
        ) : (
          <>
            <div style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.6, marginBottom: 20 }}>Cet espace est réservé aux administrateurs Holiris.</div>
            <a href="/app" style={{ fontSize: 13, color: '#4A8870' }}>← Retour à mon espace</a>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#F7F9F8', fontFamily: "'Inter', system-ui, sans-serif", color: '#1F2A24' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;1,400&family=Inter:wght@300;400;500;600&display=swap');`}</style>

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
        <div style={{ fontSize: 13, color: '#9BB5AA', display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="/app" style={{ color: '#4A8870', textDecoration: 'none', fontWeight: 500 }}>← Retour à l&apos;application</a>
          <span>{seniors.length} senior{seniors.length > 1 ? 's' : ''}</span>
          <span>{utilisateurs.length} utilisateur{utilisateurs.length > 1 ? 's' : ''}</span>
        </div>
      </header>

      <div style={{ background: '#fff', borderBottom: '1px solid #EBF0EC', padding: '0 32px', display: 'flex' }}>
        {[
          { key: 'demandes', label: 'Demandes d\'accès' + (demandes.filter(d => d.statut === 'en_attente').length ? ' (' + demandes.filter(d => d.statut === 'en_attente').length + ')' : '') },
          { key: 'seniors', label: 'Dossiers seniors' },
          { key: 'structures', label: 'Structures' },
          { key: 'utilisateurs', label: 'Utilisateurs & Admins' },
          { key: 'bornes', label: 'Bornes' },
        ].map(o => (
          <button key={o.key} onClick={() => setOnglet(o.key)} style={{
            background: 'none', border: 'none',
            borderBottom: onglet === o.key ? '2px solid #7FAF9B' : '2px solid transparent',
            padding: '14px 20px', fontSize: 13,
            fontWeight: onglet === o.key ? 500 : 400,
            color: onglet === o.key ? '#4A8870' : '#9BB5AA',
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
          }}>
            {o.label}
          </button>
        ))}
      </div>

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '36px 24px' }}>

        {onglet === 'demandes' && (
          <>
            <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Inscriptions</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1, marginBottom: 8 }}>Demandes d&apos;accès</h1>
            <p style={{ fontSize: 13, color: '#9BB5AA', marginBottom: 24 }}>Valider envoie au demandeur un email pour créer son compte et le dossier de son proche.</p>

            {demandesErreur && (
              <div style={{ background: '#FDF3E7', border: '1px solid #F0D9B5', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#C4844A', marginBottom: 16 }}>{demandesErreur}</div>
            )}

            {!demandesErreur && demandes.length === 0 && (
              <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '40px 20px', textAlign: 'center', fontSize: 14, color: '#9BB5AA' }}>Aucune demande pour le moment.</div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {demandes.map(d => {
                const statuts = {
                  en_attente: { label: 'En attente', color: '#C4844A', bg: '#FDF3E7' },
                  validee: { label: 'Validée · lien envoyé', color: '#4A8870', bg: '#EAF4EF' },
                  inscrite: { label: 'Compte créé', color: '#4A8870', bg: '#EAF4EF' },
                  refusee: { label: 'Refusée', color: '#9BB5AA', bg: '#F4F5F5' },
                }
                const st = statuts[d.statut] || statuts.en_attente
                return (
                  <div key={d.id} style={{ background: '#fff', border: '1px solid ' + (d.statut === 'en_attente' ? '#F0D9B5' : '#E8EFEB'), borderRadius: 12, padding: '16px 20px', opacity: d.statut === 'refusee' ? 0.6 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: 220 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 15, fontWeight: 500 }}>{d.prenom} {d.nom}</span>
                          <span style={{ fontSize: 11, fontWeight: 500, color: st.color, background: st.bg, padding: '2px 10px', borderRadius: 20 }}>{st.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: '#6F7C75', marginTop: 5, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                          <a href={'mailto:' + d.email} style={{ color: '#4A8870' }}>{d.email}</a>
                          {d.telephone && <a href={'tel:' + d.telephone} style={{ color: '#4A8870' }}>{d.telephone}</a>}
                          <span style={{ color: '#9BB5AA' }}>{new Date(d.created_at).toLocaleDateString('fr-FR')}</span>
                        </div>
                        {(d.senior_nom || d.lien) && (
                          <div style={{ fontSize: 13, color: '#1F2A24', marginTop: 8 }}>
                            Pour : <strong>{d.senior_nom || '—'}</strong>{d.senior_ville ? ' (' + d.senior_ville + ')' : ''}{d.lien ? ' · ' + d.lien : ''}
                          </div>
                        )}
                        {d.message && <div style={{ fontSize: 13, color: '#6F7C75', marginTop: 6, fontStyle: 'italic', lineHeight: 1.5 }}>« {d.message} »</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                        {d.statut === 'en_attente' && (
                          <>
                            <button onClick={() => traiterDemande(d.id, 'valider')} disabled={demandeEnCours === d.id}
                              style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                              {demandeEnCours === d.id ? '…' : 'Valider'}
                            </button>
                            <button onClick={() => traiterDemande(d.id, 'refuser')} disabled={demandeEnCours === d.id}
                              style={{ background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                              Refuser
                            </button>
                          </>
                        )}
                        {d.statut === 'validee' && (
                          <button onClick={() => traiterDemande(d.id, 'valider')} disabled={demandeEnCours === d.id}
                            style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '8px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                            Renvoyer le lien
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        )}

        {onglet === 'structures' && (
          <>
            <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Professionnels</div>
            <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1, marginBottom: 8 }}>Structures</h1>
            <p style={{ fontSize: 13, color: '#9BB5AA', marginBottom: 24 }}>
              Une structure (SAAD, CCAS…) gère ses propres clients et salariés. Ses gestionnaires ont les droits d&apos;admin, uniquement sur les dossiers de la structure.
            </p>

            <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: 22, marginBottom: 20 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Nouvelle structure</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <input placeholder="Nom de la structure *" value={nouvelleStructure.nom} onChange={e => setNouvelleStructure({ ...nouvelleStructure, nom: e.target.value })} style={inputStyle} />
                <input placeholder="Nom du responsable" value={nouvelleStructure.nomResponsable} onChange={e => setNouvelleStructure({ ...nouvelleStructure, nomResponsable: e.target.value })} style={inputStyle} />
                <input type="email" placeholder="Email du responsable *" value={nouvelleStructure.email} onChange={e => setNouvelleStructure({ ...nouvelleStructure, email: e.target.value })} style={inputStyle} />
              </div>
              <button onClick={creerStructure} disabled={structureEnvoi || !nouvelleStructure.nom || !nouvelleStructure.email}
                style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: (!nouvelleStructure.nom || !nouvelleStructure.email) ? 0.5 : 1 }}>
                {structureEnvoi ? 'Création…' : 'Créer et inviter le responsable'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {structures.length === 0 && (
                <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '36px 20px', textAlign: 'center', fontSize: 14, color: '#9BB5AA' }}>Aucune structure pour le moment.</div>
              )}
              {structures.map(st => (
                <div key={st.id} style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 20px' }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1F2A24' }}>{st.nom}</div>
                  <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 3 }}>{st.nbSeniors} client{st.nbSeniors > 1 ? 's' : ''}</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {st.gestionnaires.map(g => (
                      <span key={g.email} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 20, background: g.compteActif ? '#EAF4EF' : '#FDF3E7', color: g.compteActif ? '#4A8870' : '#C4844A' }}>
                        {g.nom || g.email} · {g.compteActif ? 'compte actif' : 'invitation envoyée'}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {onglet === 'seniors' && (
          <>
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

            {showForm && (
              <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '24px', marginBottom: 24 }}>
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
                    {dateNaissance && <div style={{ fontSize: 11, color: '#7FAF9B', marginTop: 4 }}>{calculerAge(dateNaissance)} ans</div>}
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

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {seniors.map((s) => (
                <div key={s.id} style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1F2A24' }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 3 }}>
                      {s.age} ans · {s.city}
                      {s.date_naissance && <span> · Né(e) le {new Date(s.date_naissance).toLocaleDateString('fr-FR')}</span>}
                    </div>
                    {structures.length > 0 && (
                      <select value={s.structure_id || ''} disabled={structureEnvoi}
                        onChange={e => actionStructure({ action: 'rattacher', seniorId: s.id, structureId: e.target.value || null })}
                        style={{ marginTop: 8, padding: '4px 8px', border: '1px solid #E8EFEB', borderRadius: 6, fontSize: 12, color: '#6F7C75', background: '#FAFCFC', fontFamily: 'inherit' }}>
                        <option value="">Sans structure (famille)</option>
                        {structures.map(st => <option key={st.id} value={st.id}>Structure : {st.nom}</option>)}
                      </select>
                    )}
                    {s.famille?.length > 0 && (
                      <div style={{ fontSize: 12, color: '#4A8870', marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {s.famille.map((f, i) => (
                          <span key={i} style={{ background: f.is_admin ? '#EAF4EF' : '#F4F5F5', color: f.is_admin ? '#4A8870' : '#9BB5AA', padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500 }}>
                            {f.name || f.email} {f.is_admin ? '· Admin' : ''}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {seniors.length === 0 && (
                <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#9BB5AA' }}>Aucun dossier senior pour le moment.</div>
                </div>
              )}
            </div>
          </>
        )}

        {onglet === 'utilisateurs' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Gestion</div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1, marginBottom: 20 }}>Utilisateurs & Admins</h1>
              <input
                placeholder="Rechercher par nom ou email..."
                value={searchUser} onChange={e => setSearchUser(e.target.value)}
                style={{ ...inputStyle, maxWidth: 400 }}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {utilisateursFiltres.map((u) => (
                <div key={u.id} style={{ background: '#fff', border: '1px solid ' + (u.archived_at ? '#F0D9B5' : '#E8EFEB'), borderRadius: 12, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', opacity: u.archived_at ? 0.75 : 1 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24' }}>{u.name || '—'}</div>
                      {u.is_admin && (
                        <span style={{ background: '#EAF4EF', color: '#4A8870', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Admin</span>
                      )}
                      {u.user_id && (
                        <span style={{ background: '#F3EDF7', color: '#8B6FAA', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Compte actif</span>
                      )}
                      {u.archived_at && (
                        <span style={{ background: '#FDF3E7', color: '#C4844A', fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Archivé le {new Date(u.archived_at).toLocaleDateString('fr-FR')}</span>
                      )}
                    </div>
                    <div style={{ fontSize: 12, color: '#9BB5AA' }}>
                      {u.email || u.phone || '—'}
                      {u.seniors?.name && <span> · Proche de {u.seniors.name}</span>}
                      {u.role && <span> · {u.role}</span>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
                  {u.archived_at ? (
                    <>
                      <button onClick={() => actionUtilisateur(u, 'restaurer')}
                        style={{ background: '#EAF4EF', color: '#4A8870', border: '1px solid #C8DDD4', borderRadius: 8, padding: '7px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
                        Restaurer
                      </button>
                      <button onClick={() => actionUtilisateur(u, 'supprimer')} title="Supprimer définitivement"
                        style={{ background: '#FBECED', color: '#C4606A', border: '1px solid #F2C4C8', borderRadius: 8, padding: '7px 10px', fontSize: 12, cursor: 'pointer' }}>
                        🗑️
                      </button>
                    </>
                  ) : !u.is_admin && (
                    <button onClick={() => actionUtilisateur(u, 'archiver')}
                      style={{ background: '#FDF3E7', color: '#C4844A', border: '1px solid #F0D9B5', borderRadius: 8, padding: '7px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Archiver
                    </button>
                  )}
                  {!u.archived_at && (
                  <button onClick={() => toggleAdmin(u.id, u.is_admin)} style={{
                    background: u.is_admin ? '#FBECED' : '#EAF4EF',
                    color: u.is_admin ? '#C4606A' : '#4A8870',
                    border: '1px solid ' + (u.is_admin ? '#F2C4C8' : '#C8DDD4'),
                    borderRadius: 8, padding: '7px 16px', fontSize: 12,
                    fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
                  }}>
                    {u.is_admin ? 'Retirer admin' : 'Rendre admin'}
                  </button>
                  )}
                  </div>
                </div>
              ))}
              {utilisateursFiltres.length === 0 && (
                <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#9BB5AA' }}>Aucun utilisateur trouvé.</div>
                </div>
              )}
            </div>
          </>
        )}

        {onglet === 'bornes' && (
          <>
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Gestion</div>
              <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>Bornes</h1>
              <p style={{ color: '#9BB5AA', fontSize: 13, marginTop: 6 }}>Tablettes placées au domicile du senior</p>
            </div>

            <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: 24, marginBottom: 24 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 16 }}>Créer une borne</div>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: '#9BB5AA', display: 'block', marginBottom: 6, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase' }}>Senior</label>
                  <select value={borneSenior} onChange={e => setBorneSenior(e.target.value)} style={{ ...inputStyle }}>
                    <option value="">Choisir un senior...</option>
                    {seniors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <button onClick={creerBorne} disabled={borneCreating || !borneSenior}
                  style={{ background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 22px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: !borneSenior ? 0.5 : 1, whiteSpace: 'nowrap' }}>
                  {borneCreating ? 'Création...' : 'Créer la borne'}
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {bornes.length === 0 ? (
                <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '40px 20px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, color: '#9BB5AA' }}>Aucune borne configurée.</div>
                </div>
              ) : bornes.map(b => (
                <div key={b.id} style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 22px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ fontSize: 28 }}>📱</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24' }}>{b.seniors?.name}</div>
                    <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>
                      Créée le {new Date(b.created_at).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ background: '#EAF4EF', borderRadius: 6, padding: '6px 14px', fontSize: 14, fontWeight: 700, color: '#4A8870', letterSpacing: '0.1em', fontFamily: 'monospace' }}>
                      {b.code}
                    </div>
                    <button onClick={() => copyCode(b.code)}
                      style={{ background: copied === b.code ? '#EAF4EF' : '#7FAF9B', color: copied === b.code ? '#4A8870' : '#fff', border: 'none', borderRadius: 6, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 500, fontFamily: 'inherit' }}>
                      {copied === b.code ? 'Copié ✓' : 'Copier'}
                    </button>
                    <button onClick={() => supprimerBorne(b.id)}
                      style={{ background: '#FBECED', color: '#C4606A', border: '1px solid #F2C4C8', borderRadius: 6, padding: '6px 10px', fontSize: 13, cursor: 'pointer' }}>
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </div>
    </div>
  )
}
