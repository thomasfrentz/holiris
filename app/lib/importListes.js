// Lecture des listes exportées des logiciels métier : salariés, clients ou planning des passages.
// Fichier Excel (.xlsx), CSV (; , ou tabulations) ou copier-coller depuis Excel. Le type de liste
// est reconnu d'après la ligne d'intitulés.

const sansAccents = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
const entete = t => sansAccents(t).replace(/[^a-z0-9]+/g, ' ').trim()
const nomPropre = n => n.toLowerCase().replace(/(^|[\s-])\S/g, x => x.toUpperCase())
const CIVILITE = /^(m|mr|mme|mlle|monsieur|madame|mademoiselle)\.?\s+/i

// Nom comparé sans civilité, accents, majuscules ni espaces en trop, quel que soit l'ordre des mots
// (« DUPONT Marie » / « Marie Dupont », « ROUX Jean Pierre » / « Jean-Pierre Roux »)
const normaliserNom = n => sansAccents(String(n || '').replace(CIVILITE, '')).replace(/[^a-z]+/g, ' ').trim()
const motsTries = n => n.split(' ').sort().join(' ')
export const memeNom = (a, b) => {
  const x = normaliserNom(a), y = normaliserNom(b)
  return !!x && (x === y || motsTries(x) === motsTries(y))
}

// « DUPONT Marie » ou « Marie Dupont » : le mot en majuscules est le nom
function separerNom(complet) {
  const mots = String(complet || '').replace(CIVILITE, '').split(/\s+/).filter(Boolean)
  const majuscules = mots.filter(m => m.length > 1 && m === m.toUpperCase())
  if (majuscules.length && majuscules.length < mots.length) {
    return { nom: majuscules.join(' '), prenom: mots.filter(m => !majuscules.includes(m)).join(' ') }
  }
  return { prenom: mots[0] || '', nom: mots.slice(1).join(' ') }
}

// ── Dates et heures : texte (10/11/2026, 2026-11-10, 8h30…) ou numéro de série Excel ──
const deux = n => String(n).padStart(2, '0')

function dateValide(a, m, j) {
  const d = new Date(Date.UTC(a, m - 1, j))
  return d.getUTCFullYear() === a && d.getUTCMonth() === m - 1 && d.getUTCDate() === j ? `${a}-${deux(m)}-${deux(j)}` : ''
}

function lireHeure(v) {
  const t = String(v ?? '').trim()
  if (/^\d*\.\d+$/.test(t) || /^0$/.test(t)) {
    const minutes = Math.round((+t % 1) * 1440)
    return deux(Math.floor(minutes / 60) % 24) + ':' + deux(minutes % 60)
  }
  const m = t.match(/(\d{1,2})\s*[:hH]\s*(\d{2})?/)
  return m && +m[1] < 24 && +(m[2] || 0) < 60 ? deux(m[1]) + ':' + deux(m[2] || 0) : ''
}

// Années sur deux chiffres : passées pour une date de naissance, à venir pour un passage
function lireDate(v, { naissance = false } = {}) {
  const t = String(v ?? '').trim()
  if (/^\d{4,5}(\.\d+)?$/.test(t)) {
    const d = new Date(Math.round((+t - 25569) * 86400000))
    const heure = t.includes('.') ? lireHeure('0.' + t.split('.')[1]) : ''
    return { date: dateValide(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate()), heure }
  }
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return { date: dateValide(+m[1], +m[2], +m[3]), heure: lireHeure(t.slice(m.index + m[0].length)) }
  m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/)
  if (!m) return { date: '', heure: '' }
  let annee = +m[3]
  if (m[3].length === 2) annee += naissance && annee > new Date().getFullYear() % 100 ? 1900 : 2000
  return { date: dateValide(annee, +m[2], +m[1]), heure: lireHeure(t.slice(m.index + m[0].length)) }
}

