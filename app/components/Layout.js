'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { useNonLus } from '../lib/useNonLus'
import ActiverNotifications from './ActiverNotifications'

// Rôle de l'utilisateur connecté : structure dont il est gestionnaire (nom), et admin Holiris
function useRole() {
  const [structure, setStructure] = useState(null)
  const [adminHoliris, setAdminHoliris] = useState(false)
  useEffect(() => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    async function charger() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: gestion }, { data: admin }] = await Promise.all([
        supabase.from('structure_membres').select('structures(nom)').eq('user_id', user.id).limit(1),
        supabase.from('famille').select('id').eq('user_id', user.id).eq('is_admin', true).is('archived_at', null).limit(1),
      ])
      if (gestion?.[0]?.structures) setStructure(gestion[0].structures)
      if (admin?.length) setAdminHoliris(true)
    }
    charger()
  }, [])
  return { structure, adminHoliris }
}

const Icon = ({ type, active, size = 18 }) => {
  const color = active ? '#7FAF9B' : 'rgba(31,42,36,0.4)'
  const icons = {
    flux: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
    agenda: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
    carnet: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    ordonnances: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18"/></svg>,
    famille: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    intervenants: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
    assistant: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/><path d="M8 10h.01M12 10h.01M16 10h.01"/></svg>,
    profil: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
    messages: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></svg>,
    structure: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M3 21h18M5 21V7l7-4 7 4v14"/><path d="M9 21v-6h6v6M9 10h.01M15 10h.01"/></svg>,
    espace: <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  }
  return icons[type] || null
}

