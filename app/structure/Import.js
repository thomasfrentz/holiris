'use client'
import { useState } from 'react'
import { analyser, lireTexte, lireFichier, memeNom } from '../lib/importListes'

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const APERCU = 200 // lignes affichées dans l'aperçu
const dateFr = iso => iso ? iso.split('-').reverse().join('/') : ''
const pluriel = (n, mot, motPluriel = mot + 's') => n + ' ' + (n > 1 ? motPluriel : mot)

// Contrôle de chaque ligne avant l'envoi : la raison est affichée dans l'aperçu, la ligne n'est pas envoyée
function verifier(lecture, clients, salaries) {
  const { type, lignes } = lecture
  if (type === 'salaries') {
    const emails = new Set(salaries.map(s => s.email.toLowerCase()))
    return lignes.map(l => {
      const raison = !l.prenom || !l.nom ? 'Nom manquant' : !EMAIL_VALIDE.test(l.email) ? 'Email manquant' : emails.has(l.email) ? 'Déjà dans vos salariés' : ''
      if (!raison) emails.add(l.email)
      return { ...l, raison }
    })
  }
  if (type === 'clients') {
    const connus = clients.map(c => ({ name: c.name, date: c.date_naissance }))
    return lignes.map(l => {
      const nom = l.prenom + ' ' + l.nom
      const raison = !l.prenom || !l.nom ? 'Nom manquant' : !l.dateNaissance ? 'Date de naissance manquante' : !l.ville ? 'Ville manquante'
        : connus.some(c => memeNom(c.name, nom) && (!c.date || c.date === l.dateNaissance)) ? 'Déjà dans vos clients' : ''
      if (!raison) connus.push({ name: nom, date: l.dateNaissance })
      return { ...l, raison }
    })
  }
  const maintenant = Date.now()
  return lignes.map(l => {
    const client = l.client && clients.find(c => memeNom(c.name, l.client))
    const equipe = l.intervenants.map(n => ({ nom: n, salarie: salaries.find(s => memeNom(s.prenom + ' ' + s.nom, n)) }))
    const inconnu = equipe.find(e => !e.salarie)
    const quand = l.date && l.heure ? new Date(l.date + 'T' + l.heure) : null
    const raison = !l.client ? 'Client manquant' : !client ? 'Client inconnu' : !l.date ? 'Date illisible' : !l.heure ? 'Heure manquante'
      : quand.getTime() < maintenant ? 'Déjà passé' : inconnu ? 'Intervenant inconnu' : ''
    return { ...l, raison, nomClient: l.client, client, inconnu: inconnu?.nom, salaries: equipe.map(e => e.salarie).filter(Boolean), quand }
  })
}

// Passages du planning : une ligne par intervenant, regroupées par client et par heure (binômes)
function regrouperPassages(lignes) {
  const passages = new Map()
  for (const l of lignes.filter(x => !x.raison)) {
    const cle = l.client.id + '|' + l.quand.getTime()
    const p = passages.get(cle) || { seniorId: l.client.id, scheduledAt: l.quand.toISOString(), salaries: [], prestation: l.prestation }
    for (const s of l.salaries) if (!p.salaries.includes(s)) p.salaries.push(s)
    passages.set(cle, p)
  }
  return [...passages.values()].map(p => ({
    seniorId: p.seniorId, scheduledAt: p.scheduledAt, salarieIds: p.salaries.map(s => s.id),
    label: p.prestation || 'Passage' + (p.salaries.length ? ' de ' + p.salaries.map(s => s.prenom).join(' et ') : ''),
  }))
}

// Noms non reconnus, avec leur nombre de lignes
function compter(noms) {
  const n = new Map()
  for (const x of noms) n.set(x, (n.get(x) || 0) + 1)
  return [...n].map(([nom, nb]) => nom + (nb > 1 ? ' (' + nb + ')' : '')).join(', ')
}

