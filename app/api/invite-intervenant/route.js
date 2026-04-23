import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { whatsapp, prenom, nom, role, seniorName } = await request.json()

    const phoneNumber = whatsapp.replace('+', '')

    const message = 'Bonjour ' + prenom + ' 👋\n\nLa famille de ' + seniorName + ' vous invite à utiliser *Holiris*, une plateforme de coordination familiale pour le suivi du bien-être des personnes âgées.\n\n*Comment ça fonctionne :*\nAprès chaque passage, envoyez-nous simplement un message vocal ou texte sur ce numéro WhatsApp. Notre assistant IA le transformera automatiquement en note de suivi visible par la famille. Un message de 20 secondes suffit 🎤\n\n*✅ Vous pouvez partager :*\n• L\'état général et le moral\n• Les activités effectuées\n• Les observations du quotidien\n• Les besoins identifiés\n\n*❌ Merci de ne pas partager :*\n• Les diagnostics médicaux\n• Les résultats d\'examens\n• Les prescriptions et ordonnances\n• Toute donnée médicale confidentielle\n\nCes informations restent du ressort exclusif des médecins.\n\nMerci pour votre accompagnement 🌸\n*L\'équipe Holiris*'

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
    console.log('Invitation envoyée:', JSON.stringify(data))

    if (response.ok) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json({ success: false, error: data })
    }

  } catch (error) {
    console.error('Erreur invitation:', error.message)
    return NextResponse.json({ success: false, error: error.message })
  }
}
