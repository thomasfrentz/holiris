import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { whatsapp, prenom, seniorName } = await request.json()

    if (!whatsapp) return NextResponse.json({ success: false, error: 'Pas de numéro WhatsApp' })

    const phoneNumber = whatsapp.replace('+', '')

    const message = 'Bonjour ' + prenom + ' 👋\n\nBienvenue sur *Holiris* ! Vous êtes maintenant connecté(e) au suivi de ' + seniorName + '.\n\n*💡 Vous pouvez nous envoyer des messages directement sur ce numéro WhatsApp :*\n• Des observations sur l\'état général de votre proche\n• Des notes après une visite\n• Des informations sur son humeur, son appétit, ses activités\n\n*❌ Merci de ne pas partager :*\n• Les diagnostics médicaux\n• Les résultats d\'examens\n• Les prescriptions et ordonnances\n• Toute donnée médicale confidentielle\n\nCes informations restent du ressort exclusif des médecins.\n\nVous recevrez également les alertes importantes concernant ' + seniorName + ' directement ici.\n\nBienvenue dans la famille Holiris 🌸'

    const response = await fetch(
      'https://graph.facebook.com/v18.0/' + process.env.META_PHONE_NUMBER_ID + '/messages',
      {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.META_WHATSAPP_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phoneNumber,
          type: 'text',
          text: { body: message }
        })
      }
    )

    const data = await response.json()
    console.log('Invitation famille envoyée:', JSON.stringify(data))

    if (response.ok) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: data })
    }

  } catch (error) {
    console.error('Erreur invitation famille:', error.message)
    return NextResponse.json({ success: false, error: error.message })
  }
}
