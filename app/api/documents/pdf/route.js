import { supabaseAdmin, utilisateurCourant } from '@/lib/serveur'
import { peutGererDocuments } from '@/lib/documents'
import { genererPdf } from '@/lib/documentPdf'

// Téléchargement du PDF d'un document signé (proches du dossier, structure, admin)
export async function GET(request) {
  const user = await utilisateurCourant()
  if (!user) return new Response('Non authentifié', { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  const { data: doc } = await supabaseAdmin.from('documents_signes').select('*').eq('id', id).eq('statut', 'signe').maybeSingle()
  if (!doc || !await peutGererDocuments(user.id, doc.senior_id)) return new Response('Document introuvable', { status: 404 })
  const pdf = await genererPdf(doc)
  const nom = `${doc.contenu.titre} - ${doc.contenu.senior}.pdf`.replace(/[\\/:*?"<>|’]/g, '')
  return new Response(pdf, { headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nom)}` } })
}
