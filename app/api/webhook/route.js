import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const formData = await request.formData()
    
    const from = formData.get('From')
    const body = formData.get('Body')
    const numMedia = formData.get('NumMedia')
    const mediaUrl = formData.get('MediaUrl0')
    const mediaType = formData.get('MediaContentType0')

    console.log('Message reçu de:', from)
    console.log('Contenu:', body)
    console.log('Média:', numMedia, mediaType, mediaUrl)

    // Réponse WhatsApp
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>✅ Message reçu par Holiris. Merci !</Message>
</Response>`

    return new NextResponse(twiml, {
      headers: { 'Content-Type': 'text/xml' }
    })

  } catch (error) {
    console.error('Erreur webhook:', error)
    return NextResponse.json({ error: 'Erreur' }, { status: 500 })
  }
}