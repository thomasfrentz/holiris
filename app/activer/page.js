import Link from 'next/link'

// Ancien lien d'activation (codes d'accès, envoyés par WhatsApp avant octobre 2026) : il ne sert plus,
// l'accès se fait par l'email d'invitation. On oriente la personne au lieu d'afficher une erreur.
export const metadata = { title: 'Holiris — Accès' }

export default function Activer() {
  return (
    <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: 'linear-gradient(160deg, #FDFBF7 0%, #F7F2EA 55%, #F4EEF6 100%)', fontFamily: 'var(--font-body), "DM Sans", sans-serif', color: '#1F2A24' }}>
      <div style={{ background: '#fff', borderRadius: 24, padding: '40px 32px', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: '0 10px 30px rgba(74,60,40,0.08)' }}>
        <svg width="56" height="56" viewBox="0 0 64 64" fill="none" aria-hidden="true">
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.6" />
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.6" />
          <circle cx="32" cy="32" r="5" fill="#7FAF9B" /><circle cx="32" cy="32" r="2.2" fill="#fff" />
        </svg>
        <h1 style={{ fontFamily: 'var(--font-display), "Cormorant Garamond", serif', fontSize: 30, fontWeight: 500, margin: '12px 0 12px' }}>Bienvenue sur Holiris</h1>
        <p style={{ fontSize: 15, color: '#6F7C75', lineHeight: 1.6, marginBottom: 12 }}>
          Ce lien n&apos;est plus utilisé. Pour accéder à votre espace, ouvrez l&apos;email d&apos;invitation Holiris que vous avez reçu et cliquez sur <strong>« Créer mon compte »</strong>.
        </p>
        <p style={{ fontSize: 15, color: '#6F7C75', lineHeight: 1.6, marginBottom: 24 }}>
          Vous pouvez aussi continuer à envoyer vos nouvelles directement par WhatsApp, en message écrit ou vocal.
        </p>
        <Link href="/login" style={{ display: 'block', background: '#7FAF9B', color: '#fff', borderRadius: 14, padding: '14px', fontSize: 16, fontWeight: 500, textDecoration: 'none' }}>
          J&apos;ai déjà un compte : me connecter
        </Link>
        <p style={{ fontSize: 13, color: '#9BB5AA', marginTop: 18 }}>Pas reçu l&apos;email ? Pensez aux courriers indésirables, ou écrivez à thomas.frentz@holiris.fr</p>
      </div>
    </div>
  )
}
