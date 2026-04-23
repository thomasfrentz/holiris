'use client'
import Link from 'next/link'

const Logo = ({ size = 32 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#9AB89F" strokeWidth="1.2" fill="none"/>
      <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#A89FCC" strokeWidth="1.2" fill="none"/>
      <circle cx="32" cy="32" r="5" fill="#9AB89F"/>
      <circle cx="32" cy="32" r="2.2" fill="#1E2820"/>
    </svg>
    <span style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: size * 0.75, fontWeight: 300, letterSpacing: '0.12em' }}>
      Hol<span style={{ color: '#9AB89F', fontStyle: 'italic' }}>iris</span>
    </span>
  </div>
)

export default function Landing() {
  return (
    <div style={{ fontFamily: 'var(--font-body, DM Sans, sans-serif)', background: '#1E2820', color: '#FAFCFA', margin: 0 }}>

      {/* NAV */}
      <nav style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 48px', background: 'rgba(30,40,32,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid rgba(107,143,113,0.15)' }}>
        <Logo size={32} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <a href="#fonctionnalites" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14 }}>Fonctionnalités</a>
          <a href="#tarifs" style={{ color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontSize: 14 }}>Tarifs</a>
          <Link href="/login" style={{ background: '#6B8F71', color: '#FAFCFA', textDecoration: 'none', padding: '10px 24px', borderRadius: 2, fontSize: 13, fontWeight: 500, letterSpacing: '0.06em' }}>
            Se connecter
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', paddingTop: 80 }}>
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 60% 50% at 30% 60%, rgba(107,143,113,0.28) 0%, transparent 70%), radial-gradient(ellipse 50% 40% at 75% 35%, rgba(122,111,168,0.22) 0%, transparent 65%)' }} />

        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.25em', textTransform: 'uppercase', color: '#9AB89F', marginBottom: 32, position: 'relative' }}>
          Plateforme de coordination familiale
        </p>

        <div style={{ textAlign: 'center', position: 'relative', maxWidth: 800, padding: '0 24px' }}>
          <svg width="80" height="80" viewBox="0 0 80 80" fill="none" style={{ marginBottom: 32 }}>
            <ellipse cx="40" cy="40" rx="22" ry="30" transform="rotate(-15 40 40)" stroke="#9AB89F" strokeWidth="1.5" fill="none"/>
            <ellipse cx="40" cy="40" rx="22" ry="30" transform="rotate(15 40 40)" stroke="#A89FCC" strokeWidth="1.5" fill="none"/>
            <circle cx="40" cy="40" r="6" fill="#9AB89F"/>
            <circle cx="40" cy="40" r="3" fill="#1E2820"/>
          </svg>

          <h1 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 'clamp(56px, 10vw, 96px)', fontWeight: 300, letterSpacing: '0.06em', lineHeight: 1, marginBottom: 24, color: '#FAFCFA' }}>
            Hol<span style={{ color: '#9AB89F', fontStyle: 'italic' }}>iris</span>
          </h1>

          <p style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 'clamp(18px, 2.5vw, 26px)', fontWeight: 300, fontStyle: 'italic', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.04em', marginBottom: 48 }}>
            Prendre soin de ceux qui nous sont chers
          </p>

          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.6)', lineHeight: 1.7, maxWidth: 560, margin: '0 auto 48px', fontWeight: 300 }}>
            Holiris connecte les familles et les intervenants autour du suivi du bien-être des personnes âgées à domicile. Notes vocales, alertes IA, agenda partagé — tout en un.
          </p>

          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login" style={{ background: '#6B8F71', color: '#FAFCFA', textDecoration: 'none', padding: '14px 36px', borderRadius: 2, fontSize: 14, fontWeight: 500, letterSpacing: '0.06em' }}>
              Commencer gratuitement
            </Link>
            <a href="#fonctionnalites" style={{ background: 'transparent', color: '#9AB89F', textDecoration: 'none', padding: '14px 36px', borderRadius: 2, fontSize: 14, fontWeight: 500, letterSpacing: '0.06em', border: '1.5px solid #6B8F71' }}>
              Découvrir
            </a>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 36, display: 'flex', gap: 48 }}>
          {['Familles', 'Intervenants', 'Sérénité'].map(item => (
            <span key={item} style={{ fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)' }}>{item}</span>
          ))}
        </div>
      </div>

      {/* FEATURES */}
      <div id="fonctionnalites" style={{ padding: '96px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#9AB89F', marginBottom: 12 }}>Fonctionnalités</p>
        <h2 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 400, color: '#FAFCFA', lineHeight: 1.1, marginBottom: 64 }}>
          Tout ce dont votre famille a besoin
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 2 }}>
          {[
            { icon: '💬', color: '#6B8F71', bg: 'rgba(107,143,113,0.12)', title: 'Notes WhatsApp', desc: 'Les intervenants envoient un message vocal ou texte après chaque passage. L\'IA le transforme en note professionnelle automatiquement.' },
            { icon: '🤖', color: '#7A6FA8', bg: 'rgba(122,111,168,0.12)', title: 'Alertes IA', desc: 'L\'intelligence artificielle détecte les signaux faibles dans les notes — douleurs, moral bas, problèmes alimentaires — et vous alerte en temps réel.' },
            { icon: '📅', color: '#C4844A', bg: 'rgba(196,132,74,0.12)', title: 'Agenda partagé', desc: 'Planifiez les passages, consultations et soins. Suivez les présences et recevez des relances automatiques si un intervenant ne donne pas de nouvelles.' },
            { icon: '👨‍👩‍👧', color: '#9AB89F', bg: 'rgba(154,184,159,0.12)', title: 'Coordination famille', desc: 'Tous les membres de la famille accèdent au même tableau de bord. Chacun peut ajouter des notes et consulter l\'historique.' },
            { icon: '✦', color: '#7A6FA8', bg: 'rgba(122,111,168,0.12)', title: 'Assistant IA', desc: 'Posez vos questions à notre assistant qui connaît toute la situation de votre proche. Résumés de semaine, conseils, informations sur les aides disponibles.' },
            { icon: '🔔', color: '#C47A82', bg: 'rgba(196,122,130,0.12)', title: 'Relances automatiques', desc: 'Si un intervenant ne donne pas de nouvelles après un passage prévu, Holiris lui envoie automatiquement un rappel bienveillant.' },
          ].map((f, i) => (
            <div key={i} style={{ background: f.bg, padding: '48px 36px' }}>
              <div style={{ fontSize: 32, marginBottom: 20 }}>{f.icon}</div>
              <h3 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 24, fontWeight: 400, color: f.color, marginBottom: 12 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* COMMENT CA MARCHE */}
      <div style={{ background: 'rgba(255,255,255,0.03)', borderTop: '1px solid rgba(107,143,113,0.15)', borderBottom: '1px solid rgba(107,143,113,0.15)', padding: '96px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#9AB89F', marginBottom: 12 }}>Comment ça marche</p>
          <h2 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 400, color: '#FAFCFA', lineHeight: 1.1, marginBottom: 64 }}>
            Simple pour tout le monde
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 48 }}>
            {[
              { num: '01', color: '#9AB89F', title: 'Créez le dossier', desc: 'Renseignez les informations de votre proche et invitez les intervenants et membres de la famille.' },
              { num: '02', color: '#A89FCC', title: 'Les intervenants envoient', desc: 'Après chaque passage, ils envoient un simple message vocal ou texte sur WhatsApp. 20 secondes suffisent.' },
              { num: '03', color: '#C4844A', title: 'L\'IA analyse', desc: 'Holiris transforme les messages en notes professionnelles et détecte automatiquement les signaux importants.' },
              { num: '04', color: '#9AB89F', title: 'La famille suit', desc: 'Vous recevez les informations en temps réel sur votre tableau de bord, depuis n\'importe quel appareil.' },
            ].map((step, i) => (
              <div key={i}>
                <div style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 48, fontWeight: 300, color: step.color, opacity: 0.4, marginBottom: 16 }}>{step.num}</div>
                <h3 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 22, fontWeight: 400, color: '#FAFCFA', marginBottom: 10 }}>{step.title}</h3>
                <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.7 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* TARIFS */}
      <div id="tarifs" style={{ padding: '96px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <p style={{ fontSize: 10, fontWeight: 500, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#9AB89F', marginBottom: 12 }}>Tarifs</p>
        <h2 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 400, color: '#FAFCFA', lineHeight: 1.1, marginBottom: 64 }}>
          Un tarif simple et transparent
        </h2>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 2 }}>
          <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(107,143,113,0.2)', padding: '48px 36px' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9AB89F', marginBottom: 16 }}>Famille</p>
            <div style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 48, fontWeight: 300, color: '#FAFCFA', marginBottom: 8 }}>
              29€<span style={{ fontSize: 18, opacity: 0.5 }}>/mois</span>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.6 }}>Pour les familles qui souhaitent suivre le bien-être d'un proche à domicile.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
              {['Tableau de bord temps réel', 'Notes WhatsApp illimitées', 'Alertes IA signaux faibles', 'Agenda et relances auto', 'Assistant IA', 'Membres famille illimités'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6B8F71', flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/login" style={{ display: 'block', textAlign: 'center', background: '#6B8F71', color: '#FAFCFA', textDecoration: 'none', padding: '13px 0', borderRadius: 2, fontSize: 13, fontWeight: 500, letterSpacing: '0.06em' }}>
              Commencer gratuitement
            </Link>
          </div>

          <div style={{ background: 'rgba(107,143,113,0.15)', border: '1px solid rgba(107,143,113,0.4)', padding: '48px 36px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 20, right: 20, background: '#6B8F71', color: '#FAFCFA', fontSize: 10, fontWeight: 500, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '4px 12px', borderRadius: 2 }}>Populaire</div>
            <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9AB89F', marginBottom: 16 }}>Structure</p>
            <div style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 48, fontWeight: 300, color: '#FAFCFA', marginBottom: 8 }}>
              149€<span style={{ fontSize: 18, opacity: 0.5 }}>/mois</span>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 32, lineHeight: 1.6 }}>Pour les CCAS, SSIAD et structures d'aide à domicile.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 36 }}>
              {['Jusqu\'à 20 dossiers seniors', 'Tout le plan Famille', 'Tableau de bord multi-seniors', 'Rapports hebdomadaires', 'Support prioritaire', 'Formation incluse'].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#9AB89F', flexShrink: 0 }} />
                  {f}
                </div>
              ))}
            </div>
            <Link href="/login" style={{ display: 'block', textAlign: 'center', background: '#6B8F71', color: '#FAFCFA', textDecoration: 'none', padding: '13px 0', borderRadius: 2, fontSize: 13, fontWeight: 500, letterSpacing: '0.06em' }}>
              Nous contacter
            </Link>
          </div>
        </div>
      </div>

      {/* CTA FINAL */}
      <div style={{ background: 'rgba(107,143,113,0.12)', borderTop: '1px solid rgba(107,143,113,0.2)', padding: '96px 48px', textAlign: 'center' }}>
        <svg width="48" height="48" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 24 }}>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#9AB89F" strokeWidth="1.2" fill="none"/>
          <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#A89FCC" strokeWidth="1.2" fill="none"/>
          <circle cx="32" cy="32" r="5" fill="#9AB89F"/>
          <circle cx="32" cy="32" r="2.2" fill="#1E2820"/>
        </svg>
        <h2 style={{ fontFamily: 'var(--font-display, Cormorant Garamond, Georgia, serif)', fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 300, color: '#FAFCFA', marginBottom: 20 }}>
          Commencez dès aujourd'hui
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', maxWidth: 480, margin: '0 auto 40px', lineHeight: 1.7, fontWeight: 300 }}>
          Rejoignez les familles des Pyrénées-Orientales qui font confiance à Holiris pour le suivi de leurs proches.
        </p>
        <Link href="/login" style={{ background: '#6B8F71', color: '#FAFCFA', textDecoration: 'none', padding: '16px 48px', borderRadius: 2, fontSize: 14, fontWeight: 500, letterSpacing: '0.06em' }}>
          Créer un compte gratuit
        </Link>
      </div>

      {/* FOOTER */}
      <div style={{ borderTop: '1px solid rgba(107,143,113,0.15)', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <Logo size={24} />
        <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
          <Link href="/privacy" style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none', letterSpacing: '0.1em' }}>Confidentialité</Link>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)' }}>© 2026 Holiris · Pyrénées-Orientales</span>
        </div>
      </div>

    </div>
  )
}
