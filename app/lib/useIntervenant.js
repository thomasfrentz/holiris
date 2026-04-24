import { useState, useEffect } from 'react'
import { createBrowserClient } from '@supabase/ssr'

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
      console.log('User:', user?.id)
      if (!user) { setLoading(false); return }

      const { data: intervenantsData, error } = await supabase
        .from('intervenants')
        .select('*, seniors(*)')
        .eq('user_id', user.id)

      console.log('Intervenants:', intervenantsData)
      console.log('Error:', error)

      if (!intervenantsData?.length) { setLoading(false); return }

      setIsIntervenant(true)
      setIntervenants(intervenantsData)
      setIntervenantName(intervenantsData[0].name)

      const saved = intervenantsData[0].selected_senior_id
      const firstSeniorId = intervenantsData[0].senior_id
      const activeSeniorId = saved || firstSeniorId

      setSelectedSeniorId(activeSeniorId)
      const activeSenior = intervenantsData.find(i => i.senior_id === activeSeniorId)?.seniors
      setSelectedSenior(activeSenior)

      setLoading(false)
    }
    loadData()
  }, [])

  async function switchSenior(seniorId) {
    setSelectedSeniorId(seniorId)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase
      .from('intervenants')
      .update({ selected_senior_id: seniorId })
      .eq('user_id', user.id)
    window.location.reload()
  }

  const seniorsList = intervenants.map(i => i.seniors).filter(Boolean)

  return { seniorsList, selectedSenior, selectedSeniorId, switchSenior, isIntervenant, intervenantName, loading }
}
