// sitemap.xml : pages publiques proposées à Google
export default function sitemap() {
  return [
    { url: 'https://holiris.fr', changeFrequency: 'monthly', priority: 1 },
    { url: 'https://holiris.fr/demande-acces', changeFrequency: 'yearly', priority: 0.6 },
    { url: 'https://holiris.fr/privacy', changeFrequency: 'yearly', priority: 0.2 },
  ]
}
