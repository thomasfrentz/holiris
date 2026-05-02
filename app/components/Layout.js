// app/components/Layout.js
'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function Layout({ children, senior, seniors, selectedSeniorId, switchSenior, isAdmin, isIntervenant = false }) {
  const pathname = usePathname()

  const navItemsAdmin = [
    { label: 'Flux en temps réel', href: '/app', short: 'Flux' },
    { label: 'Agenda', href: '/agenda', short: 'Agenda' },
    { label: 'Carnet de suivi', href: '/carnet', short: 'Carnet' },
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
  const bottomItems = isIntervenant ? navItemsIntervenant : navItemsAdmin.filter(i => ['Flux en temps réel','Agenda','Carnet de suivi','Famille','Profil'].includes(i.label))

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;1,300;1,400;1,500&family=Inter:wght@300;400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #FCFDFC; }

        .hl-wrap { display: flex; height: 100vh; font-family: 'Inter', system-ui, sans-serif; background: #FCFDFC; color: #1F2A24; }
        .hl-sidebar { display: flex; }
        .hl-bottom { display: none; }

        @media (max-width: 768px) {
          .hl-sidebar { display: none !important; }
          .hl-bottom { display: flex !important; }
          .hl-main { padding: 24px 20px 88px !important; }
          .hl-wrap { min-height: 100vh; height: auto !important; }
        }

        .hl-navlink { text-decoration: none; display: block; }
        .hl-navlink-inner {
          display: flex; align-items: center; justify-content: space-between;
          padding: 9px 12px; border-radius: 8px;
          transition: all 0.15s; cursor: pointer;
        }
        .hl-navlink:hover .hl-navlink-inner { background: #EAF4EF; }
        .hl-navlink:hover .hl-navlink-text { color: #1F2A24 !important; }

        .hl-scroll::-webkit-scrollbar { width: 3px; }
        .hl-scroll::-webkit-scrollbar-track { background: transparent; }
        .hl-scroll::-webkit-scrollbar-thumb { background: #C8DDD4; border-radius: 4px; }

        .hl-bottom-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 4px; text-decoration: none; transition: opacity 0.15s; }
        .hl-card { background: #fff; border: 1px solid #E8EFEB; border-radius: 12px; transition: box-shadow 0.2s, border-color 0.2s; }
        .hl-card:hover { box-shadow: 0 4px 16px rgba(127,175,155,0.12); border-color: #C8DDD4; }
      `}</style>

      <div className="hl-wrap">

        {/* ───── Sidebar ───── */}
        <aside className="hl-sidebar hl-scroll" style={{
          width: 240,
          background: '#fff',
          borderRight: '1px solid #EBF0EC',
          padding: '28px 16px',
          flexDirection: 'column',
          gap: 0,
          flexShrink: 0,
          overflowY: 'auto',
        }}>

          {/* Logo */}
          <Link href="/app" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', marginBottom: 32 }}>
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="2" fill="none"/>
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="2" fill="none"/>
              <circle cx="32" cy="32" r="4" fill="#7FAF9B"/>
              <circle cx="32" cy="32" r="1.8" fill="#fff"/>
            </svg>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 20, fontWeight: 500, letterSpacing: '0.05em', color: '#1F2A24', lineHeight: 1 }}>
                Holiris
              </div>
              <div style={{ fontSize: 8, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 2 }}>
                {isIntervenant ? 'Intervenant' : 'Pyrénées-Orientales'}
              </div>
            </div>
          </Link>

          {/* Senior card */}
          {senior && (
            <div style={{ background: '#EAF4EF', borderRadius: 10, padding: '12px 14px', marginBottom: 24 }}>
              <div style={{ fontSize: 9, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
                Dossier actif
              </div>
              {isAdmin && seniors?.length > 1 ? (
                <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
                  style={{ width: '100%', background: 'transparent', color: '#1F2A24', border: 'none', fontSize: 14, cursor: 'pointer', outline: 'none', fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>
                  {seniors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 500, color: '#1F2A24' }}>{senior.name}</div>
              )}
              <div style={{ fontSize: 11, color: '#6F7C75', marginTop: 3 }}>{senior.age} ans · {senior.city}</div>
            </div>
          )}

          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className="hl-navlink">
                  <div className="hl-navlink-inner" style={{
                    background: active ? '#EAF4EF' : 'transparent',
                  }}>
                    <span className="hl-navlink-text" style={{
                      fontSize: 13,
                      fontWeight: active ? 500 : 400,
                      color: active ? '#4A8870' : '#6F7C75',
                    }}>
                      {item.label}
                    </span>
                    {active && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#7FAF9B' }} />}
                  </div>
                </Link>
              )
            })}
          </nav>

          {isAdmin && (
            <div style={{ marginTop: 16, padding: '8px 12px', background: '#FEF0F1', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#C47A82', fontWeight: 500 }}>Mode Admin actif</div>
            </div>
          )}
        </aside>

        {/* ───── Main ───── */}
        <main className="hl-main hl-scroll" style={{
          flex: 1, padding: '36px 40px', overflowY: 'auto',
          background: '#F7F9F8',
        }}>
          {children}
        </main>

        {/* ───── Bottom nav mobile ───── */}
        <nav className="hl-bottom" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,0.97)',
          borderTop: '1px solid #EBF0EC',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          paddingTop: 6,
          zIndex: 100,
          justifyContent: 'space-around', alignItems: 'center',
        }}>
          {bottomItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="hl-bottom-item">
                <div style={{
                  width: 32, height: 32, borderRadius: 9,
                  background: active ? '#EAF4EF' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}>
                  <div style={{ width: 16, height: 2, borderRadius: 1, background: active ? '#7FAF9B' : '#C8D4CD' }} />
                </div>
                <span style={{
                  fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: active ? '#4A8870' : '#9BB5AA',
                  fontWeight: active ? 600 : 400,
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