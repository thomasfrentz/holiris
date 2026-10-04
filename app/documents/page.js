'use client'
import { useState, useEffect, useCallback } from 'react'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'
import AucunDossier from '../components/AucunDossier'

// Documents à faire signer par le senior : conditions d'utilisation, autorisations, personne de confiance
const TYPES = [
  { type: 'cgu', titre: 'Conditions générales d’utilisation', description: 'Fonctionnement de Holiris, données concernées, droits RGPD.' },
  { type: 'autorisations', titre: 'Autorisations', description: 'Partage des nouvelles, borne, visio après un SOS, WhatsApp : oui ou non pour chacune.' },
  { type: 'personne_confiance', titre: 'Personne de confiance', description: 'Désignation de la personne prévenue en cas d’information médicale.' },
]
const LIBELLES_AUTORISATIONS = { partage: 'Partage des nouvelles', borne: 'Borne au domicile', visio: 'Visio après un SOS', whatsapp: 'Notes par WhatsApp' }

export default function Documents() {
  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin, loading: seniorsLoading } = useSenior()
  const [documents, setDocuments] = useState([])
  const [chargement, setChargement] = useState(true)
  const [liens, setLiens] = useState({}) // type -> lien de signature préparé
  const [copie, setCopie] = useState(null)
  const [erreur, setErreur] = useState('')

  const charger = useCallback(async () => {
    if (!selectedSeniorId) return
    const r = await fetch('/api/documents?seniorId=' + selectedSeniorId)
    const d = r.ok ? await r.json() : { documents: [] }
    setDocuments(d.documents || [])
    setChargement(false)
  }, [selectedSeniorId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- chargement des documents du dossier actif
  useEffect(() => { setLiens({}); charger() }, [charger])

  async function preparer(type) {
    setErreur('')
    const r = await (await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'preparer', seniorId: selectedSeniorId, type }) })).json()
    if (!r.success) { setErreur(r.error || 'Erreur'); return }
    setLiens(prev => ({ ...prev, [type]: window.location.origin + r.lien }))
    charger()
  }

  async function annuler(id, type) {
    await fetch('/api/documents', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'annuler', id }) })
    setLiens(prev => ({ ...prev, [type]: null }))
    charger()
  }

  async function copier(type) {
    try { await navigator.clipboard.writeText(liens[type]); setCopie(type); setTimeout(() => setCopie(null), 2500) } catch {}
  }

  if (!seniorsLoading && !seniors.length) return <AucunDossier isAdmin={isAdmin} />
  if (seniorsLoading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', background: '#F7F9F8' }}><div style={{ color: '#9BB5AA' }}>Chargement...</div></div>
  )

  const bouton = (fond, couleur, bord) => ({ background: fond, color: couleur, border: bord ? `1px solid ${bord}` : 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', textDecoration: 'none', display: 'inline-block' })

  return (
    <Layout senior={selectedSenior} seniors={seniors} selectedSeniorId={selectedSeniorId} switchSenior={switchSenior} isAdmin={isAdmin}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, color: '#9BB5AA', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 6, fontWeight: 500 }}>Signature électronique</div>
        <h1 style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 36, fontWeight: 400, color: '#1F2A24', lineHeight: 1 }}>Documents</h1>
        <p style={{ color: '#9BB5AA', fontSize: 13, marginTop: 6 }}>À faire signer par {selectedSenior?.name} ou son représentant légal, au doigt, sur une tablette ou sur la borne.</p>
      </div>

      {isAdmin && (
        <div style={{ background: '#FDF3E7', border: '1px solid #F0D9B5', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#9A6634', lineHeight: 1.5 }}>
          Les textes sont des modèles : faites-les relire par un juriste avant de les utiliser avec de vraies familles.
        </div>
      )}
      {erreur && <div style={{ background: '#FBEDEE', borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13, color: '#8E2F38' }}>{erreur}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {TYPES.map(t => {
          const signe = documents.find(d => d.type === t.type && d.statut === 'signe')
          const enAttente = documents.find(d => d.type === t.type && d.statut === 'en_attente')
          const lien = liens[t.type]
          return (
            <div key={t.type} style={{ background: '#fff', border: '1px solid #E8EFEB', borderRadius: 12, padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div style={{ fontSize: 16, fontWeight: 500, color: '#1F2A24' }}>{t.titre}</div>
                  <div style={{ fontSize: 13, color: '#9BB5AA', marginTop: 2 }}>{t.description}</div>
                  {signe ? (
                    <div style={{ fontSize: 13, color: '#4A8870', marginTop: 8, fontWeight: 500 }}>
                      ✓ Signé le {new Date(signe.signe_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })} par {signe.signataire_nom}
                      {signe.signataire_qualite !== 'personne' && <span style={{ fontWeight: 400 }}> ({signe.signataire_qualite})</span>}
                      <span style={{ color: '#9BB5AA', fontWeight: 400 }}> · version {signe.version}</span>
                    </div>
                  ) : !chargement && (
                    <div style={{ fontSize: 13, color: '#C4844A', marginTop: 8 }}>{enAttente ? 'En attente de signature' : 'Pas encore signé'}</div>
                  )}
                  {signe?.choix && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      {Object.entries(signe.choix).map(([cle, oui]) => (
                        <span key={cle} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 20, background: oui ? '#EAF4EF' : '#FBEDEE', color: oui ? '#4A8870' : '#C4434F' }}>{oui ? '✓' : '✕'} {LIBELLES_AUTORISATIONS[cle] || cle}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {signe && <a href={'/api/documents/pdf?id=' + signe.id} target="_blank" rel="noopener" style={bouton('#EAF4EF', '#4A8870', '#C8DDD4')}>Voir le PDF</a>}
                  {!lien && <button onClick={() => preparer(t.type)} style={bouton('#7FAF9B', '#fff')}>{signe ? 'Faire signer à nouveau' : enAttente ? 'Nouveau lien de signature' : 'Faire signer'}</button>}
                  {enAttente && !lien && <button onClick={() => annuler(enAttente.id, t.type)} style={bouton('#F4F5F5', '#6F7C75', '#E8EFEB')}>Annuler la demande</button>}
                </div>
              </div>

              {lien && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid #F0F4F2' }}>
                  <div style={{ fontSize: 13, color: '#6F7C75', marginBottom: 10, lineHeight: 1.5 }}>
                    Lien de signature prêt, valable 7 jours et utilisable une seule fois. Ouvrez-le devant {selectedSenior?.name.split(' ')[0]}, sur cet appareil ou sur une tablette (vous pouvez le copier et l&apos;ouvrir sur la borne).
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a href={lien} style={bouton('#7FAF9B', '#fff')}>Signer maintenant sur cet appareil</a>
                    <button onClick={() => copier(t.type)} style={bouton('#fff', '#4A8870', '#C8DDD4')}>{copie === t.type ? '✓ Lien copié' : 'Copier le lien'}</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
