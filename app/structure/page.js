'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'

const ROLES = ['Aide à domicile', 'Auxiliaire de vie', 'Aide-soignant(e)', 'Infirmier(e)', 'Kinésithérapeute', 'Coordinateur(trice)', 'Autre']

export default function MaStructure() {
  const [donnees, setDonnees] = useState(null)
  const [erreur, setErreur] = useState('')
  const [onglet, setOnglet] = useState('clients')
  const [formulaire, setFormulaire] = useState(null) // 'client' | 'salarie' | 'gestionnaire'
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState('')
  const [client, setClient] = useState({ prenom: '', nom: '', dateNaissance: '', ville: '' })
  const [salarie, setSalarie] = useState({ prenom: '', nom: '', role: '', telephone: '', email: '', seniorIds: [] })
  const [gestionnaire, setGestionnaire] = useState({ nom: '', email: '' })

  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin } = useSenior()
  const router = useRouter()

  async function charger() {
    const res = await fetch('/api/structure')
    if (res.status === 401) { router.push('/login?redirect=' + encodeURIComponent('/structure')); return }
    if (!res.ok) { setErreur('Cet espace est réservé aux gestionnaires de structure.'); return }
    setDonnees(await res.json())
  }

  useEffect(() => {
    async function init() { await charger() }
    init()
  }, [])

  async function action(corps, succes) {
    setEnvoi(true); setMessage('')
    try {
      const res = await fetch('/api/structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      const result = await res.json()
      if (!result.success) { setMessage('Erreur : ' + (result.error || 'inconnue')); setEnvoi(false); return false }
      if (succes) setMessage(succes)
      await charger()
      setEnvoi(false)
      return true
    } catch {
      setMessage('Erreur réseau, réessayez.'); setEnvoi(false); return false
    }
  }

  async function creerClient() {
    if (await action({ action: 'creer_senior', ...client }, 'Dossier créé ✓')) {
      setClient({ prenom: '', nom: '', dateNaissance: '', ville: '' }); setFormulaire(null)
      window.location.reload() // le nouveau dossier apparaît aussi dans le menu « Dossier actif »
    }
  }

  async function creerSalarie() {
    if (await action({ action: 'creer_salarie', ...salarie }, 'Salarié ajouté ✓ — son invitation est envoyée par email')) {
      setSalarie({ prenom: '', nom: '', role: '', telephone: '', email: '', seniorIds: [] }); setFormulaire(null)
    }
  }

  async function inviterGestionnaire() {
    if (await action({ action: 'inviter_gestionnaire', ...gestionnaire }, 'Invitation envoyée ✓')) {
      setGestionnaire({ nom: '', email: '' }); setFormulaire(null)
    }
  }

  async function ouvrirDossier(id) {
    await switchSenior(id)
    router.push('/app')
  }

  const input = { padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', width: '100%', boxSizing: 'border-box' }
  const btn = { background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
  const btnGris = { background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
  const carte = { background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 20px' }
  const etiquette = { fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }

  if (erreur) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8', padding: 24, textAlign: 'center' }}>
      <div><div style={{ color: '#6F7C75', fontSize: 14, marginBottom: 12 }}>{erreur}</div><Link href="/app" style={{ color: '#4A8870', fontSize: 13 }}>← Retour</Link></div>
    </div>
  )
  if (!donnees) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: "'Inter', sans-serif", background: '#F7F9F8' }}>
      <div style={{ color: '#9BB5AA' }}>Chargement...</div>
    </div>
  )

  const { structure, seniors: clients, salaries, gestionnaires } = donnees

  return (
    <Layout senior={selectedSenior} seniors={seniors} selectedSeniorId={selectedSeniorId} switchSenior={switchSenior} isAdmin={isAdmin}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Ma structure</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>{structure.nom}</h1>
        <p style={{ color: '#9BB5AA', fontSize: 13, marginTop: 6 }}>
          {clients.length} client{clients.length > 1 ? 's' : ''} · {salaries.length} salarié{salaries.length > 1 ? 's' : ''} · {gestionnaires.length} gestionnaire{gestionnaires.length > 1 ? 's' : ''}
        </p>
      </div>

      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E8EFEB', marginBottom: 20, overflowX: 'auto' }}>
        {[['clients', 'Clients'], ['salaries', 'Salariés intervenants'], ['gestionnaires', 'Gestionnaires']].map(([cle, libelle]) => (
          <button key={cle} onClick={() => { setOnglet(cle); setFormulaire(null); setMessage('') }} style={{
            background: 'none', border: 'none', borderBottom: onglet === cle ? '2px solid #7FAF9B' : '2px solid transparent',
            padding: '10px 16px', fontSize: 14, fontWeight: onglet === cle ? 500 : 400, color: onglet === cle ? '#4A8870' : '#9BB5AA',
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}>{libelle}</button>
        ))}
      </div>

      {message && (
        <div style={{ background: message.startsWith('Erreur') ? '#FBECED' : '#EAF4EF', color: message.startsWith('Erreur') ? '#C4606A' : '#4A8870', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 16, fontWeight: 500 }}>{message}</div>
      )}

      {/* ── Clients ── */}
      {onglet === 'clients' && (
        <>
          {formulaire === 'client' ? (
            <div style={{ ...carte, marginBottom: 16 }}>
              <div style={etiquette}>Nouveau dossier client</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 14 }}>
                <input placeholder="Prénom *" value={client.prenom} onChange={e => setClient({ ...client, prenom: e.target.value })} style={input} />
                <input placeholder="Nom *" value={client.nom} onChange={e => setClient({ ...client, nom: e.target.value })} style={input} />
                <input type="date" aria-label="Date de naissance" value={client.dateNaissance} onChange={e => setClient({ ...client, dateNaissance: e.target.value })} style={input} />
                <input placeholder="Ville *" value={client.ville} onChange={e => setClient({ ...client, ville: e.target.value })} style={input} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={creerClient} disabled={envoi || !client.prenom || !client.nom || !client.dateNaissance || !client.ville} style={{ ...btn, opacity: (!client.prenom || !client.nom || !client.dateNaissance || !client.ville) ? 0.5 : 1 }}>{envoi ? 'Création…' : 'Créer le dossier'}</button>
                <button onClick={() => setFormulaire(null)} style={btnGris}>Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setFormulaire('client')} style={{ ...btn, marginBottom: 16 }}>+ Nouveau client</button>
          )}

          {clients.length === 0 ? (
            <div style={{ ...carte, textAlign: 'center', padding: '36px 20px', color: '#9BB5AA', fontSize: 14 }}>Créez le dossier de votre premier client.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
              {clients.map(c => {
                const equipe = salaries.filter(s => s.seniorIds.includes(c.id))
                return (
                  <div key={c.id} style={carte}>
                    <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, color: '#1F2A24' }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 2 }}>{c.date_naissance ? Math.floor((new Date() - new Date(c.date_naissance)) / 31557600000) : c.age} ans · {c.city}</div>
                    <div style={{ fontSize: 12, color: '#6F7C75', marginTop: 10, minHeight: 18 }}>
                      {equipe.length ? 'Équipe : ' + equipe.map(s => s.prenom).join(', ') : 'Aucun salarié affecté'}
                    </div>
                    <button onClick={() => ouvrirDossier(c.id)} style={{ ...btn, marginTop: 12, padding: '8px 14px', fontSize: 13, width: '100%' }}>Ouvrir le dossier →</button>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Salariés ── */}
      {onglet === 'salaries' && (
        <>
          {formulaire === 'salarie' ? (
            <div style={{ ...carte, marginBottom: 16 }}>
              <div style={etiquette}>Nouveau salarié intervenant</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
                <input placeholder="Prénom *" value={salarie.prenom} onChange={e => setSalarie({ ...salarie, prenom: e.target.value })} style={input} />
                <input placeholder="Nom *" value={salarie.nom} onChange={e => setSalarie({ ...salarie, nom: e.target.value })} style={input} />
                <select value={salarie.role} onChange={e => setSalarie({ ...salarie, role: e.target.value })} style={input}>
                  <option value="">Fonction</option>
                  {ROLES.map(r => <option key={r}>{r}</option>)}
                </select>
                <input placeholder="Téléphone WhatsApp" value={salarie.telephone} onChange={e => setSalarie({ ...salarie, telephone: e.target.value })} style={input} />
                <input type="email" placeholder="Email *" value={salarie.email} onChange={e => setSalarie({ ...salarie, email: e.target.value })} style={input} />
              </div>
              {clients.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 12, color: '#6F7C75', marginBottom: 8 }}>Clients suivis par ce salarié :</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {clients.map(c => {
                      const coche = salarie.seniorIds.includes(c.id)
                      return (
                        <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, padding: '6px 12px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + (coche ? '#7FAF9B' : '#E8EFEB'), background: coche ? '#EAF4EF' : '#fff', color: coche ? '#4A8870' : '#6F7C75' }}>
                          <input type="checkbox" checked={coche} onChange={() => setSalarie({ ...salarie, seniorIds: coche ? salarie.seniorIds.filter(id => id !== c.id) : [...salarie.seniorIds, c.id] })} style={{ accentColor: '#7FAF9B' }} />
                          {c.name}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9BB5AA', marginBottom: 14 }}>Le salarié reçoit une invitation par email. Avec son numéro WhatsApp, il peut aussi envoyer ses notes par WhatsApp.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={creerSalarie} disabled={envoi || !salarie.prenom || !salarie.nom || !salarie.email} style={{ ...btn, opacity: (!salarie.prenom || !salarie.nom || !salarie.email) ? 0.5 : 1 }}>{envoi ? 'Ajout…' : 'Ajouter'}</button>
                <button onClick={() => setFormulaire(null)} style={btnGris}>Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setFormulaire('salarie')} style={{ ...btn, marginBottom: 16 }}>+ Nouveau salarié</button>
          )}

          {salaries.length === 0 ? (
            <div style={{ ...carte, textAlign: 'center', padding: '36px 20px', color: '#9BB5AA', fontSize: 14 }}>Ajoutez les salariés qui interviennent chez vos clients.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {salaries.map(s => (
                <div key={s.id} style={carte}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24' }}>{s.prenom} {s.nom}</div>
                      <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 3, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {s.role && <span>{s.role}</span>}
                        <span>{s.email}</span>
                        {s.telephone && <span>{s.telephone}</span>}
                        {s.compteActif
                          ? <span style={{ color: '#4A8870', fontWeight: 500 }}>· Compte actif</span>
                          : <span style={{ color: '#C4844A' }}>· {s.seniorIds.length ? 'Invitation envoyée' : 'À affecter à un client'}</span>}
                      </div>
                    </div>
                    <button onClick={() => confirm('Archiver ' + s.prenom + ' ' + s.nom + ' ? Il n\'aura plus accès aux dossiers de vos clients.') && action({ action: 'archiver_salarie', salarieId: s.id }, 'Salarié archivé')}
                      style={{ background: '#FDF3E7', color: '#C4844A', border: '1px solid #F0D9B5', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      Archiver
                    </button>
                  </div>
                  {clients.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                      {clients.map(c => {
                        const affecte = s.seniorIds.includes(c.id)
                        return (
                          <button key={c.id} disabled={envoi}
                            onClick={() => action({ action: 'affecter', salarieId: s.id, seniorId: c.id, affecte: !affecte }, affecte ? s.prenom + ' ne suit plus ' + c.name : s.prenom + ' suit maintenant ' + c.name)}
                            style={{ fontSize: 12, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', fontFamily: 'inherit', border: '1px solid ' + (affecte ? '#7FAF9B' : '#E8EFEB'), background: affecte ? '#EAF4EF' : '#fff', color: affecte ? '#4A8870' : '#9BB5AA' }}>
                            {affecte ? '✓ ' : '+ '}{c.name}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── Gestionnaires ── */}
      {onglet === 'gestionnaires' && (
        <>
          {formulaire === 'gestionnaire' ? (
            <div style={{ ...carte, marginBottom: 16 }}>
              <div style={etiquette}>Inviter un gestionnaire</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 12 }}>
                <input placeholder="Prénom et nom" value={gestionnaire.nom} onChange={e => setGestionnaire({ ...gestionnaire, nom: e.target.value })} style={input} />
                <input type="email" placeholder="Email *" value={gestionnaire.email} onChange={e => setGestionnaire({ ...gestionnaire, email: e.target.value })} style={input} />
              </div>
              <div style={{ fontSize: 11, color: '#9BB5AA', marginBottom: 14 }}>Un gestionnaire a les mêmes droits que vous sur tous les clients de la structure.</div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={inviterGestionnaire} disabled={envoi || !gestionnaire.email} style={{ ...btn, opacity: !gestionnaire.email ? 0.5 : 1 }}>{envoi ? 'Envoi…' : 'Inviter'}</button>
                <button onClick={() => setFormulaire(null)} style={btnGris}>Annuler</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setFormulaire('gestionnaire')} style={{ ...btn, marginBottom: 16 }}>+ Inviter un gestionnaire</button>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {gestionnaires.map(g => (
              <div key={g.id} style={{ ...carte, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500, color: '#1F2A24' }}>{g.nom || g.email}{g.moi && <span style={{ fontSize: 12, color: '#9BB5AA', fontWeight: 400 }}> (vous)</span>}</div>
                  <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 3 }}>
                    {g.email} · {g.compteActif ? <span style={{ color: '#4A8870', fontWeight: 500 }}>Compte actif</span> : <span style={{ color: '#C4844A' }}>Invitation envoyée</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </Layout>
  )
}