// ── Modèles de liste : intitulés de colonnes reconnus, tels qu'ils apparaissent dans les exports ──
const BENEFICIAIRE = '(du |de l |de la )?(beneficiaire|client|usager|patient|personne aidee|personne accompagnee)'
const MODELES = {
  planning: {
    colonnes: [
      ['clientPrenom', new RegExp('^prenom ' + BENEFICIAIRE + '$')],
      ['client', new RegExp('^(nom )?' + BENEFICIAIRE + '$')],
      ['intervenantPrenom', /^prenom (de l |du )?(intervenant|salarie)$/],
      ['intervenant', /^(nom (de l |du )?)?(intervenants?|salaries?|auxiliaire|aide a domicile|employe|personnel|ressource)( .*)?$/],
      ['date', /^(date|jour|debut)(?!.*naiss)/], // « Début » : date et heure dans la même colonne
      ['heure', /^(heures?|debut|horaires?|h debut)( (de )?(debut|arrivee))?$/],
      ['prestation', /^(prestation|activite|type|libelle|motif|nature|intervention|tache)/],
      ['naissance', /^(date (de )?naiss|ne le|nee le|ddn)/],
    ],
    suffit: i => i.client !== undefined && i.date !== undefined && (i.intervenant !== undefined || i.heure !== undefined) && i.naissance === undefined,
  },
  salaries: {
    colonnes: [
      ['prenom', /^(prenom|first ?name)/],
      ['nomComplet', /^(nom complet|nom et prenom|salarie|intervenant|identite|nom prenom)$/],
      ['nom', /^(nom|nom de famille|last ?name|nom d usage)$/],
      ['role', /^(fonction|poste|qualification|metier|role|emploi|intitule)/],
      ['telephone', /(tel|portable|mobile|gsm|whatsapp)/],
      ['email', /(e ?mail|courriel|^mail)/],
    ],
    suffit: i => i.email !== undefined && (i.nom !== undefined || i.nomComplet !== undefined),
  },
  clients: {
    colonnes: [
      ['prenom', /^prenom/],
      ['nomComplet', new RegExp('^(nom complet|nom et prenom|nom prenom|identite|(nom )?' + BENEFICIAIRE + ')$')],
      ['nom', new RegExp('^nom( de famille| d usage| de naissance| marital)?( ' + BENEFICIAIRE + ')?$')],
      ['naissance', /^(date (de )?naiss|ne le|nee le|ddn|naissance)/],
      ['ville', /^(ville|commune|localite|cp ville|code postal ville)/],
      ['adresse', /^adresse/],
    ],
    suffit: i => (i.nom !== undefined || i.nomComplet !== undefined) && (i.naissance !== undefined || i.ville !== undefined || i.adresse !== undefined),
  },
}

function indexColonnes(entetes, colonnes) {
  const index = {}
  entetes.map(entete).forEach((e, i) => {
    const trouve = colonnes.find(([cle, motif]) => index[cle] === undefined && motif.test(e))
    if (trouve) index[trouve[0]] = i
  })
  return index
}

// Prénom et nom, depuis des colonnes séparées ou une colonne « Nom et prénom »
function lireNom(val) {
  const prenom = val('prenom'), nom = val('nom'), complet = val('nomComplet')
  const propre = (p, n) => ({ prenom: nomPropre(p), nom: nomPropre(n) })
  if (prenom && nom) return propre(prenom, nom)
  const texte = nom || complet
  // Colonnes « Prénom » et « Nom du bénéficiaire » : cette dernière ne contient alors que le nom
  if (prenom && !normaliserNom(texte).includes(normaliserNom(prenom))) return propre(prenom, texte)
  const separe = separerNom(texte)
  return propre(separe.prenom, separe.nom)
}

const LECTEURS = {
  salaries: val => {
    const telephone = val('telephone')
    return {
      ...lireNom(val), role: val('role'), email: val('email').toLowerCase(),
      telephone: /^[1-9]\d{8}$/.test(telephone) ? '0' + telephone : telephone, // 0 initial perdu par Excel
    }
  },
  clients: val => {
    const ville = val('ville').replace(/^\d{5}\s*/, '') || (val('adresse').match(/\b\d{5}\s+([^\d,]+)$/)?.[1] || '')
    return { ...lireNom(val), dateNaissance: lireDate(val('naissance'), { naissance: true }).date, ville: nomPropre(ville.trim()) }
  },
  planning: val => {
    const { date, heure } = lireDate(val('date'))
    return {
      client: [val('clientPrenom'), val('client')].filter(Boolean).join(' '),
      intervenants: [val('intervenantPrenom'), val('intervenant')].filter(Boolean).join(' ').split(/\s*[/;+]\s*|\s+et\s+/).filter(Boolean),
      date, heure: lireHeure(val('heure')) || heure, prestation: val('prestation'),
    }
  },
}

// Tableau de lignes → { type, lignes } ou { erreur }. La ligne d'intitulés peut être précédée d'un titre.
export function analyser(tableau) {
  const lignes = tableau.map(l => l.map(c => String(c ?? '').trim())).filter(l => l.some(Boolean))
  for (let n = 0; n < Math.min(10, lignes.length); n++) {
    for (const [type, modele] of Object.entries(MODELES)) {
      const index = indexColonnes(lignes[n], modele.colonnes)
      if (!modele.suffit(index)) continue
      const intitules = lignes[n].join('|')
      const elements = lignes.slice(n + 1).filter(l => l.join('|') !== intitules).map(c => {
        const val = cle => index[cle] !== undefined ? c[index[cle]] || '' : ''
        return LECTEURS[type](val)
      })
      if (!elements.length) return { erreur: 'La liste ne contient aucune ligne sous ses intitulés.' }
      return { type, lignes: elements }
    }
  }
  return { erreur: 'Liste non reconnue. La première ligne doit contenir les intitulés des colonnes : « Nom », « Prénom » et « Email » pour des salariés ; « Nom » et « Date de naissance » ou « Ville » pour des clients ; « Bénéficiaire », « Date » et « Intervenant » pour un planning.' }
}

