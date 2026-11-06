'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import QuestionMedicale from '../components/QuestionMedicale'
import NoteVocale from '../components/NoteVocale'
import { useSenior } from '../lib/useSenior'
import AucunDossier from '../components/AucunDossier'
import { traduitDe } from '../lib/langues'

export default function Carnet() {
  const [notes, setNotes] = useState([])
  const [famille, setFamille] = useState(null)
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [questionMedicale, setQuestionMedicale] = useState(null)
  const [historiques, setHistoriques] = useState({}) // noteId → modifications, pour les notes dont on affiche l'original
  const [supprimees, setSupprimees] = useState([])
  const [voirSupprimees, setVoirSupprimees] = useState(false)
  const [originaux, setOriginaux] = useState({}) // noteId → texte d'origine d'une note traduite (ou null s'il n'a pas été conservé)
  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin, loading: seniorsLoading } = useSenior()
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (!selectedSeniorId) return

      const { data: familleData } = await supabase
        .from('famille').select('*').eq('user_id', user.id).limit(1)
      setFamille(familleData?.[0])

      const { data: notesData } = await supabase
        .from('notes').select('*')
        .eq('senior_id', selectedSeniorId)
        .order('created_at', { ascending: false })
      setNotes(notesData || [])
      setHistoriques({})
      setOriginaux({})

      // Notes supprimées : visibles par qui peut gérer le dossier (admin, gestionnaire de structure)
      setSupprimees([])
      if (isAdmin) {
        const res = await fetch('/api/notes?seniorId=' + selectedSeniorId)
        const result = await res.json().catch(() => ({}))
        if (result.success) setSupprimees(result.supprimees)
      }

      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId, isAdmin])

  async function addNote() {
    if (!newNote.trim()) return
    setSaving(true)
    // Enregistrement côté serveur, avec filtre des informations médicales
    try {
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ seniorId: selectedSeniorId, texte: newNote, source: 'famille' })
      })
      const result = await res.json()
      if (result.success) {
        if (result.note) setNotes(prev => [result.note, ...prev])
        if (result.signalementId) setQuestionMedicale({ id: result.signalementId, notePartielle: !!result.note })
        setNewNote('')
        setShowForm(false)
      }
    } catch (e) { console.error('Erreur ajout note:', e) }
    setSaving(false)
  }

  // Suppression et modification passent par le serveur, qui garde la note supprimée et les textes précédents
  async function deleteNote(id) {
    if (!isAdmin) return
    if (!confirm('Supprimer cette note ? Elle restera visible dans « Notes supprimées », mais ne sera plus prise en compte.')) return
    const res = await fetch('/api/notes', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noteId: id }) })
    const result = await res.json().catch(() => ({}))
    if (!result.success) { alert(result.error || 'La note n’a pas pu être supprimée.'); return }
    setNotes(prev => prev.filter(n => n.id !== id))
    setSupprimees(prev => [result.supprimee, ...prev])
  }

  async function editNote(id, content) {
    if (!isAdmin) return
    const newContent = prompt('Modifier la note :', content)
    if (!newContent?.trim() || newContent.trim() === content) return
    const res = await fetch('/api/notes', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ noteId: id, texte: newContent }) })
    const result = await res.json().catch(() => ({}))
    if (!result.success) { alert(result.error || 'La note n’a pas pu être modifiée.'); return }
    setNotes(prev => prev.map(n => n.id === id ? result.note : n))
    setHistoriques(prev => { const { [id]: _, ...reste } = prev; return reste })
  }

  // Affiche ou masque le texte d'origine et la liste des modifications d'une note
  async function basculerHistorique(id) {
    if (historiques[id]) { setHistoriques(prev => { const { [id]: _, ...reste } = prev; return reste }); return }
    const res = await fetch('/api/notes?noteId=' + id)
    const result = await res.json().catch(() => ({}))
    if (result.success) setHistoriques(prev => ({ ...prev, [id]: result.modifications }))
  }

  // Texte d'origine d'une note traduite, réservé à qui peut gérer le dossier
  async function basculerOriginal(id) {
    if (id in originaux) { setOriginaux(prev => { const { [id]: _, ...reste } = prev; return reste }); return }
    const res = await fetch('/api/notes?original=' + id)
    const result = await res.json().catch(() => ({}))
    if (result.success) setOriginaux(prev => ({ ...prev, [id]: result.original }))
  }

  const blocLangue = n => n.langue_originale && (
    <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
      🌐 {traduitDe(n.langue_originale)}
      {isAdmin && (
        <>
          {' · '}
          <button onClick={() => basculerOriginal(n.id)}
            style={{ background: 'none', border: 'none', padding: 0, color: '#3498db', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
            {n.id in originaux ? 'Masquer le texte d’origine' : 'Voir le texte d’origine'}
          </button>
          {n.id in originaux && (
            <div style={{ marginTop: 8, background: '#f7f5f1', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
              {originaux[n.id]?.texte || 'Le texte d’origine n’a pas été conservé : il contenait une information médicale.'}
            </div>
          )}
        </>
      )}
    </div>
  )

  const dateCourte = d => new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  const blocHistorique = (id, auteurNote, dateNote) => historiques[id] && (
    <div style={{ marginTop: 10, background: '#f7f5f1', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: '#555', lineHeight: 1.6 }}>
      {historiques[id].length === 0 ? <div>Aucune modification enregistrée.</div> : (
        <>
          <div style={{ fontSize: 11, fontWeight: 'bold', color: '#888', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Texte d’origine</div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 4 }}>{auteurNote ? auteurNote + ' · ' : ''}{dateCourte(dateNote)}</div>
          <p style={{ margin: '0 0 8px', whiteSpace: 'pre-wrap' }}>{historiques[id][0].ancien_contenu}</p>
          {historiques[id].map(m => (
            <div key={m.id} style={{ borderTop: '1px solid #ebe6dd', paddingTop: 6, marginTop: 6 }}>
              <div style={{ fontSize: 11, color: '#aaa' }}>Modifiée le {dateCourte(m.created_at)} par {m.modifiee_par_nom || 'inconnu'}</div>
              {historiques[id].length > 1 && <p style={{ margin: '2px 0 0', whiteSpace: 'pre-wrap' }}>{m.nouveau_contenu}</p>}
            </div>
          ))}
        </>
      )}
    </div>
  )

  const sourceLabel = (source) => {
    if (source === 'whatsapp_audio') return { icon: '🎤', label: 'Note vocale', color: '#9b59b6' }
    if (source === 'whatsapp_text') return { icon: '💬', label: 'WhatsApp', color: '#25D366' }
    if (source === 'famille') return { icon: '👨‍👩‍👧', label: 'Note famille', color: '#3498db' }
    if (source === 'qr') return { icon: '📱', label: 'QR code', color: '#4A8870' }
    return { icon: '📝', label: 'Note', color: '#3498db' }
  }

  // Aucun dossier (ex. structure sans client) : message au lieu d'un chargement sans fin
  if (!seniorsLoading && !seniors.length) return <AucunDossier isAdmin={isAdmin} />

  if (loading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Chargement...</div>
    </div>
  )

  return (
    <Layout
      senior={selectedSenior}
      seniors={seniors}
      selectedSeniorId={selectedSeniorId}
      switchSenior={switchSenior}
      isAdmin={isAdmin}
    >
      {questionMedicale && (
        <QuestionMedicale signalementId={questionMedicale.id} notePartielle={questionMedicale.notePartielle}
          onClose={() => setQuestionMedicale(null)} />
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a' }}>📝 Carnet de suivi</h1>
        <button onClick={() => setShowForm(!showForm)}
          style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
          + Ajouter une note
        </button>
      </div>
      <p style={{ color: '#888', marginBottom: 24, fontSize: 13 }}>{notes.length} notes · {selectedSenior?.name}</p>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 20, marginBottom: 20, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <div style={{ fontSize: 13, color: '#888', marginBottom: 8 }}>
            Note de <strong>{famille?.name || famille?.email}</strong>
            {famille?.role && <span> · {famille.role}</span>}
          </div>
          <textarea placeholder="Décrivez l'état de votre proche..." value={newNote} onChange={e => setNewNote(e.target.value)} rows={4}
            style={{ width: '100%', padding: '12px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', resize: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={addNote} disabled={saving || !newNote.trim()}
              style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
              {saving ? 'Publication...' : 'Publier'}
            </button>
            <button onClick={() => { setShowForm(false); setNewNote('') }}
              style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
          <div style={{ borderTop: '1px solid #eee', marginTop: 18, paddingTop: 16 }}>
            <div style={{ fontSize: 12, color: '#888', textAlign: 'center', marginBottom: 12 }}>ou dictez votre note</div>
            <NoteVocale key={selectedSeniorId} seniorId={selectedSeniorId} source="famille"
              onNoteAjoutee={note => setNotes(prev => [note, ...prev])} />
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notes.map((n, index) => {
          const src = sourceLabel(n.source)
          return (
            <div key={n.id || index} style={{ background: '#fff', borderRadius: 12, padding: 18, boxShadow: '0 1px 4px rgba(0,0,0,0.06)', borderLeft: '4px solid ' + src.color }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span style={{ fontSize: 14 }}>{src.icon}</span>
                    <span style={{ fontSize: 12, fontWeight: 'bold', color: src.color }}>{src.label}</span>
                  </div>
                  {n.intervenant_name && (
                    <div style={{ fontSize: 13, color: '#333', fontWeight: '600', background: '#f0f4f0', padding: '3px 10px', borderRadius: 20, display: 'inline-block' }}>
                      👤 {n.intervenant_name}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginLeft: 10 }}>
                  <span style={{ fontSize: 11, color: '#aaa' }}>
                    {new Date(n.created_at).toLocaleString('fr-FR', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button onClick={() => editNote(n.id, n.content)}
                        style={{ background: '#f0f9ff', color: '#3498db', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>✏️</button>
                      <button onClick={() => deleteNote(n.id)}
                        style={{ background: '#fdf0f0', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 12, cursor: 'pointer', fontWeight: 'bold' }}>🗑️</button>
                    </div>
                  )}
                </div>
              </div>
              <p style={{ fontSize: 14, color: '#333', lineHeight: 1.7, margin: 0 }}>{n.content}</p>
              {n.modifiee_at && (
                <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                  ✏️ Modifiée le {dateCourte(n.modifiee_at)}{n.modifiee_par_nom ? ' par ' + n.modifiee_par_nom : ''} ·{' '}
                  <button onClick={() => basculerHistorique(n.id)}
                    style={{ background: 'none', border: 'none', padding: 0, color: '#3498db', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                    {historiques[n.id] ? 'Masquer l’original' : 'Voir l’original'}
                  </button>
                </div>
              )}
              {blocHistorique(n.id, n.intervenant_name, n.created_at)}
              {blocLangue(n)}
            </div>
          )
        })}
        {notes.length === 0 && (
          <div style={{ textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 12 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📝</div>
            <div>Aucune note pour le moment</div>
          </div>
        )}
      </div>

      {isAdmin && supprimees.length > 0 && (
        <div style={{ marginTop: 28 }}>
          <button onClick={() => setVoirSupprimees(v => !v)}
            style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '10px 16px', fontSize: 13, cursor: 'pointer', fontWeight: 'bold' }}>
            🗑️ Notes supprimées ({supprimees.length}) {voirSupprimees ? '▲' : '▼'}
          </button>
          {voirSupprimees && (
            <>
              <p style={{ fontSize: 12, color: '#999', margin: '10px 0 12px' }}>
                Ces notes ne sont plus prises en compte : ni dans les comptes rendus et résumés, ni par les alertes et l’assistant.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {supprimees.map(n => (
                  <div key={n.id} style={{ background: '#faf9f7', borderRadius: 12, padding: 16, border: '1px dashed #ddd', opacity: 0.85 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                      <span style={{ fontSize: 13, color: '#666', fontWeight: 600 }}>{n.intervenant_name ? '👤 ' + n.intervenant_name : 'Note'}</span>
                      <span style={{ fontSize: 11, color: '#aaa', flexShrink: 0 }}>{dateCourte(n.note_created_at)}</span>
                    </div>
                    <p style={{ fontSize: 14, color: '#777', lineHeight: 1.7, margin: 0, textDecoration: 'line-through', textDecorationColor: '#ccc' }}>{n.content}</p>
                    <div style={{ fontSize: 12, color: '#c0392b', marginTop: 8 }}>
                      Supprimée le {dateCourte(n.supprimee_at)}{n.supprimee_par_nom ? ' par ' + n.supprimee_par_nom : ''} ·{' '}
                      <button onClick={() => basculerHistorique(n.id)}
                        style={{ background: 'none', border: 'none', padding: 0, color: '#3498db', fontSize: 12, cursor: 'pointer', textDecoration: 'underline' }}>
                        {historiques[n.id] ? 'Masquer les modifications' : 'Voir les modifications'}
                      </button>
                    </div>
                    {blocHistorique(n.id, n.intervenant_name, n.note_created_at)}
                    {blocLangue(n)}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </Layout>
  )
}
