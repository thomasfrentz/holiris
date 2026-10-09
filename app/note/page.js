'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import NoteVocale from '../components/NoteVocale'
import ActiverNotifications from '../components/ActiverNotifications'
import { useNonLus } from '../lib/useNonLus'

// Écran « Note rapide » : point d'entrée de l'application installée sur le téléphone
export default function NoteRapide() {
  const [chargement, setChargement] = useState(true)
  const [seniors, setSeniors] = useState([]) // { id, name, source }
  const [seniorId, setSeniorId] = useState(null)
  const [prenom, setPrenom] = useState('')
  const [installation, setInstallation] = useState(null) // null | 'ios' | 'android'
  const [promptAndroid, setPromptAndroid] = useState(null)
  const [userId, setUserId] = useState(null)
  const router = useRouter()
  const nonLus = useNonLus()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function charger() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        // Intervenant sans compte (borne sur téléphone) : l'icône de l'écran d'accueil ouvre sa page
        let jeton = null
        try { jeton = window.localStorage.getItem('holiris_ma_borne') } catch {}
        if (jeton) { window.location.replace('/ma-borne?j=' + encodeURIComponent(jeton)); return }
        router.push('/login?redirect=' + encodeURIComponent('/note'))
        return
      }

      const [{ data: interv }, { data: fam }, { data: gestion }] = await Promise.all([
        supabase.from('intervenants').select('name, senior_id, selected_senior_id, seniors!intervenants_senior_id_fkey(id, name)').eq('user_id', user.id).is('archived_at', null),
        supabase.from('famille').select('name, senior_id, selected_senior_id, is_admin, seniors!famille_senior_id_fkey(id, name)').eq('user_id', user.id).is('archived_at', null),
        supabase.from('structure_membres').select('nom, structure_id, selected_senior_id').eq('user_id', user.id),
      ])

      // Un senior par ligne ; le rôle d'intervenant prime si la personne est aussi un proche
      const liste = new Map()
      // L'admin voit tous les dossiers, comme sur le site
      if ((fam || []).some(l => l.is_admin)) {
        const { data: tousSeniors } = await supabase.from('seniors').select('id, name')
        for (const sr of tousSeniors || []) liste.set(sr.id, { ...sr, source: 'famille' })
      }
      // Le gestionnaire voit les dossiers de sa structure
      if (gestion?.length) {
        const { data: seniorsStructure } = await supabase.from('seniors').select('id, name').in('structure_id', gestion.map(g => g.structure_id))
        for (const sr of seniorsStructure || []) liste.set(sr.id, { ...sr, source: 'famille' })
      }
      for (const l of fam || []) if (l.seniors) liste.set(l.seniors.id, { ...l.seniors, source: 'famille' })
      for (const l of interv || []) if (l.seniors) liste.set(l.seniors.id, { ...l.seniors, source: 'intervenant' })
      const tous = [...liste.values()].sort((a, b) => a.name.localeCompare(b.name))
      const lignes = [...(interv || []), ...(fam || []), ...(gestion || []).map(g => ({ ...g, name: g.nom }))]
      const prefere = lignes.find(l => l.selected_senior_id && liste.has(l.selected_senior_id))?.selected_senior_id

      setSeniors(tous)
      setSeniorId(prefere || tous[0]?.id || null)
      setUserId(user.id)
      setPrenom(lignes[0]?.name?.split(' ')[0] || '')

      // Aide à l'installation si l'application n'est pas déjà sur l'écran d'accueil
      const installee = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
      if (!installee) setInstallation(/iphone|ipad|ipod/i.test(navigator.userAgent) ? 'ios' : 'android')
      setChargement(false)
    }
    charger()

    const surPrompt = e => { e.preventDefault(); setPromptAndroid(e) }
    window.addEventListener('beforeinstallprompt', surPrompt)
    return () => window.removeEventListener('beforeinstallprompt', surPrompt)
  }, [])

  async function installerAndroid() {
    if (!promptAndroid) return
    promptAndroid.prompt()
    const { outcome } = await promptAndroid.userChoice
    if (outcome === 'accepted') setInstallation(null)
    setPromptAndroid(null)
  }

  const senior = seniors.find(s => s.id === seniorId)

  // Le senior choisi devient aussi le dossier actif sur le site et pour WhatsApp
  async function choisirSenior(id) {
    setSeniorId(id)
    if (!userId) return
    await Promise.all([
      supabase.from('famille').update({ selected_senior_id: id }).eq('user_id', userId),
      supabase.from('intervenants').update({ selected_senior_id: id }).eq('user_id', userId),
      supabase.from('structure_membres').update({ selected_senior_id: id }).eq('user_id', userId),
    ])
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'linear-gradient(160deg, #FCFDFC 0%, #F0F7F4 55%, #F5F0FA 100%)', fontFamily: "'Inter', system-ui, sans-serif", color: '#1F2A24', display: 'flex', flexDirection: 'column' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500&family=Inter:wght@300;400;500;600&display=swap');`}</style>

      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="30" height="30" viewBox="0 0 64 64" fill="none">
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(-15 32 32)" stroke="#7FAF9B" strokeWidth="2.2" fill="none"/>
            <ellipse cx="32" cy="32" rx="17" ry="24" transform="rotate(15 32 32)" stroke="#BC84C6" strokeWidth="2.2" fill="none"/>
            <circle cx="32" cy="32" r="4.5" fill="#7FAF9B"/>
            <circle cx="32" cy="32" r="2" fill="#fff"/>
          </svg>
          <span style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 500 }}>Holiris</span>
        </div>
        {senior && (
          <a href={senior.source === 'intervenant' ? '/espace-intervenant' : '/app'} style={{ fontSize: 13, color: '#4A8870', textDecoration: 'none', fontWeight: 500 }}>
            Mon espace →
          </a>
        )}
      </header>

      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '12px 20px 32px', maxWidth: 480, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        {chargement ? (
          <div style={{ textAlign: 'center', color: '#9BB5AA', fontSize: 14 }}>Chargement…</div>
        ) : !seniors.length ? (
          <div style={{ textAlign: 'center', fontSize: 14, color: '#6F7C75', lineHeight: 1.7 }}>
            Aucun dossier n&apos;est encore rattaché à votre compte.<br />Utilisez le lien reçu par email pour activer votre accès.
          </div>
        ) : (
          <>
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 30, lineHeight: 1.15, textAlign: 'center', marginBottom: 6 }}>
              Bonjour{prenom ? ' ' + prenom : ''} 👋
            </div>
            <div style={{ fontSize: 14, color: '#6F7C75', textAlign: 'center', marginBottom: 22 }}>Comment s&apos;est passée la visite ?</div>
            <ActiverNotifications />

            <div style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 14, padding: '12px 16px', marginBottom: 28 }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: '#7FAF9B', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: 4 }}>Note pour</div>
              {seniors.length > 1 ? (
                <select value={seniorId || ''} onChange={e => choisirSenior(e.target.value)}
                  style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 18, fontFamily: "'Cormorant Garamond', serif", fontWeight: 500, color: '#1F2A24', outline: 'none', padding: '2px 0', cursor: 'pointer' }}>
                  {seniors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              ) : (
                <div style={{ fontSize: 18, fontFamily: "'Cormorant Garamond', serif", fontWeight: 500 }}>{senior?.name}</div>
              )}
            </div>

            <NoteVocale key={seniorId} seniorId={seniorId} source={senior?.source || 'famille'} grand />

            <a href="/messages" style={{ display: 'block', textAlign: 'center', marginTop: 26, padding: '12px 16px', background: '#fff', border: '1px solid #C8DDD4', borderRadius: 12, color: '#4A8870', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}>
              💬 Messages de l&apos;équipe
              {nonLus.parSenior[seniorId]?.nombre > 0 && (
                <span style={{ marginLeft: 8, minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: '#D98992', color: '#fff', fontSize: 11, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', verticalAlign: 'middle' }}>{nonLus.parSenior[seniorId].nombre}</span>
              )}
            </a>

            <div style={{ fontSize: 12, color: '#9BB5AA', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
              Moral, repas, activités, ce que vous avez remarqué.<br />Les informations médicales ne sont pas enregistrées.
            </div>
          </>
        )}
      </main>

      {installation && !chargement && seniors.length > 0 && (
        <div style={{ margin: '0 16px calc(env(safe-area-inset-bottom, 0px) + 16px)', background: '#fff', border: '1px solid #E0D0EC', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 22 }}>📲</div>
          <div style={{ flex: 1, fontSize: 13, color: '#6F7C75', lineHeight: 1.5 }}>
            <strong style={{ color: '#1F2A24' }}>Installez Holiris sur votre téléphone.</strong><br />
            {installation === 'android' && promptAndroid
              ? 'Un raccourci pour enregistrer vos notes en un geste.'
              : <>Une icône sur l&apos;écran d&apos;accueil pour dicter vos notes en un geste. <a href="/installer" style={{ color: '#8B6FAA', fontWeight: 600 }}>Voir comment faire →</a></>}
          </div>
          {installation === 'android' && promptAndroid && (
            <button onClick={installerAndroid} style={{ background: '#8B6FAA', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}>Installer</button>
          )}
          <button onClick={() => setInstallation(null)} aria-label="Fermer" style={{ background: 'none', border: 'none', color: '#9BB5AA', fontSize: 18, cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  )
}