// ── Texte collé ou fichier CSV ──
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

export function lireTexte(texte) {
  const lignes = texte.split(/\r?\n/).filter(l => l.trim())
  const echantillon = lignes.slice(0, 10).join('\n')
  const sep = ['\t', ';', ','].sort((a, b) => echantillon.split(b).length - echantillon.split(a).length)[0]
  return lignes.map(l => decouper(l, sep))
}

// ── Fichier Excel (.xlsx) : une archive zip de fichiers XML, lue dans le navigateur ──
async function fichiersZip(tampon, voulu) {
  const v = new DataView(tampon), o = new Uint8Array(tampon), texte = new TextDecoder()
  let fin = -1
  for (let i = o.length - 22; i >= Math.max(0, o.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { fin = i; break }
  if (fin < 0) throw new Error('Fichier Excel illisible.')
  const fichiers = {}
  let p = v.getUint32(fin + 16, true)
  for (let k = v.getUint16(fin + 10, true); k > 0; k--) {
    const methode = v.getUint16(p + 10, true), taille = v.getUint32(p + 20, true)
    const lnom = v.getUint16(p + 28, true), local = v.getUint32(p + 42, true)
    const nom = texte.decode(o.subarray(p + 46, p + 46 + lnom))
    p += 46 + lnom + v.getUint16(p + 30, true) + v.getUint16(p + 32, true)
    if (!voulu(nom)) continue
    const debut = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true)
    const brut = o.subarray(debut, debut + taille)
    fichiers[nom] = texte.decode(methode === 8
      ? await new Response(new Blob([brut]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()
      : brut)
  }
  return fichiers
}

const colonneExcel = ref => {
  const lettres = String(ref || '').match(/^[A-Z]+/)?.[0]
  return lettres ? [...lettres].reduce((n, l) => n * 26 + l.charCodeAt(0) - 64, 0) - 1 : undefined
}

async function lireXlsx(tampon) {
  const f = await fichiersZip(tampon, n => n.startsWith('xl/worksheets/sheet') || ['xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/sharedStrings.xml'].includes(n))
  const xml = t => new DOMParser().parseFromString(t || '<x/>', 'application/xml')
  const tous = (noeud, nom) => Array.from(noeud.getElementsByTagNameNS('*', nom))
  const texteDe = noeud => tous(noeud, 't').map(t => t.textContent).join('')

  // Première feuille du classeur
  let chemin = Object.keys(f).filter(n => n.startsWith('xl/worksheets/sheet')).sort()[0]
  const feuille = tous(xml(f['xl/workbook.xml']), 'sheet')[0]
  const rid = feuille && Array.from(feuille.attributes).find(a => a.localName === 'id')?.value
  const cible = rid && tous(xml(f['xl/_rels/workbook.xml.rels']), 'Relationship').find(r => r.getAttribute('Id') === rid)?.getAttribute('Target')
  if (cible) { const c = cible.startsWith('/') ? cible.slice(1) : 'xl/' + cible; if (f[c]) chemin = c }
  if (!chemin) throw new Error('Le fichier Excel ne contient aucune feuille.')

  const partages = tous(xml(f['xl/sharedStrings.xml']), 'si').map(texteDe)
  return tous(xml(f[chemin]), 'row').map(row => {
    const cellules = []
    for (const c of tous(row, 'c')) {
      const valeur = tous(c, 'v')[0]?.textContent ?? ''
      const type = c.getAttribute('t')
      cellules[colonneExcel(c.getAttribute('r')) ?? cellules.length] = type === 's' ? partages[+valeur] ?? '' : type === 'inlineStr' ? texteDe(c) : valeur
    }
    return Array.from(cellules, x => x ?? '')
  })
}

// Fichier choisi → tableau de lignes. Un CSV exporté sous Windows est souvent en Windows-1252 plutôt qu'en UTF-8.
export async function lireFichier(fichier) {
  const tampon = await fichier.arrayBuffer()
  const debut = new Uint8Array(tampon.slice(0, 4))
  if (debut[0] === 0xD0 && debut[1] === 0xCF) throw new Error('Ancien format Excel (.xls) : ouvrez le fichier dans Excel et enregistrez-le au format .xlsx ou CSV.')
  if (debut[0] === 0x50 && debut[1] === 0x4B) {
    try { return await lireXlsx(tampon) }
    catch { throw new Error('Fichier Excel illisible par votre navigateur : enregistrez-le au format CSV, ou mettez à jour votre navigateur.') }
  }
  try { return lireTexte(new TextDecoder('utf-8', { fatal: true }).decode(tampon)) }
  catch { return lireTexte(new TextDecoder('windows-1252').decode(tampon)) }
}
