'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

// Guide pas à pas pour installer Holiris sur l'écran d'accueil du téléphone (accessible sans connexion)

const C = { encre: '#1F2A24', gris: '#6F7C75', grisClair: '#9BB5AA', sauge: '#7FAF9B', saugeFonce: '#4A8870', saugeClair: '#EAF4EF', lilas: '#8B6FAA', lilasClair: '#F3EDF7', ambre: '#C4844A', ambreClair: '#FDF3E7', bord: '#E6EDE9' }

// Icônes dessinées comme dans les navigateurs, pour que la personne les reconnaisse
const IconePartager = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#007AFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ verticalAlign: 'middle' }}>
    <path d="M12 3v12" /><path d="M8 7l4-4 4 4" /><path d="M7 10H5.5A1.5 1.5 0 0 0 4 11.5v8A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-8A1.5 1.5 0 0 0 18.5 10H17" />
  </svg>
)
const IconeAjouter = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.encre} strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" style={{ verticalAlign: 'middle' }}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="4" /><path d="M12 8v8M8 12h8" />
  </svg>
)
const Pastille = ({ children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minWidth: 30, height: 30, padding: '0 8px', borderRadius: 8, background: '#F2F2F4', border: '1px solid #DADADF', fontSize: 18, fontWeight: 700, color: C.encre, verticalAlign: 'middle', lineHeight: 1 }}>{children}</span>
)

const ETAPES = {
  ios: [
    { titre: 'Ouvrez Safari', texte: <>Sur iPhone, l&apos;installation se fait uniquement avec <strong>Safari</strong> (la boussole bleue). Si vous avez ouvert ce lien depuis Gmail, Outlook, Facebook ou WhatsApp, utilisez le bouton « Copier le lien » ci-dessous, puis collez-le dans Safari.</> },
    { titre: 'Allez sur holiris.fr/note', texte: <>Tapez <strong>holiris.fr/note</strong> dans la barre d&apos;adresse et connectez-vous avec votre email et votre mot de passe.</> },
    { titre: 'Touchez le bouton Partager', texte: <>C&apos;est le carré avec une flèche vers le haut <IconePartager />. Il se trouve <strong>en bas de l&apos;écran</strong>, au milieu de la barre d&apos;outils. Vous ne le voyez pas ? Touchez d&apos;abord les trois points <Pastille>⋯</Pastille> en bas à droite, puis <strong>« Partager »</strong>. Si la barre a disparu, faites défiler la page doucement vers le haut pour la faire réapparaître.</> },
    { titre: 'Choisissez « Sur l’écran d’accueil »', texte: <>Dans la fenêtre qui s&apos;ouvre, <strong>faites glisser la liste vers le haut</strong> : l&apos;option <strong>« Sur l&apos;écran d&apos;accueil »</strong> <IconeAjouter /> se trouve sous les applications et les contacts.</> },
    { titre: 'Touchez « Ajouter »', texte: <>En haut à droite. L&apos;icône Holiris apparaît sur votre écran d&apos;accueil, comme une application : touchez-la pour dicter une note en un geste.</> },
  ],
  android: [
    { titre: 'Ouvrez Chrome', texte: <>Utilisez le navigateur <strong>Chrome</strong> (le rond rouge, jaune et vert). Si vous avez ouvert ce lien depuis Gmail, Facebook ou WhatsApp, utilisez le bouton « Copier le lien » ci-dessous, puis collez-le dans Chrome.</> },
    { titre: 'Allez sur holiris.fr/note', texte: <>Tapez <strong>holiris.fr/note</strong> dans la barre d&apos;adresse et connectez-vous avec votre email et votre mot de passe.</> },
    { titre: 'Touchez les trois points', texte: <>Le bouton <Pastille>⋮</Pastille> se trouve <strong>en haut à droite</strong> de l&apos;écran, à côté de la barre d&apos;adresse. (Si un bandeau « Installer l&apos;application » apparaît en bas de l&apos;écran, vous pouvez directement le toucher.)</> },
    { titre: 'Choisissez « Installer l’application »', texte: <>Selon votre téléphone, l&apos;option s&apos;appelle <strong>« Installer l&apos;application »</strong> ou <strong>« Ajouter à l&apos;écran d&apos;accueil »</strong>.</> },
    { titre: 'Confirmez avec « Installer »', texte: <>L&apos;icône Holiris apparaît sur votre écran d&apos;accueil, comme une application : touchez-la pour dicter une note en un geste.</> },
  ],
}

