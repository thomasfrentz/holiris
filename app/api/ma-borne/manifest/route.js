// Manifeste propre à la borne sur téléphone : l'icône ajoutée à l'écran d'accueil rouvre le lien
// personnel de l'intervenant (et non /note, qui demande un compte)
export function GET(request) {
  const j = new URL(request.url).searchParams.get('j') || ''
  const startUrl = /^[A-Za-z0-9_-]{24,64}$/.test(j) ? '/ma-borne?j=' + j : '/ma-borne'
  return new Response(JSON.stringify({
    id: '/ma-borne',
    name: 'Holiris',
    short_name: 'Holiris',
    description: 'Laisser une note après chaque visite',
    start_url: startUrl,
    scope: '/ma-borne',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FDFBF7',
    theme_color: '#7FAF9B',
    lang: 'fr',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }), { headers: { 'Content-Type': 'application/manifest+json', 'Cache-Control': 'no-store' } })
}
