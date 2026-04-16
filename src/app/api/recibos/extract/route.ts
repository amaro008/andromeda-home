import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Eres un experto en leer recibos de servicios del hogar en México: CFE (luz), SADM/Agua y Drenaje (agua), Naturgy/Gas Natural (gas).
Analiza el documento y extrae TODOS los datos disponibles.
Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional.`

const USER_PROMPT = `Extrae todos los datos del recibo en este JSON exacto:

{
  "service_type": "luz" | "agua" | "gas",
  "provider": "nombre exacto del proveedor (CFE, SADM, Naturgy Mexico, etc)",
  "account_number": "número de cuenta o null",
  "service_number": "número de servicio/NIS o null",
  "nis": "NIS si es recibo de agua (ej: 7001573-67) o null",
  "nir": "NIR si es recibo de agua o null",
  "meter_number": "número de medidor o null",
  "tariff": "tarifa (ej: 1C, G1 Doméstico, Doméstica-Cat.2) o null",
  "invoice_folio": "folio de la factura o null",
  "uuid_cfdi": "UUID del CFDI fiscal o null",
  "address": "dirección del suministro o null",
  "issue_date": "YYYY-MM-DD fecha de emisión o null",
  "due_date": "YYYY-MM-DD fecha límite de pago o null",
  "period_start": "YYYY-MM-DD inicio del periodo o null",
  "period_end": "YYYY-MM-DD fin del periodo o null",
  "consumption": número total kWh/m3 como número o null,
  "consumption_unit": "kWh" | "m3" | "L" | null,
  "consumption_basic": número kWh bloque básico (solo CFE) o null,
  "consumption_intermediate": número kWh bloque intermedio (solo CFE) o null,
  "consumption_excess": número kWh bloque excedente (solo CFE) o null,
  "subtotal": número subtotal antes de IVA o null,
  "tax_amount": número IVA o null,
  "government_subsidy": número apoyo gubernamental (solo CFE) o null,
  "previous_balance": número adeudo anterior o null,
  "amount": número TOTAL A PAGAR (nunca null, siempre número),
  "currency": "MXN",
  "ai_confidence": número entre 0 y 1,
  "raw_text": "resumen: proveedor, periodo, consumo, total"
}

Reglas por proveedor:
- CFE → service_type: "luz". period_start/end de "PERIODO FACTURADO". due_date de "LÍMITE DE PAGO". consumption = básico+intermedio+excedente.
- SADM/Agua y Drenaje → service_type: "agua". period_start de "PERIODO DE CONSUMO" primera fecha. nis y nir del campo correspondiente.
- Naturgy/Gas Natural → service_type: "gas". account_number de "Cuenta". due_date de "LIMITE DE PAGO". consumption en m3.
- amount = siempre el TOTAL A PAGAR final, nunca el subtotal ni adeudo anterior.`

export async function POST(request: NextRequest) {
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  if (!hasSession) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const apiKey = process.env.GEMINI_KEY
  if (!apiKey) return NextResponse.json({ error: 'GEMINI_KEY no configurada' }, { status: 500 })

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const model = 'gemini-2.5-flash'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    console.log(`[andromeda] extrayendo con ${model}, tipo: ${mimeType}, tamaño: ${bytes.byteLength}`)

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
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 }
      }
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

    const data = await res.json()

    if (!res.ok) {
      const msg = data?.error?.message ?? JSON.stringify(data).substring(0, 300)
      console.error(`[andromeda] Gemini ${res.status}:`, msg)
      throw new Error(msg)
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    if (!['luz', 'agua', 'gas'].includes(extracted.service_type)) throw new Error('Servicio no reconocido')
    if (typeof extracted.amount !== 'number') throw new Error('Importe no encontrado')

    console.log(`[andromeda] OK: ${extracted.service_type} $${extracted.amount} conf:${extracted.ai_confidence}`)
    return NextResponse.json(extracted)
  } catch (err: any) {
    console.error('[andromeda] extract error:', err.message)
    return NextResponse.json({ error: err.message ?? 'Error al procesar' }, { status: 500 })
  }
}
