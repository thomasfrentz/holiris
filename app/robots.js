// robots.txt : seules les pages publiques intéressent les moteurs de recherche
export default function robots() {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/app', '/borne', '/ma-borne', '/note', '/admin', '/landing'] },
    sitemap: 'https://holiris.fr/sitemap.xml',
    host: 'https://holiris.fr',
  }
}
