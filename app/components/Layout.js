'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Layout({ children, senior, seniors, selectedSeniorId, switchSenior, isAdmin, isIntervenant = false }) {
  const pathname = usePathname()

  const navItemsAdmin = [
    { label: 'Flux', href: '/app', short: 'Flux' },
    { label: 'Agenda', href: '/agenda', short: 'Agenda' },
    { label: 'Carnet', href: '/carnet', short: 'Carnet' },
    { label: 'Ordonnances', href: '/ordonnances', short: 'Rx' },
    { label: 'Famille', href: '/famille', short: 'Famille' },
    { label: 'Intervenants', href: '/intervenants', short: 'Équipe' },
    { label: 'Assistant IA', href: '/assistant', short: 'IA' },
    { label: 'Profil', href: '/profil', short: 'Profil' },
  ]

  const navItemsIntervenant = [
    { label: 'Mon espace', href: '/espace-intervenant', short: 'Accueil' },
    { label: 'Agenda', href: '/agenda', short: 'Agenda' },
  ]

  const navItems = isIntervenant ? navItemsIntervenant : navItemsAdmin
  const bottomItems = isIntervenant ? navItemsIntervenant : navItemsAdmin.filter(i => ['Flux','Agenda','Carnet','Famille','Profil'].includes(i.label))

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=DM+Sans:ital,opsz,wght@0,9..40,200;0,9..40,300;0,9..40,400;0,9..40,500;1,9..40,300&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #0F1610; }

        .hl-sidebar { display: flex; }
        .hl-bottom { display: none; }

        @media (max-width: 768px) {
          .hl-sidebar { display: none !important; }
          .hl-bottom { display: flex !important; }
          .hl-main { padding: 28px 20px 88px !important; }
          .hl-wrap { min-height: 100vh; height: auto !important; }
        }

        .hl-navlink { text-decoration: none; display: block; }
        .hl-navlink-inner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 0;
          border-bottom: 1px solid transparent;
          transition: all 0.2s;
          cursor: pointer;
        }
        .hl-navlink:hover .hl-navlink-inner {
          border-bottom-color: rgba(154,184,159,0.3) !important;
        }
        .hl-navlink:hover .hl-navlink-text {
          color: #FAFCFA !important;
          letter-spacing: 0.04em !important;
        }

        .hl-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid rgba(154,184,159,0.12);
          border-radius: 2px;
          transition: border-color 0.2s;
        }
        .hl-card:hover { border-color: rgba(154,184,159,0.25); }

        .hl-scroll::-webkit-scrollbar { width: 3px; }
        .hl-scroll::-webkit-scrollbar-track { background: transparent; }
        .hl-scroll::-webkit-scrollbar-thumb { background: rgba(154,184,159,0.2); }

        .hl-bottom-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; padding: 8px 4px; text-decoration: none; transition: opacity 0.15s; }
        .hl-bottom-item:active { opacity: 0.6; }
      `}</style>

      <div className="hl-wrap" style={{
        display: 'flex', height: '100vh',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: '#0F1610', color: '#FAFCFA',
      }}>

        {/* ───── Sidebar ───── */}
        <aside className="hl-sidebar hl-scroll" style={{
          width: 220,
          borderRight: '1px solid rgba(154,184,159,0.1)',
          padding: '32px 28px',
          flexDirection: 'column',
          gap: 0,
          flexShrink: 0,
          overflowY: 'auto',
          justifyContent: 'space-between',
        }}>

          <div>
            {/* Logo */}
            <Link href="/app" style={{ textDecoration: 'none', display: 'block', marginBottom: 40 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 300, letterSpacing: '0.08em', color: '#FAFCFA', lineHeight: 1 }}>
                Hol<span style={{ color: '#9AB89F', fontStyle: 'italic' }}>iris</span>
              </div>
              <div style={{ fontSize: 8, color: 'rgba(154,184,159,0.4)', letterSpacing: '0.3em', textTransform: 'uppercase', marginTop: 4 }}>
                {isIntervenant ? 'Intervenant' : 'Pyrénées-Orientales'}
              </div>
            </Link>

            {/* Senior */}
            {senior && (
              <div style={{ marginBottom: 36, paddingBottom: 28, borderBottom: '1px solid rgba(154,184,159,0.1)' }}>
                {isAdmin && seniors?.length > 1 ? (
                  <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
                    style={{ width: '100%', background: 'transparent', color: '#FAFCFA', border: 'none', fontSize: 14, cursor: 'pointer', outline: 'none', fontFamily: "'Cormorant Garamond', serif", fontWeight: 400 }}>
                    {seniors.map(s => <option key={s.id} value={s.id} style={{ background: '#0F1610' }}>{s.name}</option>)}
                  </select>
                ) : (
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 400, color: '#FAFCFA', letterSpacing: '0.02em' }}>
                    {senior.name}
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 3, letterSpacing: '0.1em' }}>
                  {senior.age} ans · {senior.city}
                </div>
              </div>
            )}

            {/* Nav */}
            <nav>
              {navItems.map((item) => {
                const active = pathname === item.href
                return (
                  <Link key={item.href} href={item.href} className="hl-navlink">
                    <div className="hl-navlink-inner" style={{
                      borderBottomColor: active ? 'rgba(154,184,159,0.4)' : 'rgba(154,184,159,0.08)',
                    }}>
                      <span className="hl-navlink-text" style={{
                        fontSize: 12,
                        fontWeight: active ? 500 : 300,
                        color: active ? '#9AB89F' : 'rgba(255,255,255,0.35)',
                        letterSpacing: active ? '0.06em' : '0.02em',
                        textTransform: 'uppercase',
                        transition: 'all 0.2s',
                      }}>
                        {item.label}
                      </span>
                      {active && (
                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#9AB89F' }} />
                      )}
                    </div>
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Bottom sidebar */}
          <div style={{ paddingTop: 28 }}>
            {isAdmin && (
              <div style={{ fontSize: 9, color: 'rgba(196,122,130,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Admin
              </div>
            )}
          </div>
        </aside>

        {/* ───── Main ───── */}
        <main className="hl-main hl-scroll" style={{
          flex: 1, padding: '40px 48px', overflowY: 'auto',
          background: '#0F1610',
        }}>
          {children}
        </main>

        {/* ───── Bottom nav mobile ───── */}
        <nav className="hl-bottom" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(10,18,11,0.97)',
          borderTop: '1px solid rgba(154,184,159,0.1)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          paddingTop: 4,
          zIndex: 100,
          justifyContent: 'space-around', alignItems: 'center',
        }}>
          {bottomItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="hl-bottom-item">
                <div style={{
                  width: 28, height: 2, borderRadius: 1,
                  background: active ? '#9AB89F' : 'transparent',
                  marginBottom: 4,
                  transition: 'background 0.2s',
                }} />
                <span style={{
                  fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase',
                  color: active ? '#9AB89F' : 'rgba(255,255,255,0.25)',
                  fontWeight: active ? 500 : 300,
                }}>
                  {item.short}
                </span>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}