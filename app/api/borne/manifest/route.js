// Manifeste de l'application « Ma Borne Holiris » (tablette au domicile) : distinct de l'application Holiris
// des proches et des intervenants, plein écran et en paysage ; rouvre la borne avec son code s'il est connu
export function GET(request) {
  const code = (new URL(request.url).searchParams.get('code') || '').trim().toUpperCase()
  const startUrl = /^BORNE-[A-Z0-9]{3,12}$/.test(code) ? '/borne?code=' + code : '/borne'
  return new Response(JSON.stringify({
    id: '/borne',
    name: 'Ma Borne Holiris',
    short_name: 'Ma Borne Holiris',
    description: 'La borne Holiris du domicile : nouvelles, messages et SOS',
    start_url: startUrl,
    scope: '/borne',
    display: 'fullscreen',
    display_override: ['fullscreen', 'standalone'],
    orientation: 'landscape',
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
