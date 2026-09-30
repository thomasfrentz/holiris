'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createBrowserClient } from '@supabase/ssr'
import Layout from './Layout'

// Affiché par les pages d'un dossier quand le compte n'a encore aucun senior
// (au lieu d'un chargement sans fin). Un gestionnaire est guidé vers « Ma structure ».
export default function AucunDossier({ isAdmin }) {
  const [gestionnaire, setGestionnaire] = useState(null) // null = en cours, true / false

  useEffect(() => {
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
    async function verifier() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setGestionnaire(false); return }
      const { data } = await supabase.from('structure_membres').select('id').eq('user_id', user.id).limit(1)
      setGestionnaire(!!data?.length)
    }
    verifier()
  }, [])

  return (
    <Layout isAdmin={isAdmin}>
      {gestionnaire !== null && (
        <div style={{ maxWidth: 480, margin: '10vh auto 0', textAlign: 'center', background: '#fff', border: '1px solid #E8EFEB', borderRadius: 16, padding: '40px 32px' }}>
          <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 28, fontWeight: 500, color: '#1F2A24', marginBottom: 12 }}>
            {gestionnaire ? 'Aucun client pour l\'instant' : 'Aucun dossier pour l\'instant'}
          </div>
          <p style={{ fontSize: 14, color: '#6F7C75', lineHeight: 1.7, marginBottom: 24 }}>
            {gestionnaire
              ? 'Créez le dossier de votre premier client : son carnet, son agenda et son équipe apparaîtront ici.'
              : 'Aucun dossier n\'est encore rattaché à votre compte. Si vous avez été invité(e), utilisez le lien reçu par email.'}
          </p>
          {gestionnaire && (
            <Link href="/structure" style={{ display: 'inline-block', background: '#7FAF9B', color: '#fff', textDecoration: 'none', borderRadius: 8, padding: '12px 24px', fontSize: 14, fontWeight: 500 }}>
              Créer un premier client →
            </Link>
          )}
        </div>
      )}
    </Layout>
  )
}
