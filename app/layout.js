// Polices chargées depuis Google Fonts dans le navigateur (et non via next/font au build),
// pour que le déploiement ne dépende plus du téléchargement des polices.
const POLICES = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500;1,600&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300;1,400;1,500&display=swap'

export const metadata = {
  metadataBase: new URL('https://holiris.fr'),
  title: 'Holiris — Suivi des seniors à domicile, famille et intervenants',
  description: 'Holiris relie la personne âgée, sa famille et ses intervenants à domicile : notes après chaque passage, messages, agenda et alertes. Une borne chez le senior, une application pour les proches. Pyrénées-Orientales.',
  applicationName: 'Holiris',
  openGraph: {
    type: 'website',
    locale: 'fr_FR',
    siteName: 'Holiris',
    url: 'https://holiris.fr',
    title: 'Holiris — Suivi des seniors à domicile',
    description: 'Après chaque passage, l\'intervenant laisse une note et la famille a des nouvelles. Pyrénées-Orientales.',
    images: [{ url: '/icons/icon-512.png', width: 512, height: 512, alt: 'Holiris' }],
  },
  // Application installable sur l'écran d'accueil (voir app/manifest.js)
  appleWebApp: { capable: true, title: 'Holiris', statusBarStyle: 'default' },
  icons: {
    icon: [{ url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
    apple: [{ url: '/icons/apple-touch-icon.png', sizes: '180x180' }],
  },
}

export const viewport = {
  themeColor: '#7FAF9B',
}

export default function RootLayout({ children }) {
  return (
    <html lang="fr" style={{ '--font-display': "'Cormorant Garamond', Georgia, serif", '--font-body': "'DM Sans', system-ui, sans-serif" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={POLICES} />
      </head>
      <body style={{
        margin: 0,
        padding: 0,
        fontFamily: 'var(--font-body, DM Sans, system-ui, sans-serif)',
        background: '#1E2820',
        color: '#FAFCFA',
      }}>
        {children}
      </body>
    </html>
  )
}
