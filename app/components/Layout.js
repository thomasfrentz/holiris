'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Layout({ children, senior, seniors, selectedSeniorId, switchSenior, isAdmin, isIntervenant = false }) {
  const pathname = usePathname()

  const navItemsAdmin = [
    { icon: '⚡', label: 'Flux', href: '/app' },
    { icon: '📅', label: 'Agenda', href: '/agenda' },
    { icon: '📝', label: 'Carnet', href: '/carnet' },
    { icon: '💊', label: 'Ordonnances', href: '/ordonnances' },
    { icon: '👨‍👩‍👧', label: 'Famille', href: '/famille' },
    { icon: '👥', label: 'Intervenants', href: '/intervenants' },
    { icon: '🤖', label: 'Assistant', href: '/assistant' },
    { icon: '👤', label: 'Profil', href: '/profil' },
  ]

  const navItemsIntervenant = [
    { icon: '🏠', label: 'Mon espace', href: '/espace-intervenant' },
    { icon: '📅', label: 'Agenda', href: '/agenda' },
  ]

  const navItems = isIntervenant ? navItemsIntervenant : navItemsAdmin

  const bottomNavItems = isIntervenant ? navItemsIntervenant : [
    { icon: '⚡', label: 'Flux', href: '/app' },
    { icon: '📅', label: 'Agenda', href: '/agenda' },
    { icon: '📝', label: 'Carnet', href: '/carnet' },
    { icon: '👨‍👩‍👧', label: 'Famille', href: '/famille' },
    { icon: '👤', label: 'Profil', href: '/profil' },
  ]

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap');
        * { box-sizing: border-box; }
        @media (max-width: 768px) {
          .holiris-sidebar { display: none !important; }
          .holiris-main { padding: 20px 16px 90px 16px !important; }
          .holiris-bottom-nav { display: flex !important; }
          .holiris-layout { height: auto !important; min-height: 100vh !important; }
        }
        @media (min-width: 769px) {
          .holiris-bottom-nav { display: none !important; }
          .holiris-layout { height: 100vh !important; }
        }
        .nav-item:hover { background: rgba(154,184,159,0.08) !important; }
        .holiris-card { background: rgba(255,255,255,0.04) !important; border: 1px solid rgba(107,143,113,0.2) !important; }
        .holiris-card:hover { background: rgba(255,255,255,0.07) !important; }
      `}</style>

      <div className="holiris-layout" style={{
        display: 'flex',
        fontFamily: 'DM Sans, system-ui, sans-serif',
        background: '#1E2820',
        color: '#FAFCFA'
      }}>

        {/* Sidebar desktop */}
        <aside className="holiris-sidebar" style={{
          width: 260, background: 'rgba(255,255,255,0.03)',
          borderRight: '1px solid rgba(107,143,113,0.2)',
          padding: '28px 20px', display: 'flex', flexDirection: 'column',
          gap: 20, flexShrink: 0, overflowY: 'auto'
        }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingBottom: 8 }}>
            <svg width="32" height="32" viewBox="0 0 64 64" fill="none">
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#9AB89F" strokeWidth="1.2" fill="none"/>
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#A89FCC" strokeWidth="1.2" fill="none"/>
              <circle cx="32" cy="32" r="5" fill="#9AB89F"/>
              <circle cx="32" cy="32" r="2.2" fill="#1E2820"/>
            </svg>
            <div>
              <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 22, fontWeight: 300, letterSpacing: '0.12em' }}>
                Hol<span style={{ color: '#9AB89F', fontStyle: 'italic' }}>iris</span>
              </div>
              <div style={{ fontSize: 9, color: 'rgba(154,184,159,0.6)', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                {isIntervenant ? 'Espace intervenant' : 'Pyrénées-Orientales'}
              </div>
            </div>
          </div>

          {/* Senior card */}
          {isAdmin && seniors?.length > 1 ? (
            <div style={{ background: 'rgba(107,143,113,0.1)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 2, padding: '14px 16px' }}>
              <div style={{ fontSize: 9, color: '#9AB89F', marginBottom: 8, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Dossier actif</div>
              <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
                style={{ width: '100%', background: 'transparent', color: '#FAFCFA', border: 'none', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'DM Sans, sans-serif' }}>
                {seniors.map(s => <option key={s.id} value={s.id} style={{ background: '#1E2820' }}>{s.name} · {s.age} ans</option>)}
              </select>
              <div style={{ fontSize: 11, color: 'rgba(154,184,159,0.6)', marginTop: 6 }}>{senior?.city}</div>
            </div>
          ) : senior ? (
            <div style={{ background: 'rgba(107,143,113,0.1)', border: '1px solid rgba(107,143,113,0.25)', borderRadius: 2, padding: '14px 16px' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>👵</div>
              <div style={{ fontFamily: 'Cormorant Garamond, Georgia, serif', fontSize: 16, fontWeight: 400, color: '#FAFCFA' }}>{senior.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(154,184,159,0.6)', marginTop: 4 }}>{senior.age} ans · {senior.city}</div>
            </div>
          ) : null}

          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                  <div className="nav-item" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 2,
                    color: active ? '#9AB89F' : 'rgba(255,255,255,0.45)',
                    background: active ? 'rgba(107,143,113,0.15)' : 'transparent',
                    borderLeft: active ? '2px solid #6B8F71' : '2px solid transparent',
                    fontWeight: active ? 500 : 300,
                    fontSize: 13, letterSpacing: '0.02em',
                    transition: 'all 0.15s ease'
                  }}>
                    <span style={{ fontSize: 15 }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </div>
                </Link>
              )
            })}
          </nav>

          {isAdmin && (
            <div style={{ background: 'rgba(196,122,130,0.1)', border: '1px solid rgba(196,122,130,0.25)', borderRadius: 2, padding: '10px 12px' }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#C47A82', letterSpacing: '0.05em' }}>🔐 Mode Admin</div>
              <div style={{ fontSize: 10, color: 'rgba(196,122,130,0.6)', marginTop: 2 }}>Suppression activée</div>
            </div>
          )}
        </aside>

        {/* Main */}
        <main className="holiris-main" style={{
          flex: 1, padding: 32, overflowY: 'auto',
          background: '#1E2820'
        }}>
          {children}
        </main>

        {/* Bottom nav mobile */}
        <nav className="holiris-bottom-nav" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(20,32,24,0.97)',
          borderTop: '1px solid rgba(107,143,113,0.2)',
          backdropFilter: 'blur(12px)',
          padding: '8px 0 16px', zIndex: 100,
          justifyContent: 'space-around', alignItems: 'center'
        }}>
          {bottomNavItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  color: active ? '#9AB89F' : 'rgba(255,255,255,0.35)',
                }}>
                  <span style={{ fontSize: 20 }}>{item.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: active ? 500 : 300, letterSpacing: '0.05em' }}>{item.label}</span>
                </div>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}