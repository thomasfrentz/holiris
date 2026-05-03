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

      const { data: familleData } = await supabase
        .from('famille')
        .select('*')
        .eq('user_id', user.id)

      if (!familleData?.length) { setLoading(false); return }

      // Vérifier si admin
      const isAdminUser = familleData.some(f => f.is_admin === true)
      setIsAdmin(isAdminUser)

      if (isAdminUser) {
        // Admin — charge tous les seniors
        const { data: allSeniors } = await supabase
          .from('seniors')
          .select('*')
          .order('name')
        const enrichis = (allSeniors || []).map(enrichirSenior)
        setSeniors(enrichis)
        const saved = familleData[0].selected_senior_id
        setSelectedSeniorId(saved || enrichis?.[0]?.id)
      } else {
        // Proche — charge tous les seniors liés à cet utilisateur
        const seniorIds = familleData.map(f => f.senior_id).filter(Boolean)

        if (!seniorIds.length) { setLoading(false); return }

        const { data: seniorData } = await supabase
          .from('seniors')
          .select('*')
          .in('id', seniorIds)
          .order('name')

        const enrichis = (seniorData || []).map(enrichirSenior)
        setSeniors(enrichis)

        // Utiliser selected_senior_id si disponible, sinon le premier
        const saved = familleData[0].selected_senior_id
        const activeId = seniorIds.includes(saved) ? saved : seniorIds[0]
        setSelectedSeniorId(activeId)
      }

      setLoading(false)
    }
    loadData()
  }, [])

  async function switchSenior(seniorId) {
    setSelectedSeniorId(seniorId)
    const { data: { user } } = await supabase.auth.getUser()
    // Mettre à jour toutes les entrées famille de cet utilisateur
    await supabase
      .from('famille')
      .update({ selected_senior_id: seniorId })
      .eq('user_id', user.id)
  }

  const selectedSenior = seniors.find(s => s.id === selectedSeniorId)

  return { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin, loading }
}
