// PDF d'un document signé (côté serveur) : texte signé, choix, signature et preuve d'intégrité
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

const SAUGE = rgb(0.29, 0.53, 0.44)
const ENCRE = rgb(0.12, 0.16, 0.14)
const GRIS = rgb(0.4, 0.45, 0.42)

// Les polices standard du PDF ne connaissent pas certains caractères : on les remplace
const nettoyer = t => String(t ?? '').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, '-').replace(/…/g, '...').replace(/ /g, ' ').replace(/[^\x00-\xFF€œŒ]/g, '')

export async function genererPdf(doc) {
  const pdf = await PDFDocument.create()
  const normal = await pdf.embedFont(StandardFonts.Helvetica)
  const gras = await pdf.embedFont(StandardFonts.HelveticaBold)
  const L = 595, H = 842, MARGE = 56, LARGEUR = L - 2 * MARGE
  let page = pdf.addPage([L, H])
  let y = H - MARGE

  const nouvellePageSiBesoin = hauteur => {
    if (y - hauteur < MARGE + 30) { page = pdf.addPage([L, H]); y = H - MARGE }
  }
  const ecrire = (texte, { police = normal, taille = 10.5, couleur = ENCRE, interligne = 1.45, avant = 0 } = {}) => {
    y -= avant
    const mots = nettoyer(texte).split(/\s+/)
    let ligne = ''
    const lignes = []
    for (const mot of mots) {
      const essai = ligne ? ligne + ' ' + mot : mot
      if (police.widthOfTextAtSize(essai, taille) > LARGEUR && ligne) { lignes.push(ligne); ligne = mot } else ligne = essai
    }
    if (ligne) lignes.push(ligne)
    for (const l of lignes) {
      nouvellePageSiBesoin(taille * interligne)
      page.drawText(l, { x: MARGE, y: y - taille, size: taille, font: police, color: couleur })
      y -= taille * interligne
    }
  }

  const c = doc.contenu
  page.drawText('Holiris', { x: MARGE, y: y - 20, size: 22, font: gras, color: SAUGE })
  y -= 34
  ecrire(c.titre, { police: gras, taille: 16, avant: 6 })
  ecrire(`Personne suivie : ${c.senior}  -  Version du document : ${c.version}`, { taille: 9.5, couleur: GRIS, avant: 2 })
  y -= 8

  for (const s of c.sections || []) {
    if (s.titre) ecrire(s.titre, { police: gras, taille: 11, avant: 8 })
    ecrire(s.texte, { avant: s.titre ? 2 : 6 })
  }
  for (const a of c.autorisations || []) {
    const accord = doc.choix?.[a.cle]
    ecrire(`${accord ? '[OUI]' : '[NON]'}  ${a.libelle}`, { police: accord ? gras : normal, avant: 6 })
  }
  ecrire(c.engagement, { police: gras, avant: 14 })

  // Signature
  nouvellePageSiBesoin(170)
  y -= 16
  const qualite = doc.signataire_qualite === 'personne' ? `la personne suivie` : `${doc.signataire_qualite}, pour le compte de ${c.senior}`
  const date = new Date(doc.signe_at).toLocaleString('fr-FR', { timeZone: 'Europe/Paris', dateStyle: 'long', timeStyle: 'short' })
  ecrire(`Signé électroniquement par ${doc.signataire_nom} (${qualite}), le ${date}.`)
  if (doc.signature?.startsWith('data:image/png;base64,')) {
    const image = await pdf.embedPng(Buffer.from(doc.signature.split(',')[1], 'base64'))
    const echelle = Math.min(220 / image.width, 90 / image.height)
    page.drawImage(image, { x: MARGE, y: y - image.height * echelle - 6, width: image.width * echelle, height: image.height * echelle })
    y -= image.height * echelle + 14
  }
  ecrire(`Empreinte SHA-256 du document signé : ${doc.empreinte}`, { taille: 8, couleur: GRIS, avant: 6 })
  ecrire(`Référence : ${doc.id}`, { taille: 8, couleur: GRIS })

  pdf.setTitle(nettoyer(`${c.titre} - ${c.senior}`))
  pdf.setAuthor('Holiris')
  return Buffer.from(await pdf.save())
}