const COLONNES = {
  salaries: [['Prénom', l => l.prenom], ['Nom', l => l.nom], ['Fonction', l => l.role], ['Téléphone', l => l.telephone], ['Email', l => l.email]],
  clients: [['Prénom', l => l.prenom], ['Nom', l => l.nom], ['Naissance', l => dateFr(l.dateNaissance)], ['Ville', l => l.ville]],
  planning: [['Date', l => dateFr(l.date)], ['Heure', l => l.heure], ['Client', l => l.client?.name || l.nomClient], ['Intervenant', l => l.intervenants.join(', ')], ['Prestation', l => l.prestation]],
}
const NOMS = { salaries: 'Liste de salariés', clients: 'Liste de clients', planning: 'Planning des passages' }

export default function Import({ clients, salaries, passagesAVenir = 0, onImporte, onFermer }) {
  const [lecture, setLecture] = useState(null) // { type, lignes } ou { erreur }
  const [texte, setTexte] = useState('')
  const [survol, setSurvol] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [resultat, setResultat] = useState(null) // { message, ignores }

  async function choisirFichier(fichier) {
    if (!fichier) return
    setResultat(null); setTexte('')
    try { setLecture(analyser(await lireFichier(fichier))) }
    catch (e) { setLecture({ erreur: e.message }) }
  }

  function coller(valeur) {
    setTexte(valeur); setResultat(null)
    setLecture(valeur.trim() ? analyser(lireTexte(valeur)) : null)
  }

  const lignes = lecture?.type ? verifier(lecture, clients, salaries) : []
  const valides = lignes.filter(l => !l.raison)
  const passages = lecture?.type === 'planning' ? regrouperPassages(lignes) : []
  const nouvellesAffectations = new Set(passages.flatMap(p => p.salarieIds
    .filter(id => !salaries.find(s => s.id === id)?.seniorIds.includes(p.seniorId)).map(id => id + '|' + p.seniorId))).size
  const aEnvoyer = lecture?.type === 'planning' ? passages.length : valides.length

  async function importer() {
    setEnvoi(true)
    const corps = lecture.type === 'planning' ? { action: 'importer_planning', passages }
      : { action: lecture.type === 'clients' ? 'importer_clients' : 'importer_salaries', lignes: valides }
    try {
      const res = await fetch('/api/structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      const r = await res.json()
      if (!r.success) setResultat({ erreur: 'Erreur : ' + (r.error || 'inconnue') })
      else {
        const message = lecture.type === 'planning'
          ? pluriel(r.ajoutes, 'passage ajouté', 'passages ajoutés') + ' à l\'agenda ✓'
            + (r.doublons ? ' — ' + pluriel(r.doublons, 'passage était déjà', 'passages étaient déjà') + ' dans l\'agenda' : '')
            + (r.affectations ? ' — ' + pluriel(r.affectations, 'nouvelle affectation', 'nouvelles affectations') : '')
          : lecture.type === 'clients'
            ? pluriel(r.ajoutes, 'dossier client créé', 'dossiers clients créés') + ' ✓'
            : pluriel(r.ajoutes, 'salarié importé', 'salariés importés') + ' ✓ — leur invitation part quand ils sont affectés à un client.'
        setResultat({ message, ignores: r.ignores || [] })
        setLecture(null); setTexte('')
        await onImporte()
      }
    } catch {
      setResultat({ erreur: 'Erreur réseau, réessayez.' })
    }
    setEnvoi(false)
  }

  const input = { padding: '10px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', width: '100%', boxSizing: 'border-box' }
  const btn = { background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }
  const btnGris = { background: '#F4F5F5', color: '#6F7C75', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' }
  const alerte = { fontSize: 12, color: '#C4844A', lineHeight: 1.5, marginTop: 4 }
  const ETAPES = [
    ['Vos salariés', 'Nom, prénom, email, téléphone', salaries.length && pluriel(salaries.length, 'salarié')],
    ['Vos clients', 'Nom, prénom, date de naissance, ville', clients.length && pluriel(clients.length, 'client')],
    ['Votre planning', 'Bénéficiaire, intervenant, date, heure — à réimporter quand il change', passagesAVenir && pluriel(passagesAVenir, 'passage à venir', 'passages à venir')],
  ]

  return (
    <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Importer depuis votre logiciel</div>
      <p style={{ fontSize: 13, color: '#6F7C75', lineHeight: 1.6, marginBottom: 12 }}>
        Exportez vos listes depuis votre logiciel métier (Excel ou CSV) et déposez-les ici, une à la fois, dans cet ordre.
        Holiris reconnaît le type de liste et ses colonnes : rien à ressaisir.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, marginBottom: 14 }}>
        {ETAPES.map(([titre, detail, fait], i) => (
          <div key={titre} style={{ border: '1px solid ' + (fait ? '#CFE3D8' : '#E8EFEB'), background: fait ? '#F3F9F6' : '#FAFCFC', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#1F2A24' }}>{i + 1}. {titre}</div>
            <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 2, lineHeight: 1.4 }}>{detail}</div>
            {fait ? <div style={{ fontSize: 11, color: '#4A8870', marginTop: 4, fontWeight: 500 }}>✓ {fait} {i === 2 ? 'dans l\'agenda' : 'dans Holiris'}</div> : null}
          </div>
        ))}
      </div>

      <label
        onDragOver={e => { e.preventDefault(); setSurvol(true) }}
        onDragLeave={() => setSurvol(false)}
        onDrop={e => { e.preventDefault(); setSurvol(false); choisirFichier(e.dataTransfer.files?.[0]) }}
        style={{ display: 'block', border: '1.5px dashed ' + (survol ? '#7FAF9B' : '#CFE3D8'), background: survol ? '#EAF4EF' : '#FAFCFC', borderRadius: 10, padding: '22px 16px', textAlign: 'center', cursor: 'pointer', marginBottom: 10 }}>
        <input type="file" accept=".xlsx,.csv,.txt,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={e => { choisirFichier(e.target.files?.[0]); e.target.value = '' }} style={{ display: 'none' }} />
        <div style={{ fontSize: 14, color: '#4A8870', fontWeight: 500 }}>Déposez votre fichier ici ou cliquez pour le choisir</div>
        <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 4 }}>Excel (.xlsx) ou CSV</div>
      </label>
      <textarea value={texte} onChange={e => coller(e.target.value)} rows={3}
        placeholder="… ou collez ici les lignes copiées depuis Excel, avec la ligne d'intitulés"
        style={{ ...input, fontFamily: 'ui-monospace, monospace', fontSize: 12, resize: 'vertical', marginBottom: 12 }} />

      {resultat?.erreur && <div style={{ fontSize: 13, color: '#C4606A', marginBottom: 12 }}>{resultat.erreur}</div>}
      {resultat?.message && (
        <div style={{ background: '#EAF4EF', color: '#4A8870', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 12, fontWeight: 500 }}>
          {resultat.message}
          {resultat.ignores.length > 0 && (
            <div style={{ color: '#C4844A', fontWeight: 400, marginTop: 6 }}>
              {pluriel(resultat.ignores.length, 'ligne non importée', 'lignes non importées')} : {resultat.ignores.slice(0, 20).map(x => (x.nom || 'ligne ' + x.ligne) + ' (' + x.raison + ')').join(', ')}
            </div>
          )}
        </div>
      )}
      {lecture?.erreur && <div style={{ fontSize: 13, color: '#C4606A', marginBottom: 12, lineHeight: 1.5 }}>{lecture.erreur}</div>}

      {lecture?.type && (
        <>
          <div style={{ fontSize: 14, fontWeight: 500, color: '#1F2A24', marginBottom: 4 }}>{NOMS[lecture.type]} reconnue · {pluriel(lignes.length, 'ligne')}</div>
          {lecture.type === 'planning' ? (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: '#4A8870' }}>
                {pluriel(passages.length, 'passage à venir', 'passages à venir')} pour {pluriel(new Set(passages.map(p => p.seniorId)).size, 'client')}
              </div>
              {lignes.some(l => l.raison === 'Déjà passé') && <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 4 }}>{pluriel(lignes.filter(l => l.raison === 'Déjà passé').length, 'ligne déjà passée ignorée', 'lignes déjà passées ignorées')}</div>}
              {lignes.some(l => l.raison === 'Client inconnu') && (
                <div style={alerte}>Clients introuvables dans Holiris : {compter(lignes.filter(l => l.raison === 'Client inconnu').map(l => l.nomClient))}. Importez d&apos;abord votre liste de clients, ou vérifiez l&apos;orthographe.</div>
              )}
              {lignes.some(l => l.raison === 'Intervenant inconnu') && (
                <div style={alerte}>Intervenants introuvables dans vos salariés : {compter(lignes.filter(l => l.raison === 'Intervenant inconnu').map(l => l.inconnu))}. Importez d&apos;abord votre liste de salariés, ou vérifiez l&apos;orthographe.</div>
              )}
              {nouvellesAffectations > 0 && (
                <div style={{ fontSize: 12, color: '#6F7C75', marginTop: 4, lineHeight: 1.5 }}>
                  {pluriel(nouvellesAffectations, 'nouvelle affectation', 'nouvelles affectations')} salarié → client, créées automatiquement : chaque salarié concerné n&apos;est prévenu qu&apos;une fois (email et WhatsApp).
                </div>
              )}
              <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 4 }}>Un passage déjà dans l&apos;agenda à la même heure n&apos;est pas recréé : vous pouvez réimporter votre planning à chaque mise à jour.</div>
            </div>
          ) : (
            <div style={{ fontSize: 13, color: '#4A8870', marginBottom: 10 }}>
              {pluriel(valides.length, lecture.type === 'clients' ? 'client à importer' : 'salarié à importer', lecture.type === 'clients' ? 'clients à importer' : 'salariés à importer')}
              {lecture.type === 'salaries' && <span style={{ color: '#9BB5AA' }}> · aucune invitation n&apos;est envoyée à l&apos;import</span>}
            </div>
          )}

          <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #E8EFEB', borderRadius: 8, marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#FAFCFC', color: '#9BB5AA', textAlign: 'left' }}>
                {[...COLONNES[lecture.type].map(c => c[0]), ''].map(t => <th key={t} style={{ padding: '6px 10px', fontWeight: 500 }}>{t}</th>)}
              </tr></thead>
              <tbody>
                {lignes.slice(0, APERCU).map((l, i) => (
                  <tr key={i} style={{ borderTop: '1px solid #F0F4F2', color: l.raison ? '#9BB5AA' : '#1F2A24' }}>
                    {COLONNES[lecture.type].map(([t, val]) => <td key={t} style={{ padding: '6px 10px' }}>{val(l)}</td>)}
                    <td style={{ padding: '6px 10px', color: l.raison ? '#C4844A' : '#4A8870', whiteSpace: 'nowrap' }}>{l.raison || '✓'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lignes.length > APERCU && <div style={{ fontSize: 11, color: '#9BB5AA', padding: '6px 10px' }}>… et {pluriel(lignes.length - APERCU, 'autre ligne', 'autres lignes')}</div>}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {lecture?.type && (
          <button onClick={importer} disabled={envoi || !aEnvoyer} style={{ ...btn, opacity: aEnvoyer ? 1 : 0.5 }}>
            {envoi ? 'Import…' : !aEnvoyer ? 'Rien à importer'
              : 'Importer ' + (lecture.type === 'planning' ? pluriel(aEnvoyer, 'passage') : lecture.type === 'clients' ? pluriel(aEnvoyer, 'client') : pluriel(aEnvoyer, 'salarié'))}
          </button>
        )}
        <button onClick={onFermer} style={btnGris}>Fermer</button>
      </div>
    </div>
  )
}
