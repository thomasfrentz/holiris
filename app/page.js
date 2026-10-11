import { redirect } from 'next/navigation'
import { utilisateurCourant } from '@/lib/serveur'
import Landing from './landing/page'
import RedirectionSiConnecte from './components/RedirectionSiConnecte'

export const metadata = { alternates: { canonical: '/' } }

// Page d'accueil rendue côté serveur : Google lit directement tout le texte de la présentation.
// Un utilisateur connecté est envoyé vers son tableau de bord.
export default async function Home() {
  const user = await utilisateurCourant().catch(() => null)
  if (user) redirect('/app')

  const donneesStructurees = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://holiris.fr/#organisation',
        name: 'Holiris',
        url: 'https://holiris.fr',
        logo: 'https://holiris.fr/icons/icon-512.png',
        email: 'thomas.frentz@holiris.fr',
        founder: { '@type': 'Person', name: 'Thomas Frentz' },
        areaServed: { '@type': 'AdministrativeArea', name: 'Pyrénées-Orientales' },
        description: 'Coordination du maintien à domicile des seniors : une borne chez la personne âgée et une application pour sa famille et ses intervenants.',
      },
      {
        '@type': 'WebSite',
        '@id': 'https://holiris.fr/#site',
        name: 'Holiris',
        url: 'https://holiris.fr',
        inLanguage: 'fr-FR',
        publisher: { '@id': 'https://holiris.fr/#organisation' },
      },
    ],
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(donneesStructurees) }} />
      <RedirectionSiConnecte />
      <Landing />
    </>
  )
}
