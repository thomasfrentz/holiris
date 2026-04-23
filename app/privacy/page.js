export default function Privacy() {
  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: 40, fontFamily: 'Georgia, serif', color: '#333' }}>
      <h1 style={{ color: '#12201a', marginBottom: 8 }}>Politique de confidentialité</h1>
      <p style={{ color: '#888', marginBottom: 32 }}>Dernière mise à jour : avril 2026</p>

      <h2>Holiris — Plateforme de suivi des personnes âgées</h2>
      <p>Holiris est une plateforme de coordination familiale pour le suivi du bien-être des personnes âgées dans les Pyrénées-Orientales.</p>

      <h2 style={{ marginTop: 28 }}>Données collectées</h2>
      <p>Holiris collecte les données suivantes :</p>
      <ul>
        <li>Nom, prénom et email des membres de la famille</li>
        <li>Numéro de téléphone des intervenants</li>
        <li>Notes de bien-être et observations sur les personnes suivies</li>
        <li>Événements et rendez-vous de l'agenda</li>
      </ul>

      <h2 style={{ marginTop: 28 }}>Utilisation des données</h2>
      <p>Les données sont utilisées uniquement pour :</p>
      <ul>
        <li>Coordonner le suivi entre la famille et les intervenants</li>
        <li>Envoyer des notifications et rappels via WhatsApp</li>
        <li>Générer des synthèses automatiques via intelligence artificielle</li>
      </ul>

      <h2 style={{ marginTop: 28 }}>Partage des données</h2>
      <p>Holiris ne vend ni ne partage vos données personnelles avec des tiers à des fins commerciales.</p>

      <h2 style={{ marginTop: 28 }}>Sécurité</h2>
      <p>Les données sont hébergées sur des serveurs sécurisés (Supabase). L'accès est protégé par authentification.</p>

      <h2 style={{ marginTop: 28 }}>Contact</h2>
      <p>Pour toute question : <a href="mailto:contact@holiris.vercel.app" style={{ color: '#2ecc71' }}>contact@holiris.vercel.app</a></p>
    </div>
  )
}
