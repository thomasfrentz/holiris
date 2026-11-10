'use client'
import { useState, useEffect } from 'react'
import { analyser, lireTexte, lireFichier, memeNom } from '../lib/importListes'

const EMAIL_VALIDE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const APERCU = 200 // lignes affichées dans l'aperçu
const dateFr = iso => iso ? iso.split('-').reverse().join('/') : ''
const pluriel = (n, mot, motPluriel = mot + 's') => n + ' ' + (n > 1 ? motPluriel : mot)
const cle = (seniorId, quand) => seniorId + '|' + new Date(quand).getTime()
const memeListe = (a, b) => [...a].sort().join() === [...b].sort().join()

// Contrôle de chaque ligne avant l'envoi, par rapport à ce qui est déjà dans Holiris.
// raison : ligne écartée (affichée, non envoyée). etat : 'nouveau', 'maj' (mise à jour) ou 'a_jour' (rien à faire).
function verifier(lecture, clients, salaries) {
  const { type, lignes } = lecture
  if (type === 'salaries') {
    const parEmail = new Map(salaries.map(s => [s.email.toLowerCase(), s]))
    const vus = new Set()
    return lignes.map(l => {
      const raison = !l.prenom || !l.nom ? 'Nom manquant' : !EMAIL_VALIDE.test(l.email) ? 'Email manquant' : vus.has(l.email) ? 'En double' : ''
      if (raison) return { ...l, raison }
      vus.add(l.email)
      const connu = parEmail.get(l.email)
      const change = connu && ((l.role && l.role !== connu.role) || (l.telephone && l.telephone !== connu.telephone))
      return { ...l, raison, connu, etat: !connu ? 'nouveau' : change ? 'maj' : 'a_jour' }
    })
  }
  if (type === 'clients') {
    const nouveaux = [], vus = new Set()
    return lignes.map(l => {
      const nom = l.prenom + ' ' + l.nom
      let raison = !l.prenom || !l.nom ? 'Nom manquant' : !l.dateNaissance ? 'Date de naissance manquante' : !l.ville ? 'Ville manquante' : ''
      if (raison) return { ...l, raison }
      const connu = clients.find(c => memeNom(c.name, nom) && (!c.date_naissance || c.date_naissance === l.dateNaissance))
      if (connu ? vus.has(connu.id) : nouveaux.some(n => memeNom(n, nom))) raison = 'En double'
      if (raison) return { ...l, raison }
      if (connu) vus.add(connu.id); else nouveaux.push(nom)
      return { ...l, raison, connu, etat: !connu ? 'nouveau' : connu.city !== l.ville || !connu.date_naissance ? 'maj' : 'a_jour' }
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
    const c = cle(l.client.id, l.quand)
    const p = passages.get(c) || { cle: c, seniorId: l.client.id, scheduledAt: l.quand.toISOString(), salaries: [], prestation: l.prestation }
    for (const s of l.salaries) if (!p.salaries.includes(s)) p.salaries.push(s)
    passages.set(c, p)
  }
  return [...passages.values()].map(p => ({
    cle: p.cle, seniorId: p.seniorId, scheduledAt: p.scheduledAt, salarieIds: p.salaries.map(s => s.id),
    label: p.prestation || 'Passage' + (p.salaries.length ? ' de ' + p.salaries.map(s => s.prenom).join(' et ') : ''),
  }))
}

// Période couverte par le planning : du premier au dernier jour du fichier (le serveur n'en garde que l'avenir)
function periodeDe(lignes) {
  const jours = lignes.map(l => l.date).filter(Boolean).sort()
  if (!jours.length) return null
  const debut = new Date(jours[0] + 'T00:00')
  const fin = new Date(jours[jours.length - 1] + 'T00:00')
  fin.setDate(fin.getDate() + 1)
  return fin.getTime() > Date.now() ? { debut: debut.toISOString(), fin: fin.toISOString() } : null
}

// Passages de l'agenda pas encore commencés : les seuls qu'un import modifie ou supprime
const aVenir = passages => { const maintenant = Date.now(); return passages.filter(e => new Date(e.scheduledAt).getTime() > maintenant) }

// Noms, avec leur nombre d'occurrences
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
const ETATS = { nouveau: ['✓ Nouveau', '#4A8870'], maj: ['↻ Mis à jour', '#5B8DB8'], a_jour: ['À jour', '#9BB5AA'] }

export default function Import({ clients, salaries, passagesAVenir = 0, onImporte, onFermer }) {
  const [lecture, setLecture] = useState(null) // { type, lignes } ou { erreur }
  const [texte, setTexte] = useState('')
  const [survol, setSurvol] = useState(false)
  const [envoi, setEnvoi] = useState(false)
  const [resultat, setResultat] = useState(null) // { message, ignores }
  const [agenda, setAgenda] = useState(null) // planning : { periode, passages } déjà dans l'agenda, ou { periode, erreur }
  const [supprimerAbsents, setSupprimerAbsents] = useState(true)
  const [aArchiver, setAArchiver] = useState([]) // salariés absents du fichier, cochés pour l'archivage

  function nouvelleLecture(l) {
    setLecture(l); setAgenda(null); setSupprimerAbsents(true); setAArchiver([])
  }

  async function choisirFichier(fichier) {
    if (!fichier) return
    setResultat(null); setTexte('')
    try { nouvelleLecture(analyser(await lireFichier(fichier))) }
    catch (e) { nouvelleLecture({ erreur: e.message }) }
  }

  function coller(valeur) {
    setTexte(valeur); setResultat(null)
    nouvelleLecture(valeur.trim() ? analyser(lireTexte(valeur)) : null)
  }

  const lignes = lecture?.type ? verifier(lecture, clients, salaries) : []
  const valides = lignes.filter(l => !l.raison)
  const periode = lecture?.type === 'planning' ? periodeDe(lignes) : null

  // Planning : comparaison avec l'agenda sur la période du fichier (aucune période à venir : rien à comparer)
  const clePeriode = periode ? periode.debut + '|' + periode.fin : null
  useEffect(() => {
    if (!clePeriode) return
    const [debut, fin] = clePeriode.split('|')
    let annule = false
    fetch('/api/structure?debut=' + encodeURIComponent(debut) + '&fin=' + encodeURIComponent(fin))
      .then(async res => {
        const r = await res.json()
        if (!annule) setAgenda(res.ok ? { periode: clePeriode, passages: r.passages } : { periode: clePeriode, erreur: r.error || 'Erreur de chargement' })
      })
      .catch(() => { if (!annule) setAgenda({ periode: clePeriode, erreur: 'Erreur réseau, réessayez.' }) })
    return () => { annule = true }
  }, [clePeriode])
  const comparaison = lecture?.type !== 'planning' ? null : !clePeriode ? { passages: [] } : agenda?.periode === clePeriode ? agenda : null
  const agendaPret = !!comparaison?.passages
  const agendaAVenir = aVenir(comparaison?.passages || [])

  const passages = lecture?.type === 'planning' ? regrouperPassages(lignes) : []
  const existants = new Map()
  for (const e of agendaAVenir) if (!existants.has(cle(e.seniorId, e.scheduledAt))) existants.set(cle(e.seniorId, e.scheduledAt), e)
  const etatPassage = p => {
    const e = existants.get(p.cle)
    if (!e) return 'nouveau'
    return e.importe && !(memeListe(e.salarieIds, p.salarieIds) && e.label === p.label) ? 'maj' : 'a_jour'
  }
  const etatsPassages = new Map(passages.map(p => [p.cle, etatPassage(p)]))
  const clesFichier = new Set(passages.map(p => p.cle))
  const annules = agendaAVenir.filter(e => e.importe && !clesFichier.has(cle(e.seniorId, e.scheduledAt)))
  const compte = etat => passages.filter(p => etatsPassages.get(p.cle) === etat).length

  const lignesEtat = lignes.map(l => lecture.type !== 'planning' || l.raison ? l : { ...l, etat: agendaPret ? etatsPassages.get(cle(l.client.id, l.quand)) : null })
  const aEnvoyerLignes = valides.filter(l => l.etat === 'nouveau' || l.etat === 'maj')
  const nbEtat = etat => lignesEtat.filter(l => !l.raison && l.etat === etat).length

  // Absents du fichier : salariés à archiver au choix, clients simplement signalés
  const absents = !valides.length ? []
    : lecture.type === 'salaries' ? salaries.filter(s => !valides.some(l => l.email === s.email.toLowerCase()))
      : lecture.type === 'clients' ? clients.filter(c => !valides.some(l => l.connu?.id === c.id)) : []

  const nouvellesAffectations = new Set(passages.filter(p => etatsPassages.get(p.cle) !== 'a_jour').flatMap(p => p.salarieIds
    .filter(id => !salaries.find(s => s.id === id)?.seniorIds.includes(p.seniorId)).map(id => id + '|' + p.seniorId))).size
  const changementsPlanning = compte('nouveau') + compte('maj') + (supprimerAbsents ? annules.length : 0)
  const aEnvoyer = lecture?.type === 'planning' ? (agendaPret ? changementsPlanning : 0)
    : aEnvoyerLignes.length + (lecture?.type === 'salaries' ? aArchiver.length : 0)

  async function importer() {
    setEnvoi(true)
    const corps = lecture.type === 'planning'
      ? { action: 'importer_planning', passages, periode, supprimerAbsents }
      : lecture.type === 'clients' ? { action: 'importer_clients', lignes: aEnvoyerLignes }
        : { action: 'importer_salaries', lignes: aEnvoyerLignes, archiver: aArchiver }
    try {
      const res = await fetch('/api/structure', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(corps) })
      const r = await res.json()
      if (!r.success) setResultat({ erreur: 'Erreur : ' + (r.error || 'inconnue') })
      else {
        const parties = lecture.type === 'planning'
          ? [[r.ajoutes, 'passage ajouté', 'passages ajoutés'], [r.modifies, 'passage modifié', 'passages modifiés'], [r.supprimes, 'passage supprimé', 'passages supprimés']]
          : lecture.type === 'clients'
            ? [[r.ajoutes, 'dossier client créé', 'dossiers clients créés'], [r.misAJour, 'dossier mis à jour', 'dossiers mis à jour']]
            : [[r.ajoutes, 'salarié importé', 'salariés importés'], [r.misAJour, 'salarié mis à jour', 'salariés mis à jour'], [r.archives, 'salarié archivé', 'salariés archivés']]
        const faits = parties.filter(([n]) => n).map(([n, un, plusieurs]) => pluriel(n, un, plusieurs)).join(', ')
        const message = (faits || 'Rien à modifier') + ' ✓'
          + (r.affectations ? ' — ' + pluriel(r.affectations, 'nouvelle affectation', 'nouvelles affectations') : '')
          + (lecture.type === 'salaries' && r.ajoutes ? ' — leur invitation part quand ils sont affectés à un client.' : '')
        setResultat({ message, ignores: r.ignores || [] })
        nouvelleLecture(null); setTexte('')
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
  const note = { fontSize: 12, color: '#6F7C75', lineHeight: 1.5, marginTop: 4 }
  const encadre = { border: '1px solid #F0D9B5', background: '#FDF8F1', borderRadius: 10, padding: '10px 12px', marginTop: 8 }
  const resume = (n, a, j, mots) => [[n, mots[0]], [a, mots[1]], [j, mots[2]]].filter(([x]) => x).map(([x, m]) => x + ' ' + m).join(' · ') || 'Aucune ligne utilisable'
  const ETAPES = [
    ['Vos salariés', 'Nom, prénom, email, téléphone', salaries.length && pluriel(salaries.length, 'salarié')],
    ['Vos clients', 'Nom, prénom, date de naissance, ville', clients.length && pluriel(clients.length, 'client')],
    ['Votre planning', 'Bénéficiaire, intervenant, date, heure', passagesAVenir && pluriel(passagesAVenir, 'passage à venir', 'passages à venir')],
  ]
  const libelleBouton = lecture?.type === 'planning' ? 'Mettre à jour le planning'
    : lecture?.type === 'clients' ? 'Appliquer aux clients' : 'Appliquer aux salariés'

  return (
    <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '16px 20px', marginBottom: 16 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 14 }}>Importer depuis votre logiciel</div>
      <p style={{ fontSize: 13, color: '#6F7C75', lineHeight: 1.6, marginBottom: 12 }}>
        Exportez vos listes depuis votre logiciel métier (Excel ou CSV) et déposez-les ici, une à la fois.
        Pour mettre Holiris à jour, déposez simplement le dernier export : seuls les changements sont appliqués, après votre validation.
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
              {comparaison?.erreur ? <div style={{ fontSize: 13, color: '#C4606A' }}>{comparaison.erreur}</div>
                : !agendaPret ? <div style={{ fontSize: 13, color: '#9BB5AA' }}>Comparaison avec votre agenda…</div>
                  : (
                    <div style={{ fontSize: 13, color: '#4A8870' }}>
                      {resume(compte('nouveau'), compte('maj'), compte('a_jour'), ['nouveaux', 'modifiés', 'déjà à jour'])}
                      {' '}<span style={{ color: '#9BB5AA' }}>· pour {pluriel(new Set(passages.map(p => p.seniorId)).size, 'client')}</span>
                    </div>
                  )}
              {annules.length > 0 && (
                <div style={encadre}>
                  <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13, color: '#1F2A24', cursor: 'pointer' }}>
                    <input type="checkbox" checked={supprimerAbsents} onChange={e => setSupprimerAbsents(e.target.checked)} style={{ accentColor: '#C4844A', marginTop: 2 }} />
                    <span>
                      Supprimer {pluriel(annules.length, 'passage importé auparavant et absent', 'passages importés auparavant et absents')} de ce fichier (annulés ou déplacés) :{' '}
                      {compter(annules.map(e => clients.find(c => c.id === e.seniorId)?.name || 'client'))}
                      <span style={{ display: 'block', fontSize: 11, color: '#9BB5AA', marginTop: 2 }}>Décochez si ce fichier ne contient qu&apos;une partie de vos clients. Les passages saisis à la main dans l&apos;agenda ne sont jamais supprimés.</span>
                    </span>
                  </label>
                </div>
              )}
              {lignes.some(l => l.raison === 'Déjà passé') && <div style={{ fontSize: 12, color: '#9BB5AA', marginTop: 4 }}>{pluriel(lignes.filter(l => l.raison === 'Déjà passé').length, 'ligne déjà passée ignorée', 'lignes déjà passées ignorées')}</div>}
              {lignes.some(l => l.raison === 'Client inconnu') && (
                <div style={alerte}>Clients introuvables dans Holiris : {compter(lignes.filter(l => l.raison === 'Client inconnu').map(l => l.nomClient))}. Importez d&apos;abord votre liste de clients, ou vérifiez l&apos;orthographe.</div>
              )}
              {lignes.some(l => l.raison === 'Intervenant inconnu') && (
                <div style={alerte}>Intervenants introuvables dans vos salariés : {compter(lignes.filter(l => l.raison === 'Intervenant inconnu').map(l => l.inconnu))}. Importez d&apos;abord votre liste de salariés, ou vérifiez l&apos;orthographe.</div>
              )}
              {nouvellesAffectations > 0 && (
                <div style={note}>
                  {pluriel(nouvellesAffectations, 'nouvelle affectation', 'nouvelles affectations')} salarié → client, créées automatiquement : chaque salarié concerné n&apos;est prévenu qu&apos;une fois (email et WhatsApp).
                </div>
              )}
            </div>
          ) : (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 13, color: '#4A8870' }}>
                {resume(nbEtat('nouveau'), nbEtat('maj'), nbEtat('a_jour'), lecture.type === 'clients'
                  ? ['nouveaux', 'mis à jour (ville)', 'déjà à jour'] : ['nouveaux', 'mis à jour (fonction ou téléphone)', 'déjà à jour'])}
                {lecture.type === 'salaries' && nbEtat('nouveau') > 0 && <span style={{ color: '#9BB5AA' }}> · aucune invitation n&apos;est envoyée à l&apos;import</span>}
              </div>
              {lecture.type === 'salaries' && absents.length > 0 && (
                <div style={encadre}>
                  <div style={{ fontSize: 13, color: '#1F2A24', marginBottom: 8 }}>
                    {pluriel(absents.length, 'salarié absent', 'salariés absents')} de ce fichier : cochez ceux qui ont quitté la structure pour les archiver.
                    <span style={{ display: 'block', fontSize: 11, color: '#9BB5AA', marginTop: 2 }}>Un salarié archivé n&apos;a plus accès aux dossiers de vos clients.</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {absents.map(s => {
                      const coche = aArchiver.includes(s.id)
                      return (
                        <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, padding: '5px 12px', borderRadius: 20, cursor: 'pointer', border: '1px solid ' + (coche ? '#C4844A' : '#E8EFEB'), background: coche ? '#FDF3E7' : '#fff', color: coche ? '#C4844A' : '#6F7C75' }}>
                          <input type="checkbox" checked={coche} onChange={() => setAArchiver(coche ? aArchiver.filter(id => id !== s.id) : [...aArchiver, s.id])} style={{ accentColor: '#C4844A' }} />
                          {s.prenom} {s.nom}
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {lecture.type === 'clients' && absents.length > 0 && (
                <div style={note}>
                  {pluriel(absents.length, 'client absent', 'clients absents')} de ce fichier : {absents.map(c => c.name).join(', ')}. Leur dossier n&apos;est pas modifié.
                </div>
              )}
            </div>
          )}

          <div style={{ maxHeight: 280, overflow: 'auto', border: '1px solid #E8EFEB', borderRadius: 8, marginBottom: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ background: '#FAFCFC', color: '#9BB5AA', textAlign: 'left' }}>
                {[...COLONNES[lecture.type].map(c => c[0]), ''].map(t => <th key={t} style={{ padding: '6px 10px', fontWeight: 500 }}>{t}</th>)}
              </tr></thead>
              <tbody>
                {lignesEtat.slice(0, APERCU).map((l, i) => {
                  const [libelle, couleur] = l.raison ? [l.raison, '#C4844A'] : ETATS[l.etat] || ['…', '#9BB5AA']
                  return (
                    <tr key={i} style={{ borderTop: '1px solid #F0F4F2', color: l.raison || l.etat === 'a_jour' ? '#9BB5AA' : '#1F2A24' }}>
                      {COLONNES[lecture.type].map(([t, val]) => <td key={t} style={{ padding: '6px 10px' }}>{val(l)}</td>)}
                      <td style={{ padding: '6px 10px', color: couleur, whiteSpace: 'nowrap' }}>{libelle}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {lignes.length > APERCU && <div style={{ fontSize: 11, color: '#9BB5AA', padding: '6px 10px' }}>… et {pluriel(lignes.length - APERCU, 'autre ligne', 'autres lignes')}</div>}
          </div>
        </>
      )}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {lecture?.type && (
          <button onClick={importer} disabled={envoi || !aEnvoyer} style={{ ...btn, opacity: aEnvoyer ? 1 : 0.5 }}>
            {envoi ? 'Mise à jour…' : !aEnvoyer ? (lecture.type === 'planning' && !agendaPret ? 'Comparaison…' : 'Tout est déjà à jour') : libelleBouton + ' (' + pluriel(aEnvoyer, 'changement') + ')'}
          </button>
        )}
        <button onClick={onFermer} style={btnGris}>Fermer</button>
      </div>
    </div>
  )
}
