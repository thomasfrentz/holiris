// app/landing/page.js
'use client'
import Link from 'next/link'

const Logo = ({ size = 28 }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="2" fill="none"/>
      <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="2" fill="none"/>
      <circle cx="32" cy="32" r="4" fill="#7FAF9B"/>
      <circle cx="32" cy="32" r="1.8" fill="#fff"/>
    </svg>
    <span style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: size * 0.85, fontWeight: 500, letterSpacing: '0.05em', color: '#1F2A24' }}>
      Holiris
    </span>
  </div>
)

export default function Landing() {
  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#FCFDFC', color: '#1F2A24' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #FCFDFC; }

        .btn-primary {
          background: #7FAF9B; color: #fff; text-decoration: none;
          padding: 13px 32px; border-radius: 8px; font-size: 14px;
          font-weight: 500; letter-spacing: 0.03em; display: inline-block;
          transition: background 0.2s, transform 0.15s; font-family: 'Inter', sans-serif;
        }
        .btn-primary:hover { background: #4A8870; transform: translateY(-1px); }

        .btn-outline {
          background: transparent; color: #4A8870; text-decoration: none;
          padding: 13px 32px; border-radius: 8px; font-size: 14px;
          font-weight: 500; letter-spacing: 0.03em; display: inline-block;
          border: 1.5px solid #7FAF9B; transition: all 0.2s; font-family: 'Inter', sans-serif;
        }
        .btn-outline:hover { background: #EAF4EF; transform: translateY(-1px); }

        .feature-card {
          background: #fff; border: 1px solid #E8EFEB; border-radius: 14px;
          padding: 28px 24px; transition: box-shadow 0.2s, border-color 0.2s;
        }
        .feature-card:hover { box-shadow: 0 8px 32px rgba(127,175,155,0.12); border-color: #C8DDD4; }

        .nav-link { color: #6F7C75; text-decoration: none; font-size: 14px; font-weight: 400; transition: color 0.15s; }
        .nav-link:hover { color: #1F2A24; }

        @media (max-width: 768px) {
          .nav-links { display: none !important; }
          .hero-title { font-size: 44px !important; }
          .hero-sub { font-size: 15px !important; }
          .hero-btns { flex-direction: column !important; align-items: stretch !important; }
          .hero-btns a { text-align: center !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .steps-grid { grid-template-columns: 1fr 1fr !important; gap: 28px !important; }
          .pricing-grid { grid-template-columns: 1fr !important; }
          .footer-inner { flex-direction: column !important; text-align: center !important; }
          .section-pad { padding: 64px 24px !important; }
        }
      `}</style>

      {/* ── NAV ── */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 48px',
        background: 'rgba(252,253,252,0.93)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid #EBF0EC',
      }}>
        <Logo size={28} />
        <div className="nav-links" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <a href="#fonctionnalites" className="nav-link">Fonctionnalités</a>
          <a href="#comment" className="nav-link">Comment ça marche</a>
          <a href="#tarifs" className="nav-link">Tarifs</a>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link href="/login" style={{ fontSize: 14, color: '#4A8870', fontWeight: 500, textDecoration: 'none' }}>
            Se connecter
          </Link>
          <Link href="/login?signup=true" className="btn-primary" style={{ padding: '9px 22px', fontSize: 13 }}>
            Essayer gratuitement
          </Link>
        </div>
      </nav>

      {/* ── HERO ── */}
      <div style={{
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingTop: 100, paddingBottom: 80, paddingLeft: 24, paddingRight: 24,
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)',
      }}>
        <div style={{ position: 'absolute', top: '12%', right: '10%', width: 360, height: 360, borderRadius: '50%', background: 'radial-gradient(circle, rgba(188,132,198,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '12%', left: '6%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(127,175,155,0.09) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div style={{ textAlign: 'center', maxWidth: 680, position: 'relative' }}>

          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#EAF4EF', border: '1px solid #C8DDD4', borderRadius: 20, padding: '5px 14px', marginBottom: 36 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7FAF9B' }} />
            <span style={{ fontSize: 11, fontWeight: 500, color: '#4A8870', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Plateforme de coordination familiale
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <svg width="68" height="68" viewBox="0 0 64 64" fill="none">
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.5" fill="none"/>
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.5" fill="none"/>
              <circle cx="32" cy="32" r="5" fill="#7FAF9B"/>
              <circle cx="32" cy="32" r="2.2" fill="#FCFDFC"/>
            </svg>
          </div>

          <h1 className="hero-title" style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 68, fontWeight: 400, lineHeight: 1.05,
            color: '#1F2A24', letterSpacing: '-0.01em', marginBottom: 10,
          }}>
            Prendre soin,
            <br />
            <span style={{ fontStyle: 'italic', color: '#7FAF9B' }}>ensemble.</span>
          </h1>

          <p className="hero-sub" style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: 22, fontWeight: 300, fontStyle: 'italic',
            color: '#6F7C75', lineHeight: 1.5,
            maxWidth: 480, margin: '0 auto 40px',
          }}>
            Prendre soin de ceux qui nous sont chers
          </p>

          <div className="hero-btns" style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/login?signup=true" className="btn-primary">
              Commencer gratuitement →
            </Link>
            <a href="#fonctionnalites" className="btn-outline">
              Découvrir
            </a>
          </div>

          <div style={{ marginTop: 52, display: 'flex', gap: 36, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { label: 'Familles', color: '#7FAF9B' },
              { label: 'Intervenants', color: '#BC84C6' },
              { label: 'Sérénité', color: '#E6B98A' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: item.color }} />
                <span style={{ fontSize: 12, color: '#9BB5AA', letterSpacing: '0.08em' }}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURES ── */}
      <div id="fonctionnalites" className="section-pad" style={{ padding: '96px 48px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ marginBottom: 56 }}>
          <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Fonctionnalités</div>
          <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(34px, 4vw, 50px)', fontWeight: 400, color: '#1F2A24', lineHeight: 1.1 }}>
            Tout ce dont votre famille
            <br /><span style={{ fontStyle: 'italic', color: '#7FAF9B' }}>a besoin</span>
          </h2>
        </div>

        <div className="features-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { color: '#7FAF9B', bg: '#EAF4EF', title: 'Notes WhatsApp', desc: 'Les intervenants envoient un message vocal ou texte après chaque passage. L\'IA le transforme en note structurée automatiquement.' },
            { color: '#BC84C6', bg: '#F3EDF7', title: 'Alertes intelligentes', desc: 'L\'IA détecte les signaux faibles — douleurs, moral bas, alimentation — et vous alerte en temps réel.' },
            { color: '#E6B98A', bg: '#FDF3E7', title: 'Agenda partagé', desc: 'Planifiez les passages et consultations. Suivez les présences et recevez des relances automatiques.' },
            { color: '#4A8870', bg: '#EAF4EF', title: 'Coordination famille', desc: 'Tous les membres de la famille accèdent au même tableau de bord. Chacun peut ajouter des notes et consulter l\'historique.' },
            { color: '#8B6FAA', bg: '#F3EDF7', title: 'Assistant IA', desc: 'Posez vos questions à notre assistant qui connaît la situation de votre proche. Résumés, conseils, aides disponibles.' },
            { color: '#D98992', bg: '#FBECED', title: 'Relances automatiques', desc: 'Si un intervenant ne donne pas de nouvelles après un passage prévu, Holiris lui envoie un rappel bienveillant.' },
          ].map((f, i) => (
            <div key={i} className="feature-card">
              <div style={{ width: 42, height: 42, borderRadius: 10, background: f.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
                <div style={{ width: 14, height: 14, borderRadius: '50%', background: f.color }} />
              </div>
              <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 500, color: '#1F2A24', marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 13, color: '#6F7C75', lineHeight: 1.7, fontWeight: 300 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── COMMENT ÇA MARCHE ── */}
      <div id="comment" className="section-pad" style={{ background: '#F0F7F4', borderTop: '1px solid #E0EDEA', borderBottom: '1px solid #E0EDEA', padding: '96px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Comment ça marche</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(34px, 4vw, 50px)', fontWeight: 400, color: '#1F2A24', lineHeight: 1.1 }}>
              Simple pour
              <br /><span style={{ fontStyle: 'italic', color: '#7FAF9B' }}>tout le monde</span>
            </h2>
          </div>

          <div className="steps-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40 }}>
            {[
              { num: '01', color: '#7FAF9B', title: 'Créez le dossier', desc: 'Renseignez les informations de votre proche et invitez les intervenants et membres de la famille.' },
              { num: '02', color: '#BC84C6', title: 'Les intervenants envoient', desc: 'Après chaque passage, un simple message vocal sur WhatsApp. 20 secondes suffisent.' },
              { num: '03', color: '#E6B98A', title: "L'IA analyse", desc: 'Holiris transforme les messages en notes et détecte automatiquement les signaux importants.' },
              { num: '04', color: '#4A8870', title: 'La famille suit', desc: 'Vous recevez les informations en temps réel sur votre tableau de bord, depuis n\'importe quel appareil.' },
            ].map((step, i) => (
              <div key={i}>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 56, fontWeight: 300, color: step.color, opacity: 0.45, lineHeight: 1, marginBottom: 18 }}>{step.num}</div>
                <h3 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 21, fontWeight: 500, color: '#1F2A24', marginBottom: 10 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: '#6F7C75', lineHeight: 1.7, fontWeight: 300 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TARIFS ── */}
      <div id="tarifs" className="section-pad" style={{ padding: '96px 48px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ marginBottom: 56 }}>
            <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.25em', textTransform: 'uppercase', marginBottom: 14 }}>Tarifs</div>
            <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(34px, 4vw, 50px)', fontWeight: 400, color: '#1F2A24', lineHeight: 1.1 }}>
              Simple et
              <br /><span style={{ fontStyle: 'italic', color: '#7FAF9B' }}>transparent</span>
            </h2>
          </div>

          <div className="pricing-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, maxWidth: 760 }}>
            {[
              {
                name: 'Famille', price: '29',
                desc: 'Pour les familles qui souhaitent suivre le bien-être d\'un proche à domicile.',
                features: ['Tableau de bord temps réel', 'Notes WhatsApp illimitées', 'Alertes IA signaux faibles', 'Agenda et relances auto', 'Assistant IA', 'Membres famille illimités'],
                cta: 'Commencer gratuitement', highlight: false,
              },
              {
                name: 'Structure', price: '149',
                desc: 'Pour les CCAS, SSIAD et structures d\'aide à domicile.',
                features: ["Jusqu'à 20 dossiers seniors", 'Tout le plan Famille', 'Tableau multi-seniors', 'Rapports hebdomadaires', 'Support prioritaire', 'Formation incluse'],
                cta: 'Nous contacter', highlight: true,
              },
            ].map((plan) => (
              <div key={plan.name} style={{
                background: plan.highlight ? '#EAF4EF' : '#fff',
                border: '1px solid ' + (plan.highlight ? '#C8DDD4' : '#E8EFEB'),
                borderRadius: 16, padding: '36px 32px', position: 'relative',
                boxShadow: plan.highlight ? '0 8px 40px rgba(127,175,155,0.15)' : 'none',
              }}>
                {plan.highlight && (
                  <div style={{ position: 'absolute', top: 20, right: 20, background: '#7FAF9B', color: '#fff', fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 20 }}>
                    Populaire
                  </div>
                )}
                <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 12 }}>{plan.name}</div>
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 52, fontWeight: 400, color: '#1F2A24', lineHeight: 1, marginBottom: 8 }}>
                  {plan.price}€<span style={{ fontSize: 18, color: '#9BB5AA', fontWeight: 300 }}>/mois</span>
                </div>
                <p style={{ fontSize: 13, color: '#6F7C75', marginBottom: 24, lineHeight: 1.6, fontWeight: 300 }}>{plan.desc}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, color: '#3A4A40' }}>
                      <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#EAF4EF', border: '1.5px solid #7FAF9B', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#7FAF9B' }} />
                      </div>
                      {f}
                    </div>
                  ))}
                </div>
                <Link href="/login?signup=true" className="btn-primary" style={{ display: 'block', textAlign: 'center' }}>
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── CTA FINAL ── */}
      <div className="section-pad" style={{ background: 'linear-gradient(135deg, #EAF4EF 0%, #F3EDF7 100%)', borderTop: '1px solid #E0EDEA', padding: '96px 48px', textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
          <svg width="56" height="56" viewBox="0 0 64 64" fill="none">
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.5" fill="none"/>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.5" fill="none"/>
            <circle cx="32" cy="32" r="5" fill="#7FAF9B"/>
            <circle cx="32" cy="32" r="2.2" fill="#FCFDFC"/>
          </svg>
        </div>
        <h2 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 'clamp(34px, 4vw, 52px)', fontWeight: 400, color: '#1F2A24', marginBottom: 16, lineHeight: 1.1 }}>
          Commencez
          <br /><span style={{ fontStyle: 'italic', color: '#7FAF9B' }}>dès aujourd'hui</span>
        </h2>
        <p style={{ fontSize: 15, color: '#6F7C75', maxWidth: 440, margin: '0 auto 36px', lineHeight: 1.7, fontWeight: 300 }}>
          Prendre soin de ceux qui nous sont chers — rejoignez les familles qui font confiance à Holiris.
        </p>
        <Link href="/login?signup=true" className="btn-primary" style={{ fontSize: 15, padding: '14px 44px' }}>
          Créer un compte gratuit →
        </Link>
      </div>

      {/* ── FOOTER ── */}
      <div style={{ background: '#fff', borderTop: '1px solid #EBF0EC', padding: '28px 48px' }}>
        <div className="footer-inner" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <Logo size={24} />
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexWrap: 'wrap' }}>
            <Link href="/privacy" style={{ fontSize: 12, color: '#9BB5AA', textDecoration: 'none' }}>Confidentialité</Link>
            <span style={{ fontSize: 12, color: '#C8D4CD' }}>© 2026 Holiris · Pyrénées-Orientales</span>
          </div>
        </div>
      </div>

    </div>
  )
}