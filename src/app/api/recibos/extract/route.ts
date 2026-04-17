import { NextRequest, NextResponse } from 'next/server'

const SYSTEM_PROMPT = `Eres un experto en leer recibos de servicios del hogar en México: CFE (luz), SADM/Agua y Drenaje (agua), Naturgy/Gas Natural (gas).
Analiza el documento y extrae TODOS los datos disponibles.
Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni texto adicional.`

const USER_PROMPT = `Extrae todos los datos del recibo en este JSON exacto:

{
  "service_type": "luz" | "agua" | "gas",
  "provider": "nombre exacto del proveedor",
  "account_number": "número de cuenta o null",
  "service_number": "número de servicio o null",
  "nis": "NIS si es agua (ej: 7001573-67) o null",
  "nir": "NIR si es agua o null",
  "meter_number": "número de medidor o null",
  "tariff": "tarifa aplicada o null",
  "invoice_folio": "folio de factura o null",
  "uuid_cfdi": "UUID del CFDI o null",
  "address": "dirección del suministro o null",
  "issue_date": "YYYY-MM-DD fecha de emisión o null",
  "due_date": "YYYY-MM-DD fecha límite de pago o null",
  "period_start": "YYYY-MM-DD inicio del periodo o null",
  "period_end": "YYYY-MM-DD fin del periodo o null",
  "consumption": número total kWh/m3 o null,
  "consumption_unit": "kWh" | "m3" | "L" | null,
  "consumption_basic": número kWh básico (CFE) o null,
  "consumption_intermediate": número kWh intermedio (CFE) o null,
  "consumption_excess": número kWh excedente (CFE) o null,
  "subtotal": número subtotal antes de IVA o null,
  "tax_amount": número IVA o null,
  "government_subsidy": número apoyo gubernamental (CFE) o null,
  "amount": número TOTAL DEL MES — solo el cargo del periodo actual SIN adeudos anteriores,
  "previous_balance": número adeudo de periodos anteriores o 0 si no hay,
  "total_with_balance": número TOTAL A PAGAR incluyendo adeudo anterior,
  "currency": "MXN",
  "ai_confidence": número entre 0 y 1,
  "raw_text": "resumen: proveedor, periodo, consumo, total del mes"
}

REGLA CRÍTICA para amount vs total_with_balance:
- "amount" = TOTAL DEL MES (cargo solo del periodo facturado, sin adeudos)
- "previous_balance" = adeudo de meses anteriores (si no hay, poner 0)
- "total_with_balance" = TOTAL A PAGAR (amount + previous_balance)
- Ejemplo: recibo con Total del mes $79 + Adeudo $76 = Total a pagar $155
  → amount=79, previous_balance=76, total_with_balance=155

Reglas por proveedor:
- CFE → service_type: "luz". period de "PERIODO FACTURADO". due_date de "LÍMITE DE PAGO".
- SADM → service_type: "agua". En SADM: amount = "TOTAL DEL MES", previous_balance = "ADEUDO" (si hay)
- Naturgy → service_type: "gas". account_number de "Cuenta". consumption en m3.`

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

    const body = {
      contents: [{ role: 'user', parts: [{ text: USER_PROMPT }, { inlineData: { mimeType, data: base64 } }] }],
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      generationConfig: { temperature: 0.1, maxOutputTokens: 2048, thinkingConfig: { thinkingBudget: 0 } }
    }

    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const data = await res.json()

    if (!res.ok) throw new Error(data?.error?.message ?? 'Gemini error')

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const clean = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    if (!['luz', 'agua', 'gas'].includes(extracted.service_type)) throw new Error('Servicio no reconocido')
    if (typeof extracted.amount !== 'number') throw new Error('Importe no encontrado')

    // Asegurar que total_with_balance siempre esté presente
    if (!extracted.total_with_balance) {
      extracted.total_with_balance = extracted.amount + (extracted.previous_balance ?? 0)
    }

    console.log(`[extract] ${extracted.service_type} mes:$${extracted.amount} adeudo:$${extracted.previous_balance ?? 0} total:$${extracted.total_with_balance}`)
    return NextResponse.json(extracted)
  } catch (err: any) {
    console.error('[extract] error:', err.message)
    return NextResponse.json({ error: err.message ?? 'Error al procesar' }, { status: 500 })
  }
}
