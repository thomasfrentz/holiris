'use client'
import { useState } from 'react'

// Affichée quand une note contenait une information médicale (retirée avant enregistrement)
export default function QuestionMedicale({ signalementId, notePartielle, onClose }) {
  const [etat, setEtat] = useState('question') // question | envoi | fini | erreur
  const [message, setMessage] = useState('')

  async function repondre(essentiel) {
    setEtat('envoi')
    try {
      const res = await fetch('/api/signalement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: signalementId, action: essentiel ? 'essentiel' : 'non_essentiel' })
      })
      const result = await res.json()
      if (!result.success) { setEtat('erreur'); return }
      setMessage(!essentiel
        ? 'C\'est noté. L\'information n\'a pas été conservée.'
        : result.auteurEstDestinataire
          ? 'C\'est noté. Vous êtes la personne de confiance : aucune demande n\'a été envoyée.'
          : (result.destinataire ? result.destinataire + ', personne de confiance,' : 'Un responsable Holiris') + ' va vous contacter pour en savoir plus.')
      setEtat('fini')
    } catch { setEtat('erreur') }
  }

  const btn = { border: 'none', borderRadius: 8, padding: '12px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flex: 1 }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 8px 40px rgba(0,0,0,0.15)' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: '#C4844A', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 10 }}>Information médicale</div>
        {etat === 'fini' ? (
          <>
            <div style={{ fontSize: 14, color: '#1F2A24', lineHeight: 1.6, marginBottom: 20 }}>{message}</div>
            <button onClick={onClose} style={{ ...btn, width: '100%', background: '#7FAF9B', color: '#fff' }}>Fermer</button>
          </>
        ) : (
          <>
            <div style={{ fontSize: 14, color: '#1F2A24', lineHeight: 1.6, marginBottom: 12 }}>
              Votre note contient une information médicale. Pour protéger la personne suivie,
              {notePartielle ? ' cette partie n\'a pas été enregistrée (le reste de la note a bien été publié).' : ' elle n\'a pas été enregistrée.'}
            </div>
            <div style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.6, marginBottom: 20 }}>
              Cette information est-elle essentielle ? Si oui, la personne de confiance vous contactera pour en savoir plus.
            </div>
            {etat === 'erreur' && <div style={{ fontSize: 12, color: '#C4606A', marginBottom: 12 }}>Une erreur est survenue, réessayez.</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => repondre(true)} disabled={etat === 'envoi'} style={{ ...btn, background: '#7FAF9B', color: '#fff' }}>Oui, essentielle</button>
              <button onClick={() => repondre(false)} disabled={etat === 'envoi'} style={{ ...btn, background: '#F4F5F5', color: '#6F7C75' }}>Non</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
