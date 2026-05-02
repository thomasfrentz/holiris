'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NavIcon = ({ type, active }) => {
  const color = active ? '#9AB89F' : 'rgba(255,255,255,0.3)'
  const icons = {
    flux: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
    agenda: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    carnet: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    ordonnances: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0016.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 002 8.5c0 2.3 1.5 4.05 3 5.5l7 7 7-7z"/></svg>,
    famille: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    intervenants: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    assistant: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M12 2a10 10 0 110 20 10 10 0 010-20z"/><path d="M12 16v-4M12 8h.01"/></svg>,
    profil: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    espace: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  }
  return icons[type] || null
}

export default function Layout({ children, senior, seniors, selectedSeniorId, switchSenior, isAdmin, isIntervenant = false }) {
  const pathname = usePathname()

  const navItemsAdmin = [
    { icon: 'flux', label: 'Flux', href: '/app' },
    { icon: 'agenda', label: 'Agenda', href: '/agenda' },
    { icon: 'carnet', label: 'Carnet', href: '/carnet' },
    { icon: 'ordonnances', label: 'Ordonnances', href: '/ordonnances' },
    { icon: 'famille', label: 'Famille', href: '/famille' },
    { icon: 'intervenants', label: 'Intervenants', href: '/intervenants' },
    { icon: 'assistant', label: 'Assistant IA', href: '/assistant' },
    { icon: 'profil', label: 'Profil', href: '/profil' },
  ]

  const navItemsIntervenant = [
    { icon: 'espace', label: 'Mon espace', href: '/espace-intervenant' },
    { icon: 'agenda', label: 'Agenda', href: '/agenda' },
  ]

  const navItems = isIntervenant ? navItemsIntervenant : navItemsAdmin

  const bottomNavItems = isIntervenant ? navItemsIntervenant : [
    { icon: 'flux', label: 'Flux', href: '/app' },
    { icon: 'agenda', label: 'Agenda', href: '/agenda' },
    { icon: 'carnet', label: 'Carnet', href: '/carnet' },
    { icon: 'famille', label: 'Famille', href: '/famille' },
    { icon: 'profil', label: 'Profil', href: '/profil' },
  ]

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #161E18; }
        @media (max-width: 768px) {
          .holiris-sidebar { display: none !important; }
          .holiris-main { padding: 24px 16px 96px 16px !important; }
          .holiris-bottom-nav { display: flex !important; }
          .holiris-layout { height: auto !important; min-height: 100vh !important; }
        }
        @media (min-width: 769px) {
          .holiris-bottom-nav { display: none !important; }
          .holiris-layout { height: 100vh !important; }
        }
        .nav-link:hover .nav-link-inner {
          background: rgba(154,184,159,0.08) !important;
          color: rgba(255,255,255,0.7) !important;
        }
        .holiris-scroll::-webkit-scrollbar { width: 4px; }
        .holiris-scroll::-webkit-scrollbar-track { background: transparent; }
        .holiris-scroll::-webkit-scrollbar-thumb { background: rgba(107,143,113,0.3); border-radius: 2px; }
      `}</style>

      <div className="holiris-layout" style={{
        display: 'flex',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        background: '#161E18',
        color: '#FAFCFA',
      }}>

        {/* ── Sidebar desktop ── */}
        <aside className="holiris-sidebar" style={{
          width: 240,
          background: 'rgba(255,255,255,0.02)',
          borderRight: '1px solid rgba(107,143,113,0.12)',
          padding: '24px 16px',
          display: 'flex', flexDirection: 'column', gap: 24,
          flexShrink: 0, overflowY: 'auto',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 8px' }}>
            <svg width="28" height="28" viewBox="0 0 64 64" fill="none">
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#9AB89F" strokeWidth="1.5" fill="none"/>
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#A89FCC" strokeWidth="1.5" fill="none"/>
              <circle cx="32" cy="32" r="5" fill="#9AB89F"/>
              <circle cx="32" cy="32" r="2.2" fill="#161E18"/>
            </svg>
            <div>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 20, fontWeight: 300, letterSpacing: '0.1em', lineHeight: 1 }}>
                Hol<span style={{ color: '#9AB89F', fontStyle: 'italic' }}>iris</span>
              </div>
              <div style={{ fontSize: 8, color: 'rgba(154,184,159,0.5)', letterSpacing: '0.2em', textTransform: 'uppercase', marginTop: 2 }}>
                {isIntervenant ? 'Intervenant' : 'Pyrénées-Orientales'}
              </div>
            </div>
          </div>

          {/* Senior */}
          {isAdmin && seniors?.length > 1 ? (
            <div style={{ background: 'rgba(107,143,113,0.08)', border: '1px solid rgba(107,143,113,0.2)', borderRadius: 6, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, color: 'rgba(154,184,159,0.6)', marginBottom: 8, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Dossier actif</div>
              <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
                style={{ width: '100%', background: 'transparent', color: '#FAFCFA', border: 'none', fontSize: 13, cursor: 'pointer', outline: 'none', fontFamily: 'inherit' }}>
                {seniors.map(s => <option key={s.id} value={s.id} style={{ background: '#1E2820' }}>{s.name} · {s.age} ans</option>)}
              </select>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>{senior?.city}</div>
            </div>
          ) : senior ? (
            <div style={{ background: 'rgba(107,143,113,0.08)', border: '1px solid rgba(107,143,113,0.2)', borderRadius: 6, padding: '12px 14px' }}>
              <div style={{ fontSize: 9, color: 'rgba(154,184,159,0.6)', marginBottom: 6, letterSpacing: '0.2em', textTransform: 'uppercase' }}>Dossier actif</div>
              <div style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: 17, fontWeight: 400, color: '#FAFCFA' }}>{senior.name}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 3 }}>{senior.age} ans · {senior.city}</div>
            </div>
          ) : null}

          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 1, flex: 1 }}>
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className="nav-link" style={{ textDecoration: 'none' }}>
                  <div className="nav-link-inner" style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 6,
                    color: active ? '#9AB89F' : 'rgba(255,255,255,0.4)',
                    background: active ? 'rgba(107,143,113,0.12)' : 'transparent',
                    fontSize: 13, fontWeight: active ? 500 : 300,
                    transition: 'all 0.15s',
                    borderLeft: active ? '2px solid #6B8F71' : '2px solid transparent',
                  }}>
                    <NavIcon type={item.icon} active={active} />
                    <span>{item.label}</span>
                  </div>
                </Link>
              )
            })}
          </nav>

          {isAdmin && (
            <div style={{ background: 'rgba(196,122,130,0.08)', border: '1px solid rgba(196,122,130,0.2)', borderRadius: 6, padding: '8px 12px' }}>
              <div style={{ fontSize: 10, color: '#C47A82', letterSpacing: '0.05em' }}>Mode Admin</div>
            </div>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="holiris-main holiris-scroll" style={{
          flex: 1, padding: '32px 36px', overflowY: 'auto', background: '#161E18',
        }}>
          {children}
        </main>

        {/* ── Bottom nav mobile ── */}
        <nav className="holiris-bottom-nav" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(18,26,20,0.96)',
          borderTop: '1px solid rgba(107,143,113,0.15)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingTop: 10, paddingBottom: 20,
          zIndex: 100,
          justifyContent: 'space-around', alignItems: 'center',
        }}>
          {bottomNavItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none', flex: 1 }}>
                <div style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: active ? 'rgba(107,143,113,0.2)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}>
                    <NavIcon type={item.icon} active={active} />
                  </div>
                  <span style={{ fontSize: 10, color: active ? '#9AB89F' : 'rgba(255,255,255,0.3)', fontWeight: active ? 500 : 300, letterSpacing: '0.03em' }}>
                    {item.label}
                  </span>
                </div>
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}