export default function Layout({ children, senior, seniors, selectedSeniorId, switchSenior, isAdmin, isIntervenant = false }) {
  const pathname = usePathname()
  const { structure, adminHoliris } = useRole()
  const nonLus = useNonLus()
  // Seuls les messages du senior actif sont signalés
  const nbMessages = nonLus.parSenior[selectedSeniorId]?.nombre || 0

  const navItemsAdmin = [
    { icon: 'flux', label: 'Flux en temps réel', href: '/app' },
    { icon: 'agenda', label: 'Agenda', href: '/agenda' },
    { icon: 'carnet', label: 'Carnet de suivi', href: '/carnet' },
    { icon: 'messages', label: 'Messages', href: '/messages' },
    { icon: 'ordonnances', label: 'Ordonnances', href: '/ordonnances' },
    { icon: 'famille', label: 'Famille', href: '/famille' },
    { icon: 'intervenants', label: 'Intervenants', href: '/intervenants' },
    { icon: 'ordonnances', label: 'Documents', href: '/documents' },
    { icon: 'assistant', label: 'Assistant IA', href: '/assistant' },
    { icon: 'profil', label: 'Profil', href: '/profil' },
  ]

  const navItemsIntervenant = [
    { icon: 'espace', label: 'Mon espace', href: '/espace-intervenant' },
    { icon: 'messages', label: 'Messages', href: '/messages' },
    { icon: 'agenda', label: 'Agenda', href: '/agenda' },
  ]

  const navItemStructure = { icon: 'structure', label: 'Ma structure', href: '/structure' }
  const navItems = isIntervenant ? navItemsIntervenant : structure ? [navItemStructure, ...navItemsAdmin] : navItemsAdmin

  const bottomNavItems = isIntervenant ? navItemsIntervenant : [
    { icon: 'flux', label: '', href: '/app' },
    { icon: 'agenda', label: 'Agenda', href: '/agenda' },
    { icon: 'messages', label: 'Messages', href: '/messages' },
    { icon: 'famille', label: 'Famille', href: '/famille' },
    { icon: 'intervenants', label: 'Équipe', href: '/intervenants' },
    { icon: 'carnet', label: 'Carnet', href: '/carnet' },
    structure ? { icon: 'structure', label: 'Structure', href: '/structure' } : { icon: 'profil', label: 'Profil', href: '/profil' },
  ]

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
          display: flex; align-items: center; gap: 10px;
          padding: 9px 12px; border-radius: 8px;
          transition: all 0.15s; cursor: pointer;
        }
        .hl-navlink:hover .hl-navlink-inner { background: #EAF4EF; }

        .hl-scroll::-webkit-scrollbar { width: 3px; }
        .hl-scroll::-webkit-scrollbar-track { background: transparent; }
        .hl-scroll::-webkit-scrollbar-thumb { background: #C8DDD4; border-radius: 4px; }

        .hl-bottom-item { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 8px 2px; text-decoration: none; }
        .hl-card { background: #fff; border: 1px solid #E8EFEB; border-radius: 12px; transition: box-shadow 0.2s, border-color 0.2s; }
        .hl-card:hover { box-shadow: 0 4px 16px rgba(127,175,155,0.12); border-color: #C8DDD4; }

        .hl-install-mobile, .hl-admin-mobile { display: none; }
        @media (max-width: 768px) { .hl-install-mobile, .hl-admin-mobile { display: flex; } }
        @media (display-mode: standalone) { .hl-install, .hl-install-mobile { display: none !important; } }
      `}</style>

      <div className="hl-wrap">

        {/* ── Sidebar desktop ── */}
        <aside className="hl-sidebar hl-scroll" style={{
          width: 256, background: '#fff', borderRight: '1px solid #EBF0EC',
          padding: '28px 16px', flexDirection: 'column', gap: 0,
          flexShrink: 0, overflowY: 'auto',
        }}>

          {/* Logo */}
          <Link href="/app" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, padding: '4px 10px', marginBottom: 32 }}>
            <svg width="36" height="36" viewBox="0 0 64 64" fill="none">
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="2" fill="none"/>
              <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="2" fill="none"/>
              <circle cx="32" cy="32" r="4" fill="#7FAF9B"/>
              <circle cx="32" cy="32" r="1.8" fill="#fff"/>
            </svg>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontWeight: 500, letterSpacing: '0.05em', color: '#1F2A24', lineHeight: 1 }}>
              Holiris
            </div>
          </Link>

          {/* Senior card */}
          {senior && (
            <div style={{ background: '#EAF4EF', borderRadius: 10, padding: '12px 14px', marginBottom: 24 }}>
              <div style={{ fontSize: 9, color: '#7FAF9B', letterSpacing: '0.2em', textTransform: 'uppercase', fontWeight: 600, marginBottom: 6 }}>
                Dossier actif
              </div>
              {seniors?.length > 1 ? (
                <select value={selectedSeniorId || ''} onChange={e => switchSenior(e.target.value)}
                  style={{ width: '100%', background: 'transparent', color: '#1F2A24', border: 'none', fontSize: 15, cursor: 'pointer', outline: 'none', fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>
                  {seniors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 16, fontWeight: 500, color: '#1F2A24' }}>{senior.name}</div>
              )}
              <div style={{ fontSize: 11, color: '#6F7C75', marginTop: 3 }}>{senior.age} ans · {senior.city}</div>
            </div>
          )}

          {/* Nav */}
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
            {navItems.map((item) => {
              const active = pathname === item.href
              return (
                <Link key={item.href} href={item.href} className="hl-navlink">
                  <div className="hl-navlink-inner" style={{ background: active ? '#EAF4EF' : 'transparent' }}>
                    <Icon type={item.icon} active={active} size={16} />
                    <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, color: active ? '#4A8870' : '#6F7C75' }}>
                      {item.label}
                    </span>
                    {nbMessages > 0 && item.href === '/messages' && (
                      <span style={{ marginLeft: 'auto', minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9, background: '#D98992', color: '#fff', fontSize: 10, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{nbMessages > 99 ? '99+' : nbMessages}</span>
                    )}
                    {active && !(nbMessages > 0 && item.href === '/messages') && <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#7FAF9B', marginLeft: 'auto' }} />}
                  </div>
                </Link>
              )
            })}
          </nav>

          <Link href="/installer" className="hl-install" style={{ textDecoration: 'none', marginTop: 16, display: 'block', padding: '10px 12px', background: '#F3EDF7', border: '1px solid #E0D0EC', borderRadius: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 500, color: '#8B6FAA' }}>📲 Installer l&apos;application</div>
            <div style={{ fontSize: 11, color: '#9BB5AA', marginTop: 2 }}>Dictez vos notes depuis le téléphone</div>
          </Link>

          {structure ? (
            <div style={{ marginTop: 16, padding: '8px 12px', background: '#EAF4EF', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#4A8870', fontWeight: 500 }}>Structure · {structure.nom}</div>
            </div>
          ) : isAdmin && !adminHoliris && (
            <div style={{ marginTop: 16, padding: '8px 12px', background: '#FEF0F1', borderRadius: 8 }}>
              <div style={{ fontSize: 10, color: '#C47A82', fontWeight: 500 }}>Mode Admin actif</div>
            </div>
          )}

          {/* Fonctions d'administration : réservées à l'admin Holiris */}
          {adminHoliris && (
            <Link href="/admin" style={{ textDecoration: 'none', marginTop: 16, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#FEF0F1', border: '1px solid #F2C4C8', borderRadius: 8 }}>
              <span style={{ fontSize: 15 }}>⚙️</span>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#C4606A' }}>Administration</span>
                <span style={{ display: 'block', fontSize: 10, color: '#C47A82' }}>Demandes d&apos;accès, structures, bornes…</span>
              </span>
              <span style={{ color: '#C4606A' }}>→</span>
            </Link>
          )}
        </aside>

        {/* ── Main ── */}
        <main className="hl-main hl-scroll" style={{
          flex: 1, padding: '36px 40px', overflowY: 'auto', background: '#F7F9F8',
        }}>
          {adminHoliris && (
            <Link href="/admin" className="hl-admin-mobile" style={{ textDecoration: 'none', alignItems: 'center', gap: 10, background: '#FEF0F1', border: '1px solid #F2C4C8', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
              <span style={{ fontSize: 16 }}>⚙️</span>
              <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: '#C4606A' }}>Administration</span>
              <span style={{ color: '#C4606A' }}>→</span>
            </Link>
          )}
          <Link href="/installer" className="hl-install-mobile" style={{ textDecoration: 'none', alignItems: 'center', gap: 10, background: '#F3EDF7', border: '1px solid #E0D0EC', borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
            <span style={{ fontSize: 18 }}>📲</span>
            <span style={{ flex: 1, fontSize: 13, color: '#6F7C75' }}><strong style={{ color: '#8B6FAA' }}>Installer l&apos;application</strong> pour dicter vos notes</span>
            <span style={{ color: '#8B6FAA' }}>→</span>
          </Link>
          <ActiverNotifications />
          {children}
        </main>

        {/* ── Bottom nav mobile ── */}
        <nav className="hl-bottom" style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          background: 'rgba(255,255,255,0.97)',
          borderTop: '1px solid #EBF0EC',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          paddingTop: 6, zIndex: 100,
          justifyContent: 'space-around', alignItems: 'center',
        }}>
          {bottomNavItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link key={item.href} href={item.href} className="hl-bottom-item">
                <div style={{
                  width: 34, height: 34, borderRadius: 9,
                  background: active ? '#EAF4EF' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s', position: 'relative',
                }}>
                  <Icon type={item.icon} active={active} size={18} />
                  {nbMessages > 0 && item.href === '/messages' && (
                    <span style={{ position: 'absolute', top: -2, right: -4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#D98992', color: '#fff', fontSize: 9, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{nbMessages > 99 ? '99+' : nbMessages}</span>
                  )}
                </div>
                {item.label && (
                  <span style={{
                    fontSize: 9, letterSpacing: '0.08em', textTransform: 'uppercase',
                    color: active ? '#4A8870' : '#9BB5AA',
                    fontWeight: active ? 600 : 400,
                  }}>
                    {item.label}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
  )
}
