import { createBrowserClient } from '@supabase/ssr'

// Visio entre la borne et un proche : connexion directe (WebRTC), mise en relation par un canal
// temps réel Supabase dont le nom n'est connu que de la borne et du proche.
// La borne envoie caméra + micro ; le proche envoie son micro seulement.
//
// role : 'borne' | 'proche'
export function demarrerVisio({ role, canal, iceServers, fluxLocal, surFluxDistant, surEtat }) {
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  const channel = supabase.channel('visio-' + canal, { config: { broadcast: { self: false } } })
  let pc = null
  let termine = false
  let relance = null
  const candidatsEnAttente = []

  const envoyer = (type, data = null) => channel.send({ type: 'broadcast', event: 'signal', payload: { de: role, type, data } })

  function creerConnexion() {
    pc = new RTCPeerConnection({ iceServers })
    fluxLocal?.getTracks().forEach(t => pc.addTrack(t, fluxLocal))
    pc.onicecandidate = e => { if (e.candidate) envoyer('ice', e.candidate.toJSON()) }
    pc.ontrack = e => surFluxDistant?.(e.streams[0])
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') surEtat?.('en-direct')
      if (pc.connectionState === 'failed') surEtat?.('echec')
      if (pc.connectionState === 'disconnected') surEtat?.('coupure')
    }
  }

  async function ajouterCandidats() {
    while (candidatsEnAttente.length) await pc.addIceCandidate(candidatsEnAttente.shift()).catch(() => {})
  }

  channel.on('broadcast', { event: 'signal' }, async ({ payload }) => {
    if (termine || payload.de === role) return
    try {
      if (payload.type === 'fin') { arreter(false); surEtat?.('termine'); return }

      // Le proche signale qu'il est prêt : la borne propose la connexion
      if (payload.type === 'pret' && role === 'borne' && !pc) {
        creerConnexion()
        await pc.setLocalDescription(await pc.createOffer())
        envoyer('offre', pc.localDescription.toJSON())
      }
      if (payload.type === 'offre' && role === 'proche' && !pc) {
        clearInterval(relance)
        creerConnexion()
        await pc.setRemoteDescription(payload.data)
        await ajouterCandidats()
        await pc.setLocalDescription(await pc.createAnswer())
        envoyer('reponse', pc.localDescription.toJSON())
      }
      if (payload.type === 'reponse' && role === 'borne' && pc && !pc.remoteDescription) {
        await pc.setRemoteDescription(payload.data)
        await ajouterCandidats()
      }
      if (payload.type === 'ice') {
        if (pc?.remoteDescription) await pc.addIceCandidate(payload.data).catch(() => {})
        else candidatsEnAttente.push(payload.data)
      }
    } catch (error) {
      console.error('Visio:', error)
      surEtat?.('echec')
    }
  })

  channel.subscribe(statut => {
    if (statut !== 'SUBSCRIBED') return
    surEtat?.('connexion')
    // Le proche se signale jusqu'à ce que la borne (qui vérifie toutes les quelques secondes) réponde
    if (role === 'proche') {
      envoyer('pret')
      relance = setInterval(() => envoyer('pret'), 2000)
    }
  })

  function arreter(prevenir = true) {
    if (termine) return
    termine = true
    clearInterval(relance)
    if (prevenir) envoyer('fin')
    pc?.close()
    fluxLocal?.getTracks().forEach(t => t.stop())
    setTimeout(() => supabase.removeChannel(channel), 500)
  }

  return { arreter }
}
