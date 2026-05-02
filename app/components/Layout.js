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

  // Bottom nav — max 5 items sur mobile
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
        @media (max-width: 768px) {
          .holiris-sidebar { display: none !important; }
          .holiris-main { padding: 16px 16px 80px 16px !important; }
          .holiris-bottom-nav { display: flex !important; }
          .holiris-layout { height: auto !important; min-height: 100vh !important; }
        }
        @media (min-width: 769px) {
          .holiris-bottom-nav { display: none !important; }
          .holiris-layout { height: 100vh !important; }
        }
      `}</style>

      <div className="holiris-layout" style={{ display: 'flex', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>

        {/* Sidebar desktop */}
        <aside className="holiris-sidebar" style={{ width: 260, background: '#12201a', color: '#e8f0eb', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0, overflowY: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 42, height: 42, background: '#2ecc71', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, color: '#12201a', fontSize: 18 }}>H</div>
            <div>
              <div style={{ fontWeight: 'bold', fontSize: 18 }}>Holiris</div>
              <div style={{ fontSize: 10, color: '#5a8a6a', letterSpacing: 1 }}>
                {isIntervenant ? 'ESPACE INTERVENANT' : 'PYRÉNÉES-ORIENTALES'}
              </div>
            </div>
          </div>

          {isAdmin && seniors?.length > 1 ? (
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 11, color: '#5a8a6a', marginBottom: 8, letterSpacing: 1 }}>DOSSIER ACTIF</div>
              <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
                style={{ width: '100%', background: '#1a3028', color: '#e8f0eb', border: '1px solid #2ecc71', borderRadius: 8, padding: '8px 10px', fontSize: 13, cursor: 'pointer', outline: 'none' }}>
                {seniors.map(s => <option key={s.id} value={s.id}>{s.name} · {s.age} ans</option>)}
              </select>
              <div style={{ fontSize: 11, color: '#7aaa8a', marginTop: 6 }}>{senior?.city}</div>
            </div>
          ) : senior ? (
            <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 12, padding: 14 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>👵</div>
              <div style={{ fontWeight: 'bold' }}>{senior.name}</div>
              <div style={{ fontSize: 12, color: '#7aaa8a', marginTop: 2 }}>{senior.age} ans · {senior.city}</div>
            </div>
          ) : null}

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 8,
                  color: pathname === item.href ? '#2ecc71' : '#9abaa8',
                  background: pathname === item.href ? 'rgba(46,204,113,0.15)' : 'none',
                  fontWeight: pathname === item.href ? 'bold' : 'normal',
                  cursor: 'pointer', fontSize: 14
                }}>
                  <span>{item.icon}</span>{item.label}
                </div>
              </Link>
            ))}
          </nav>

          {isAdmin && (
            <div style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.3)', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ fontSize: 12, fontWeight: 'bold', color: '#ff8070' }}>🔐 Mode Admin</div>
              <div style={{ fontSize: 11, color: '#cc8070', marginTop: 2 }}>Suppression activée</div>
            </div>
          )}
        </aside>

        {/* Contenu principal */}
        <main className="holiris-main" style={{ flex: 1, padding: 28, overflowY: 'auto' }}>
          {children}
        </main>

        {/* Bottom nav mobile */}
        <nav className="holiris-bottom-nav" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: '#12201a', borderTop: '1px solid rgba(255,255,255,0.1)',
          padding: '8px 0 12px', zIndex: 100,
          justifyContent: 'space-around', alignItems: 'center'
        }}>
          {bottomNavItems.map((item) => (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                color: pathname === item.href ? '#2ecc71' : '#5a8a6a',
              }}>
                <span style={{ fontSize: 20 }}>{item.icon}</span>
                <span style={{ fontSize: 10, fontWeight: pathname === item.href ? 'bold' : 'normal' }}>{item.label}</span>
              </div>
            </Link>
          ))}
        </nav>

      </div>
    </>
  )
}
