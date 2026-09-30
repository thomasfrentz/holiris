'use client'
import Link from 'next/link'
import { listePrenoms } from '../lib/useNonLus'

// Encadré « nouveaux messages » du tableau de bord, pour le senior actif seulement
export default function BandeauMessages({ nonLus, seniorId }) {
  const ici = nonLus?.parSenior[seniorId]
  if (!ici) return null

  return (
    <Link href="/messages" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #C8DDD4', borderLeft: '3px solid #7FAF9B', borderRadius: 12, padding: '14px 18px', marginBottom: 20 }}>
      <span style={{ fontSize: 22 }}>💬</span>
      <span style={{ flex: 1, fontSize: 14, color: '#1F2A24', lineHeight: 1.5 }}>
        <strong>{ici.nombre} nouveau{ici.nombre > 1 ? 'x' : ''} message{ici.nombre > 1 ? 's' : ''}</strong> de {listePrenoms(ici.auteurs)}
      </span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#4A8870', whiteSpace: 'nowrap' }}>Lire →</span>
    </Link>
  )
}
