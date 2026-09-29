'use client'
import { useState } from 'react'

const LIENS = ['Fils / Fille', 'Petit-fils / Petite-fille', 'Frère / Sœur', 'Neveu / Nièce', 'Conjoint(e)', 'Ami(e) proche', 'Professionnel(le)', 'Autre']

export default function DemandeAcces() {
  const [form, setForm] = useState({ prenom: '', nom: '', email: '', telephone: '', seniorNom: '', seniorVille: '', lien: '', message: '', site_web: '' })
  const [etat, setEtat] = useState('saisie') // saisie | envoi | envoyee
  const [error, setError] = useState('')

  const maj = champ => e => setForm(prev => ({ ...prev, [champ]: e.target.value }))
  const complet = form.prenom.trim() && form.nom.trim() && form.email.trim()

  async function envoyer() {
    if (!complet) return
    setEtat('envoi'); setError('')
    try {
      const res = await fetch('/api/demande-acces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const result = await res.json()
      if (result.success) setEtat('envoyee')
      else { setError(result.error || 'Une erreur est survenue.'); setEtat('saisie') }
    } catch {
      setError('Erreur réseau, réessayez.'); setEtat('saisie')
    }
  }

  const input = { width: '100%', padding: '11px 14px', border: '1px solid #E8EFEB', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'inherit', background: '#FAFCFC', boxSizing: 'border-box' }
  const label = { fontSize: 11, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 6 }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 50%, #F5F0FA 100%)', fontFamily: "'Inter', sans-serif", padding: 24 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500;600&display=swap');`}</style>
      <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 16, padding: '36px 32px', width: '100%', maxWidth: 520, boxShadow: '0 4px 24px rgba(127,175,155,0.1)' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <svg width="44" height="44" viewBox="0 0 64 64" fill="none" style={{ marginBottom: 12 }}>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="1.5" fill="none"/>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="1.5" fill="none"/>
            <circle cx="32" cy="32" r="5" fill="#7FAF9B"/>
            <circle cx="32" cy="32" r="2.2" fill="#fff"/>
          </svg>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500, color: '#1F2A24' }}>Demander un accès</div>
        </div>

        {etat === 'envoyee' ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, color: '#4A8870', marginBottom: 12 }}>Demande envoyée ✓</div>
            <p style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.7 }}>
              Merci {form.prenom} ! Nous étudions votre demande et revenons vers vous rapidement.
              Dès qu&apos;elle est validée, vous recevrez un email à <strong>{form.email}</strong> pour créer votre compte.
            </p>
          </div>
        ) : (
          <>
            <p style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.7, marginBottom: 24, textAlign: 'center' }}>
              Holiris est actuellement ouvert sur validation. Présentez-vous en quelques mots :
              nous vous répondons rapidement par email.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={label}>Prénom *</label><input value={form.prenom} onChange={maj('prenom')} style={input} /></div>
              <div><label style={label}>Nom *</label><input value={form.nom} onChange={maj('nom')} style={input} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={label}>Email *</label><input type="email" value={form.email} onChange={maj('email')} style={input} /></div>
              <div><label style={label}>Téléphone</label><input type="tel" value={form.telephone} onChange={maj('telephone')} style={input} /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
              <div><label style={label}>Proche concerné</label><input placeholder="Prénom et nom" value={form.seniorNom} onChange={maj('seniorNom')} style={input} /></div>
              <div><label style={label}>Ville</label><input value={form.seniorVille} onChange={maj('seniorVille')} style={input} /></div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={label}>Votre lien avec ce proche</label>
              <select value={form.lien} onChange={maj('lien')} style={{ ...input, cursor: 'pointer' }}>
                <option value="">Choisir…</option>
                {LIENS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label style={label}>Message</label>
              <textarea rows={3} placeholder="Votre situation, vos attentes…" value={form.message} onChange={maj('message')} style={{ ...input, resize: 'vertical' }} />
            </div>

            {/* Champ piège pour les robots, invisible pour les visiteurs */}
            <input tabIndex={-1} autoComplete="off" value={form.site_web} onChange={maj('site_web')}
              style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} aria-hidden="true" />

            {error && <div style={{ background: '#FBECED', border: '1px solid #F2C4C8', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#C4606A', marginBottom: 14 }}>{error}</div>}

            <button onClick={envoyer} disabled={!complet || etat === 'envoi'}
              style={{ width: '100%', background: '#7FAF9B', color: '#fff', border: 'none', borderRadius: 8, padding: '14px 0', fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', opacity: !complet || etat === 'envoi' ? 0.5 : 1 }}>
              {etat === 'envoi' ? 'Envoi…' : 'Envoyer ma demande'}
            </button>
          </>
        )}

        <div style={{ marginTop: 22, textAlign: 'center' }}>
          <a href="/login" style={{ fontSize: 12, color: '#9BB5AA', textDecoration: 'none' }}>Déjà un compte ? Se connecter</a>
        </div>
      </div>
    </div>
  )
}
