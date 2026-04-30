import { NextResponse } from 'next/server'

export async function POST() {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Record maxLength="30" transcribe="true" transcribeCallback="/api/twilio-transcription"/>
</Response>`
  return new NextResponse(twiml, {
    headers: { 'Content-Type': 'text/xml' }
  })
}