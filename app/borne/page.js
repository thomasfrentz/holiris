import Borne from './Borne'

// Application « Ma Borne Holiris » : son propre manifeste (nom, plein écran, paysage), donné dès le chargement.
// Le code de la borne y figure quand il est dans l'adresse, pour que l'icône rouvre directement cette borne.
export async function generateMetadata({ searchParams }) {
  const { code } = await searchParams
  return {
    title: 'Ma Borne Holiris',
    applicationName: 'Ma Borne Holiris',
    manifest: '/api/borne/manifest' + (code ? '?code=' + encodeURIComponent(code) : ''),
    appleWebApp: { capable: true, title: 'Ma Borne Holiris', statusBarStyle: 'default' },
  }
}

export default function Page() {
  return <Borne />
}
