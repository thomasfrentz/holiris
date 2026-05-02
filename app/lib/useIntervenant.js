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

export function useIntervenant() {
  const [intervenants, setIntervenants] = useState([])
  const [selectedSeniorId, setSelectedSeniorId] = useState(null)
  const [selectedSenior, setSelectedSenior] = useState(null)
  const [isIntervenant, setIsIntervenant] = useState(false)
  const [intervenantName, setIntervenantName] = useState('')
  const [loading, setLoading] = useState(true)

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )

  useEffect(() => {
    async function loadData() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }

      const { data: intervenantsData, error } = await supabase
        .from('intervenants')
        .select('*, seniors!intervenants_senior_id_fkey(*)')
        .eq('user_id', user.id)

      if (error || !intervenantsData?.length) { setLoading(false); return }

      const seniorIds = intervenantsData.map(i => i.senior_id)

      setIsIntervenant(true)
      setIntervenants(intervenantsData)
      setIntervenantName(intervenantsData[0].name)

      const saved = intervenantsData[0].selected_senior_id
      const activeSeniorId = seniorIds.includes(saved) ? saved : seniorIds[0]

      setSelectedSeniorId(activeSeniorId)

      const seniorRaw = intervenantsData.find(i => i.senior_id === activeSeniorId)?.seniors ?? null
      setSelectedSenior(enrichirSenior(seniorRaw))

      setLoading(false)
    }
    loadData()
  }, [])

  async function switchSenior(seniorId) {
    setSelectedSeniorId(seniorId)
    const seniorRaw = intervenants.find(i => i.senior_id === seniorId)?.seniors ?? null
    setSelectedSenior(enrichirSenior(seniorRaw))

    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('intervenants')
      .update({ selected_senior_id: seniorId })
      .eq('user_id', user.id)
  }

  const seniorsList = intervenants.map(i => enrichirSenior(i.seniors)).filter(Boolean)

  return { seniorsList, selectedSenior, selectedSeniorId, switchSenior, isIntervenant, intervenantName, loading }
}
