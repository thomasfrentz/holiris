import { Cormorant_Garamond, DM_Sans } from 'next/font/google'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  style: ['normal', 'italic'],
  variable: '--font-display',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  variable: '--font-body',
})

export const metadata = {
  title: 'Holiris — Prendre soin de ceux qui nous sont chers',
  description: 'Plateforme de coordination familiale pour le suivi du bien-être des personnes âgées',
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
    <html lang="fr" className={`${cormorant.variable} ${dmSans.variable}`}>
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
