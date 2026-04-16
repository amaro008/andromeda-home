import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Eres un asistente especializado en leer recibos de servicios del hogar en México.
Analiza la imagen del recibo y extrae los datos.
Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional.`

const USER_PROMPT = `Extrae los datos del recibo en este JSON exacto:

{
  "service_type": "luz" o "agua" o "gas",
  "provider": "nombre del proveedor (CFE, CAEM, Naturgy, etc)",
  "issue_date": "YYYY-MM-DD o null",
  "period_start": "YYYY-MM-DD o null",
  "period_end": "YYYY-MM-DD o null",
  "consumption": numero o null,
  "consumption_unit": "kWh" o "m3" o "L" o null,
  "amount": numero total a pagar sin simbolo $,
  "currency": "MXN",
  "ai_confidence": numero entre 0 y 1,
  "raw_text": "datos clave del recibo"
}

Reglas: CFE=luz, CAEM/SACMEX/Aguakan=agua, Gas Natural/Naturgy/Sempra=gas. amount nunca null.`

export async function POST(request: NextRequest) {
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  if (!hasSession) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_KEY no configurada en Vercel' }, { status: 500 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

    const body = {
      contents: [{
        role: 'user',
        parts: [
          { text: USER_PROMPT },
          { inlineData: { mimeType, data: base64 } }
        ]
      }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 1024,
        thinkingConfig: { thinkingBudget: 0 }
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error?.message ?? 'Gemini error')
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
