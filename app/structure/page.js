'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'

const ROLES = ['Aide à domicile', 'Auxiliaire de vie', 'Aide-soignant·e', 'Infirmier·ère', 'Kinésithérapeute', 'Coordinateur·rice', 'Autre']

// ── Import d'une liste de salariés : copiée depuis Excel (tabulations) ou fichier CSV (; ou ,) ──
const sansAccents = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()

// Intitulés de colonnes reconnus, tels qu'ils apparaissent dans les exports des logiciels métier
const COLONNES = [
  ['prenom', /^(prenom|first ?name)/],
  ['nomComplet', /^(nom (complet|et prenom|prenom)|salarie|intervenant|identite|nom prenom)$/],
  ['nom', /^(nom|nom de famille|last ?name|nom d.usage)$/],
  ['role', /^(fonction|poste|qualification|metier|role|emploi|intitule)/],
  ['telephone', /(tel|portable|mobile|gsm|whatsapp)/],
  ['email', /(e-?mail|courriel|^mail)/],
]

// Découpe une ligne CSV en tenant compte des guillemets
function decouper(ligne, sep) {
  const champs = []
  let cour = '', guillemets = false
  for (let i = 0; i < ligne.length; i++) {
    const c = ligne[i]
    if (c === '"') { if (guillemets && ligne[i + 1] === '"') { cour += '"'; i++ } else guillemets = !guillemets }
    else if (c === sep && !guillemets) { champs.push(cour.trim()); cour = '' }
    else cour += c
  }
  return [...champs, cour.trim()]
}

// « DUPONT Marie » ou « Marie Dupont » : le mot en majuscules est le nom
function separerNom(complet) {
  const mots = complet.split(/\s+/).filter(Boolean)
  const majuscules = mots.filter(m => m.length > 1 && m === m.toUpperCase())
  if (majuscules.length && majuscules.length < mots.length) {
    return { nom: majuscules.join(' '), prenom: mots.filter(m => !majuscules.includes(m)).join(' ') }
  }
  return { prenom: mots[0] || '', nom: mots.slice(1).join(' ') }
}

function lireListeSalaries(texte) {
  const lignes = texte.split(/\r?\n/).filter(l => l.trim())
  if (lignes.length < 2) return { erreur: 'Il faut une ligne d\'intitulés (Prénom, Nom, Email…) puis une ligne par salarié.' }
  const premiere = lignes[0]
  const sep = ['\t', ';', ','].sort((a, b) => premiere.split(b).length - premiere.split(a).length)[0]
  const entetes = decouper(premiere, sep).map(sansAccents)
  const index = {}
  entetes.forEach((e, i) => {
    const trouve = COLONNES.find(([cle, motif]) => index[cle] === undefined && motif.test(e))
    if (trouve) index[trouve[0]] = i
  })
  if (index.email === undefined || (index.nom === undefined && index.nomComplet === undefined)) {
    return { erreur: 'Colonnes non reconnues. La première ligne doit contenir au moins « Nom » (ou « Nom et prénom ») et « Email ».' }
  }
  const salaries = lignes.slice(1).map(l => {
    const c = decouper(l, sep)
    const val = cle => index[cle] !== undefined ? c[index[cle]] || '' : ''
    let { prenom, nom } = { prenom: val('prenom'), nom: val('nom') }
    if (index.nomComplet !== undefined && (!prenom || !nom)) ({ prenom, nom } = separerNom(val('nomComplet')))
    const nomPropre = n => n.toLowerCase().replace(/(^|[\s-])\S/g, x => x.toUpperCase())
    return { prenom: nomPropre(prenom), nom: nomPropre(nom), role: val('role'), telephone: val('telephone'), email: val('email').toLowerCase() }
  })
  return { salaries }
}

// Fichier exporté sous Windows : souvent en Windows-1252 plutôt qu'en UTF-8
async function lireFichier(fichier) {
  const octets = await fichier.arrayBuffer()
  try { return new TextDecoder('utf-8', { fatal: true }).decode(octets) }
  catch { return new TextDecoder('windows-1252').decode(octets) }
}

