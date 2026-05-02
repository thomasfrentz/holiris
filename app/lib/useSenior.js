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
        .limit(1)

      const famille = familleData?.[0]
      if (!famille) { setLoading(false); return }

      setIsAdmin(famille.is_admin === true)

      if (famille.is_admin) {
        const { data: allSeniors } = await supabase
          .from('seniors')
          .select('*')
          .order('name')
        const enrichis = (allSeniors || []).map(enrichirSenior)
        setSeniors(enrichis)
        setSelectedSeniorId(famille.selected_senior_id || enrichis?.[0]?.id)
      } else {
        const { data: seniorData } = await supabase
          .from('seniors')
          .select('*')
          .eq('id', famille.senior_id)
        const enrichis = (seniorData || []).map(enrichirSenior)
        setSeniors(enrichis)
        setSelectedSeniorId(famille.senior_id)
      }

      setLoading(false)
    }
    loadData()
  }, [])

  async function switchSenior(seniorId) {
    setSelectedSeniorId(seniorId)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('famille')
      .update({ selected_senior_id: seniorId })
      .eq('user_id', user.id)
  }

  const selectedSenior = seniors.find(s => s.id === selectedSeniorId)

  return { seniors, selectedSenior, selectedSeniorId, switchSenior, isAdmin, loading }
}
