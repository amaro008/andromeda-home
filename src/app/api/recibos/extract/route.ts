import { NextRequest, NextResponse } from 'next/server'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent'

const EXTRACT_PROMPT = `Eres un asistente especializado en leer recibos de servicios del hogar en México.
Analiza la imagen del recibo y extrae los datos.

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional:

{
  "service_type": "luz" o "agua" o "gas",
  "provider": "nombre del proveedor (ej: CFE, CAEM, Naturgy, Gas Natural)",
  "issue_date": "YYYY-MM-DD o null",
  "period_start": "YYYY-MM-DD o null",
  "period_end": "YYYY-MM-DD o null",
  "consumption": numero o null,
  "consumption_unit": "kWh" o "m3" o "L" o null,
  "amount": numero sin simbolo de pesos,
  "currency": "MXN",
  "ai_confidence": numero entre 0 y 1,
  "raw_text": "datos clave encontrados en el recibo"
}

Reglas:
- CFE = luz, CAEM/SACMEX/Aguakan = agua, Gas Natural/Naturgy/Sempra = gas
- amount es el total a pagar, nunca null
- Si no puedes leer bien el recibo baja ai_confidence a menos de 0.5`

export async function POST(request: NextRequest) {
  // Verificar sesión por cookie directamente — mismo patrón que el middleware
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  if (!hasSession) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY no configurada' }, { status: 500 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const body = {
      contents: [{
        parts: [
          { text: EXTRACT_PROMPT },
          { inline_data: { mime_type: mimeType, data: base64 } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
    }

    const res = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Gemini error: ${err}`)
    }

    const data = await res.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    if (!['luz', 'agua', 'gas'].includes(extracted.service_type)) throw new Error('Servicio no reconocido')
    if (typeof extracted.amount !== 'number') throw new Error('Importe no encontrado')

    return NextResponse.json(extracted)
  } catch (err: any) {
    console.error('Gemini extract error:', err)
    return NextResponse.json({ error: err.message ?? 'Error al procesar' }, { status: 500 })
  }
}