export default function Installer() {
  const [systeme, setSysteme] = useState('ios')
  const [copie, setCopie] = useState(false)

  useEffect(() => {
    // Onglet du téléphone utilisé, détecté au chargement (modifiable)
    // eslint-disable-next-line react-hooks/set-state-in-effect -- dépend du navigateur, inconnu au rendu serveur
    if (/android/i.test(navigator.userAgent)) setSysteme('android')
  }, [])

  async function copierLien() {
    try {
      await navigator.clipboard.writeText('https://holiris.fr/note')
      setCopie(true)
      setTimeout(() => setCopie(false), 2500)
    } catch {}
  }

  const onglet = actif => ({ flex: 1, padding: '12px 10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 15, fontWeight: 500, background: actif ? '#fff' : 'transparent', color: actif ? C.encre : C.gris, boxShadow: actif ? '0 2px 8px rgba(74,60,40,0.08)' : 'none' })

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #FDFBF7 0%, #F7F2EA 55%, #F4EEF6 100%)', fontFamily: 'var(--font-body), "DM Sans", sans-serif', color: C.encre, padding: '28px 16px 40px' }}>
      <div style={{ maxWidth: 560, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div style={{ fontSize: 40 }}>📲</div>
          <h1 style={{ fontFamily: 'var(--font-display), "Cormorant Garamond", serif', fontSize: 34, fontWeight: 500, margin: '6px 0 8px' }}>Installer Holiris sur votre téléphone</h1>
          <p style={{ fontSize: 15, color: C.gris, lineHeight: 1.6 }}>Une icône sur votre écran d&apos;accueil pour dicter une note en un geste. Rien à télécharger sur l&apos;App Store ou le Play Store.</p>
        </div>

        <div style={{ display: 'flex', gap: 6, background: '#EFEAE2', borderRadius: 14, padding: 5, marginBottom: 18 }}>
          <button onClick={() => setSysteme('ios')} style={onglet(systeme === 'ios')}>iPhone / iPad</button>
          <button onClick={() => setSysteme('android')} style={onglet(systeme === 'android')}>Android</button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {ETAPES[systeme].map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, background: '#fff', borderRadius: 18, padding: '16px 18px', boxShadow: '0 4px 14px rgba(74,60,40,0.05)' }}>
              <span style={{ width: 34, height: 34, borderRadius: '50%', background: C.saugeClair, color: C.saugeFonce, fontWeight: 600, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, marginBottom: 4 }}>{e.titre}</div>
                <div style={{ fontSize: 15, color: C.gris, lineHeight: 1.6 }}>{e.texte}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
          <button onClick={copierLien} style={{ flex: '1 1 200px', background: '#fff', color: C.saugeFonce, border: `1.5px solid ${C.sauge}`, borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>
            {copie ? '✓ Lien copié' : '🔗 Copier le lien holiris.fr/note'}
          </button>
          <Link href="/note" style={{ flex: '1 1 200px', textAlign: 'center', background: C.sauge, color: '#fff', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 500, textDecoration: 'none' }}>
            Ouvrir holiris.fr/note
          </Link>
        </div>

        <div style={{ background: C.ambreClair, borderRadius: 14, padding: '14px 16px', marginTop: 18, fontSize: 14, color: C.gris, lineHeight: 1.6 }}>
          <strong style={{ color: C.ambre }}>Vous n&apos;y arrivez pas ?</strong> Écrivez à <a href="mailto:thomas.frentz@holiris.fr" style={{ color: C.saugeFonce }}>thomas.frentz@holiris.fr</a> ou appelez le 06 71 78 52 31 : nous vous guidons. En attendant, vous pouvez toujours envoyer vos nouvelles par WhatsApp.
        </div>
      </div>
    </div>
  )
}
