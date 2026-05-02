'use client'
import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { useRouter } from 'next/navigation'
import Layout from '../components/Layout'
import { useSenior } from '../lib/useSenior'

export default function Ordonnances() {
  const [ordonnances, setOrdonnances] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [typeOrdonnance, setTypeOrdonnance] = useState('')
  const [dateRenouvellement, setDateRenouvellement] = useState('')
  const [notes, setNotes] = useState('')

  const { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin } = useSenior()
  const router = useRouter()

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  const typesOrdonnance = [
    'Médicaments', 'Examens biologiques', 'Imagerie (radio, scanner, IRM)',
    'Infirmière (IDE)', 'Kinésithérapie', 'Orthophonie', 'Ergothérapie', 'Appareillage', 'Autre',
  ]

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      if (!selectedSeniorId) return

      const { data } = await supabase
        .from('ordonnances').select('*')
        .eq('senior_id', selectedSeniorId)
        .order('date_renouvellement', { ascending: true })
      setOrdonnances(data || [])
      setLoading(false)
    }
    loadData()
  }, [selectedSeniorId])

  function resetForm() {
    setTypeOrdonnance(''); setDateRenouvellement(''); setNotes(''); setEditingId(null); setShowForm(false)
  }

  function startEdit(o) {
    setTypeOrdonnance(o.type_ordonnance); setDateRenouvellement(o.date_renouvellement)
    setNotes(o.notes || ''); setEditingId(o.id); setShowForm(true)
  }

  async function saveOrdonnance() {
    if (!typeOrdonnance || !dateRenouvellement) return
    setSaving(true)
    if (editingId) {
      await supabase.from('ordonnances').update({
        type_ordonnance: typeOrdonnance, date_renouvellement: dateRenouvellement, notes: notes || null
      }).eq('id', editingId)
      setOrdonnances(prev => prev.map(o =>
        o.id === editingId ? { ...o, type_ordonnance: typeOrdonnance, date_renouvellement: dateRenouvellement, notes } : o
      ))
    } else {
      const { data } = await supabase.from('ordonnances').insert({
        senior_id: selectedSeniorId, type_ordonnance: typeOrdonnance,
        date_renouvellement: dateRenouvellement, notes: notes || null
      }).select()
      if (data) setOrdonnances(prev => [...prev, data[0]].sort((a, b) =>
        new Date(a.date_renouvellement) - new Date(b.date_renouvellement)
      ))
    }
    resetForm(); setSaving(false)
  }

  async function deleteOrdonnance(id) {
    await supabase.from('ordonnances').delete().eq('id', id)
    setOrdonnances(prev => prev.filter(o => o.id !== id))
  }

  function joursRestants(date) {
    return Math.ceil((new Date(date) - new Date()) / (1000 * 60 * 60 * 24))
  }

  function statutCouleur(jours) {
    if (jours < 0) return { color: '#e74c3c', bg: '#fdf0f0' }
    if (jours <= 3) return { color: '#e74c3c', bg: '#fdf0f0' }
    if (jours <= 7) return { color: '#f39c12', bg: '#fef9ec' }
    return { color: '#2ecc71', bg: '#eafaf1' }
  }

  if (loading || !selectedSenior) return (
    <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', fontFamily: 'Georgia, serif', background: '#f4f1ec' }}>
      <div style={{ color: '#888' }}>Chargement...</div>
    </div>
  )

  return (
    <Layout senior={selectedSenior} seniors={seniors} selectedSeniorId={selectedSeniorId} switchSenior={switchSenior} isAdmin={isAdmin}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 'bold', color: '#12201a', marginBottom: 4 }}>💊 Ordonnances</h1>
          <p style={{ color: '#888', fontSize: 13 }}>{ordonnances.length} ordonnance{ordonnances.length > 1 ? 's' : ''} · {selectedSenior?.name}</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(!showForm) }}
          style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
          + Ajouter
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 24, marginBottom: 24, boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
          <h2 style={{ fontSize: 16, fontWeight: 'bold', color: '#12201a', marginBottom: 16 }}>
            {editingId ? "Modifier l'ordonnance" : 'Nouvelle ordonnance'}
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Type d'ordonnance</label>
              <select value={typeOrdonnance} onChange={e => setTypeOrdonnance(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', background: '#fff' }}>
                <option value="">Sélectionner...</option>
                {typesOrdonnance.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Date de renouvellement</label>
              <input type="date" value={dateRenouvellement} onChange={e => setDateRenouvellement(e.target.value)}
                style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: '#888', display: 'block', marginBottom: 6 }}>Notes (optionnel)</label>
            <input placeholder="Ex: Dr Martin, renouvellement tous les 3 mois" value={notes} onChange={e => setNotes(e.target.value)}
              style={{ width: '100%', padding: '10px 14px', border: '1px solid #ddd', borderRadius: 8, fontSize: 14, outline: 'none', fontFamily: 'Georgia, serif', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={saveOrdonnance} disabled={saving || !typeOrdonnance || !dateRenouvellement}
              style={{ background: '#12201a', color: '#2ecc71', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 'bold', cursor: 'pointer' }}>
              {saving ? 'Enregistrement...' : editingId ? 'Modifier' : 'Ajouter'}
            </button>
            <button onClick={resetForm}
              style={{ background: '#f0ece6', color: '#666', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, cursor: 'pointer' }}>
              Annuler
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ordonnances.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#aaa', padding: 40, background: '#fff', borderRadius: 12 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>💊</div>
            <div style={{ fontWeight: 'bold', marginBottom: 6 }}>Aucune ordonnance</div>
            <div style={{ fontSize: 13 }}>Ajoutez les ordonnances de {selectedSenior?.name}</div>
          </div>
        ) : ordonnances.map(o => {
          const jours = joursRestants(o.date_renouvellement)
          const statut = statutCouleur(jours)
          return (
            <div key={o.id} style={{ background: '#fff', borderRadius: 12, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ fontSize: 32 }}>💊</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 'bold', fontSize: 15, color: '#12201a' }}>{o.type_ordonnance}</div>
                <div style={{ fontSize: 13, color: '#888', marginTop: 2 }}>
                  Renouvellement le {new Date(o.date_renouvellement).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
                {o.notes && <div style={{ fontSize: 12, color: '#5a8a6a', marginTop: 4 }}>{o.notes}</div>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ background: statut.bg, color: statut.color, borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 'bold' }}>
                  {jours < 0 ? 'Expiré' : `Dans ${jours}j`}
                </div>
                <button onClick={() => startEdit(o)}
                  style={{ background: '#f0f4f0', color: '#5a8a6a', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>✏️</button>
                <button onClick={() => deleteOrdonnance(o.id)}
                  style={{ background: '#fdf0f0', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, cursor: 'pointer' }}>🗑️</button>
              </div>
            </div>
          )
        })}
      </div>
    </Layout>
  )
}
