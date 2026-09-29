// Manifeste de l'application installable (écran d'accueil Android / iPhone)
export default function manifest() {
  return {
    name: 'Holiris',
    short_name: 'Holiris',
    description: 'Les nouvelles de vos proches, après chaque passage',
    start_url: '/note',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FCFDFC',
    theme_color: '#7FAF9B',
    lang: 'fr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Note vocale', url: '/note', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