export default function MaStructure() {
  const [donnees, setDonnees] = useState(null)
  const [erreur, setErreur] = useState('')
  const [onglet, setOnglet] = useState('clients')
  const [formulaire, setFormulaire] = useState(null) // 'client' | 'rattachement' | 'salarie' | 'gestionnaire'
  const [envoi, setEnvoi] = useState(false)
  const [message, setMessage] = useState('')
  const [client, setClient] = useState({ prenom: '', nom: '', dateNaissance: '', ville: '' })
  const [salarie, setSalarie] = useState({ prenom: '', nom: '', role: '', telephone: '', email: '', seniorIds: [] })
  const [gestionnaire, setGestionnaire] = useState({ nom: '', email: '' })
  const [rattachement, setRattachement] = useState({ seniorNom: '', emailProche: '' })
  const [importTexte, setImportTexte] = useState('')
  const [importResultat, setImportResultat] = useState(null) // résultat du dernier import : ajoutés et lignes ignorées

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

  async function demanderRattachement() {
    if (await action({ action: 'demander_rattachement', ...rattachement }, 'Demande envoyée ✓ — si cette personne suit bien ce dossier, elle reçoit un email pour accepter.')) {
      setRattachement({ seniorNom: '', emailProche: '' }); setFormulaire(null)
    }
  }

  async function creerSalarie() {
    if (await action({ action: 'creer_salarie', ...salarie }, 'Salarié ajouté ✓ — son invitation est envoyée par email')) {
      setSalarie({ prenom: '', nom: '', role: '', telephone: '', email: '', seniorIds: [] }); setFormulaire(null)
    }
  }

  async function importerSalaries(liste) {
    setEnvoi(true); setMessage(''); setImportResultat(null)
    try {
      const res = await fetch('/api/structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'importer_salaries', lignes: liste }) })
      const result = await res.json()
      if (!result.success) { setMessage('Erreur : ' + (result.error || 'inconnue')); setEnvoi(false); return }
      setImportResultat(result)
      setMessage(result.ajoutes + ' salarié' + (result.ajoutes > 1 ? 's importés' : ' importé') + ' ✓ — affectez-les à leurs clients ci-dessous : leur invitation part à ce moment-là.')
      setImportTexte(''); setFormulaire(null)
      await charger()
    } catch {
      setMessage('Erreur réseau, réessayez.')
    }
    setEnvoi(false)
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

  const { structure, seniors: clients, salaries, gestionnaires, demandes = [] } = donnees
  const STATUTS = { en_attente: ['En attente de la famille', '#C4844A'], acceptee: ['Acceptée', '#4A8870'], refusee: ['Refusée', '#C4606A'] }

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
          ) : formulaire === 'rattachement' ? (
            <div style={{ ...carte, marginBottom: 16 }}>
              <div style={etiquette}>Rattacher un client existant</div>
              <p style={{ fontSize: 13, color: '#6F7C75', lineHeight: 1.6, marginBottom: 14 }}>
                Votre client a déjà un dossier Holiris créé par sa famille ? Indiquez son nom et l&apos;email d&apos;un proche qui suit ce dossier :
                le proche reçoit un email pour accepter. Le dossier apparaît dans vos clients dès son accord.
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 14 }}>
                <input placeholder="Prénom et nom du client *" value={rattachement.seniorNom} onChange={e => setRattachement({ ...rattachement, seniorNom: e.target.value })} style={input} />
                <input type="email" placeholder="Email d'un proche *" value={rattachement.emailProche} onChange={e => setRattachement({ ...rattachement, emailProche: e.target.value })} style={input} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={demanderRattachement} disabled={envoi || !rattachement.seniorNom || !rattachement.emailProche} style={{ ...btn, opacity: (!rattachement.seniorNom || !rattachement.emailProche) ? 0.5 : 1 }}>{envoi ? 'Envoi…' : 'Envoyer la demande'}</button>
                <button onClick={() => setFormulaire(null)} style={btnGris}>Annuler</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => setFormulaire('client')} style={btn}>+ Nouveau client</button>
              <button onClick={() => setFormulaire('rattachement')} style={{ ...btn, background: '#fff', color: '#4A8870', border: '1.5px solid #7FAF9B' }}>Rattacher un client existant</button>
            </div>
          )}

          {demandes.length > 0 && (
            <div style={{ ...carte, marginBottom: 16 }}>
              <div style={etiquette}>Demandes de rattachement</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {demandes.map(d => (
                  <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, fontSize: 13, flexWrap: 'wrap' }}>
                    <span style={{ color: '#1F2A24' }}>{d.senior_nom} <span style={{ color: '#9BB5AA' }}>· {d.email_proche} · {new Date(d.created_at).toLocaleDateString('fr-FR')}</span></span>
                    <span style={{ color: STATUTS[d.statut]?.[1], fontWeight: 500 }}>{STATUTS[d.statut]?.[0]}</span>
                  </div>
                ))}
              </div>
            </div>
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
          ) : formulaire === 'import' ? (() => {
            const lecture = importTexte.trim() ? lireListeSalaries(importTexte) : null
            const valides = (lecture?.salaries || []).filter(s => s.prenom && s.nom && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.email))
            return (
              <div style={{ ...carte, marginBottom: 16 }}>
                <div style={etiquette}>Importer une liste de salariés</div>
                <p style={{ fontSize: 13, color: '#6F7C75', lineHeight: 1.6, marginBottom: 12 }}>
                  Exportez la liste de vos salariés depuis votre logiciel métier, ou ouvrez-la dans Excel, puis collez-la ci-dessous
                  avec sa ligne d&apos;intitulés, ou choisissez le fichier CSV. Colonnes reconnues : Prénom, Nom (ou Nom et prénom), Fonction, Téléphone, Email.
                </p>
                <input type="file" accept=".csv,.txt,text/csv" onChange={async e => { const f = e.target.files?.[0]; if (f) setImportTexte(await lireFichier(f)); e.target.value = '' }}
                  style={{ fontSize: 13, marginBottom: 10 }} />
                <textarea value={importTexte} onChange={e => setImportTexte(e.target.value)} rows={6}
                  placeholder={'Prénom\tNom\tFonction\tTéléphone\tEmail\nMarie\tDupont\tAuxiliaire de vie\t06 12 34 56 78\tmarie.dupont@exemple.fr'}
                  style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 12, resize: 'vertical', marginBottom: 12 }} />
                {lecture?.erreur && <div style={{ fontSize: 13, color: '#C4606A', marginBottom: 12 }}>{lecture.erreur}</div>}
                {lecture?.salaries && (
                  <div style={{ maxHeight: 260, overflow: 'auto', border: '1px solid #E8EFEB', borderRadius: 8, marginBottom: 12 }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                      <thead><tr style={{ background: '#FAFCFC', color: '#9BB5AA', textAlign: 'left' }}>
                        {['Prénom', 'Nom', 'Fonction', 'Téléphone', 'Email', ''].map(t => <th key={t} style={{ padding: '6px 10px', fontWeight: 500 }}>{t}</th>)}
                      </tr></thead>
                      <tbody>
                        {lecture.salaries.map((s, i) => {
                          const ok = valides.includes(s)
                          return (
                            <tr key={i} style={{ borderTop: '1px solid #F0F4F2', color: ok ? '#1F2A24' : '#9BB5AA' }}>
                              <td style={{ padding: '6px 10px' }}>{s.prenom}</td><td style={{ padding: '6px 10px' }}>{s.nom}</td>
                              <td style={{ padding: '6px 10px' }}>{s.role}</td><td style={{ padding: '6px 10px' }}>{s.telephone}</td>
                              <td style={{ padding: '6px 10px' }}>{s.email}</td>
                              <td style={{ padding: '6px 10px', color: ok ? '#4A8870' : '#C4844A', whiteSpace: 'nowrap' }}>{ok ? '✓' : !s.prenom || !s.nom ? 'Nom manquant' : 'Email manquant'}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ fontSize: 11, color: '#9BB5AA', marginBottom: 14 }}>Aucune invitation n&apos;est envoyée à l&apos;import : elle part quand vous affectez le salarié à un client.</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button onClick={() => importerSalaries(valides)} disabled={envoi || !valides.length} style={{ ...btn, opacity: valides.length ? 1 : 0.5 }}>
                    {envoi ? 'Import…' : valides.length ? 'Importer ' + valides.length + ' salarié' + (valides.length > 1 ? 's' : '') : 'Importer'}
                  </button>
                  <button onClick={() => { setFormulaire(null); setImportTexte('') }} style={btnGris}>Annuler</button>
                </div>
              </div>
            )
          })() : (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <button onClick={() => setFormulaire('salarie')} style={btn}>+ Nouveau salarié</button>
              <button onClick={() => { setFormulaire('import'); setImportResultat(null) }} style={{ ...btn, background: '#fff', color: '#4A8870', border: '1.5px solid #7FAF9B' }}>Importer une liste</button>
            </div>
          )}

          {importResultat?.ignores?.length > 0 && (
            <div style={{ ...carte, marginBottom: 16, borderColor: '#F0D9B5', background: '#FDF8F1' }}>
              <div style={{ fontSize: 13, color: '#C4844A', fontWeight: 500, marginBottom: 6 }}>{importResultat.ignores.length} ligne{importResultat.ignores.length > 1 ? 's' : ''} non importée{importResultat.ignores.length > 1 ? 's' : ''}</div>
              {importResultat.ignores.map((x, i) => <div key={i} style={{ fontSize: 12, color: '#6F7C75' }}>{x.nom || 'Ligne ' + x.ligne} : {x.raison}</div>)}
            </div>
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
