import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

function calculerAge(dateNaissance) {
  if (!dateNaissance) return null
  return Math.floor((new Date() - new Date(dateNaissance)) / (365.25 * 24 * 60 * 60 * 1000))
}

function enrichirSenior(senior) {
  if (!senior) return senior
  return {
    ...senior,
    age: senior.date_naissance ? calculerAge(senior.date_naissance) : senior.age
  }
}

export function useSenior() {
  const [seniors, setSeniors] = useState([])
  const [selectedSeniorId, setSelectedSeniorId] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const [{ data: familleData }, { data: gestionData }] = await Promise.all([
        supabase.from('famille').select('*').eq('user_id', user.id),
        // Gestionnaire de structure : droits de gestion sur les seniors de sa structure
        supabase.from('structure_membres').select('structure_id, selected_senior_id').eq('user_id', user.id),
      ])
      const famille = familleData || []
      const gestion = gestionData || []

      if (!famille.length && !gestion.length) { setLoading(false); return }

      const isAdminUser = famille.some(f => f.is_admin === true)
      // Les droits de gestion (archiver, désigner la personne de confiance…) valent pour l'admin
      // et pour les gestionnaires de structure, sur les seniors qu'ils voient
      setIsAdmin(isAdminUser || gestion.length > 0)

      let seniorData
      if (isAdminUser) {
        // Admin — charge tous les seniors
        const { data } = await supabase.from('seniors').select('*').order('name')
        seniorData = data
      } else {
        // Proche (une ligne famille par senior) et/ou gestionnaire (seniors de sa structure)
        const idsFamille = famille.filter(f => !f.archived_at).map(f => f.senior_id).filter(Boolean)
        const structureIds = gestion.map(g => g.structure_id)
        const [parFamille, parStructure] = await Promise.all([
          idsFamille.length ? supabase.from('seniors').select('*').in('id', idsFamille) : { data: [] },
          structureIds.length ? supabase.from('seniors').select('*').in('structure_id', structureIds) : { data: [] },
        ])
        seniorData = [...new Map([...(parFamille.data || []), ...(parStructure.data || [])].map(x => [x.id, x])).values()]
          .sort((x, y) => x.name.localeCompare(y.name))
      }

      const enrichis = (seniorData || []).map(enrichirSenior)
      setSeniors(enrichis)
      if (!enrichis.length) { setLoading(false); return }

      // Dossier actif mémorisé, sinon le premier
      const ids = enrichis.map(x => x.id)
      const saved = [...famille, ...gestion].map(l => l.selected_senior_id).find(id => ids.includes(id))
      setSelectedSeniorId(saved || ids[0])

      setLoading(false)
    }
    loadData()
  }, [])

  async function switchSenior(seniorId) {
    setSelectedSeniorId(seniorId)
    const { data: { user } } = await supabase.auth.getUser()
    // Mémoriser le dossier actif (lignes famille et fiche gestionnaire)
    await Promise.all([
      supabase.from('famille').update({ selected_senior_id: seniorId }).eq('user_id', user.id),
      supabase.from('structure_membres').update({ selected_senior_id: seniorId }).eq('user_id', user.id),
    ])
  }

  const selectedSenior = seniors.find(s => s.id === selectedSeniorId)

  return { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin, loading }
}
