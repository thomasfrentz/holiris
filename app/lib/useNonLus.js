import { useState, useEffect } from 'react'

// Messages non lus de l'utilisateur connecté : { total, parSenior: { <id>: { nombre, auteurs } } }
// Actualisé chaque minute et au retour sur l'onglet
export function useNonLus() {
  const [nonLus, setNonLus] = useState({ total: 0, parSenior: {} })

  useEffect(() => {
    let actif = true
    async function charger() {
      try {
        const res = await fetch('/api/messages/non-lus')
        if (res.ok && actif) setNonLus(await res.json())
      } catch {}
    }
    charger()
    const minuterie = setInterval(charger, 60000)
    const auRetour = () => { if (document.visibilityState === 'visible') charger() }
    document.addEventListener('visibilitychange', auRetour)
    return () => { actif = false; clearInterval(minuterie); document.removeEventListener('visibilitychange', auRetour) }
  }, [])

  return nonLus
}

// « Sylvie », « Sylvie et Marc », « Sylvie, Marc et Claire »
export function listePrenoms(prenoms) {
  if (prenoms.length <= 1) return prenoms[0] || ''
  return prenoms.slice(0, -1).join(', ') + ' et ' + prenoms[prenoms.length - 1]
}
