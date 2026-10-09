import MaBorne from './MaBorne'

// Le manifeste est donné dès le chargement de la page : le téléphone le lit avant tout script,
// et l'icône ajoutée à l'écran d'accueil rouvre ainsi le lien personnel de l'intervenant
export async function generateMetadata({ searchParams }) {
  const { j } = await searchParams
  return {
    title: 'Holiris',
    manifest: '/api/ma-borne/manifest' + (j ? '?j=' + encodeURIComponent(j) : ''),
  }
}

export default function Page() {
  return <MaBorne />
}
