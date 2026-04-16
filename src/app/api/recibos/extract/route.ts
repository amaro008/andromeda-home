import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACT_PROMPT = `Eres un asistente especializado en leer recibos de servicios del hogar en México.
Analiza la imagen o texto del recibo y extrae los siguientes datos.

Responde ÚNICAMENTE con un objeto JSON válido, sin markdown ni explicaciones adicionales:

{
  "service_type": "luz" | "agua" | "gas",
  "provider": "nombre del proveedor (ej: CFE, CAEM, Naturgy)",
  "issue_date": "YYYY-MM-DD o null",
  "period_start": "YYYY-MM-DD o null",
  "period_end": "YYYY-MM-DD o null",
  "consumption": número o null,
  "consumption_unit": "kWh" | "m3" | "L" | null,
  "amount": número (importe total a pagar, sin símbolo $),
  "currency": "MXN",
  "ai_confidence": número entre 0 y 1 indicando tu confianza en la extracción,
  "raw_text": "texto relevante que encontraste en el recibo"
}

Si no puedes identificar el importe total con certeza, pon 0 en amount y baja la confianza.
Para el servicio: CFE = luz, CAEM/SACMEX/agua = agua, Gas Natural/Naturgy/Sempra = gas.`

export async function POST(request: NextRequest) {
  // Verificar sesión
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const base64 = Buffer.from(bytes).toString('base64')
    const isPdf = file.type === 'application/pdf'

    let messageContent: Anthropic.MessageParam['content']

    if (isPdf) {
      // PDF: enviar como documento
      messageContent = [
        {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        } as any,
        { type: 'text', text: EXTRACT_PROMPT },
      ]
    } else {
      // Imagen
      const mediaType = (file.type as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif') || 'image/jpeg'
      messageContent = [
        {
          type: 'image',
          source: { type: 'base64', media_type: mediaType, data: base64 },
        },
        { type: 'text', text: EXTRACT_PROMPT },
      ]
    }

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: messageContent }],
    })

    const text = response.content.find(b => b.type === 'text')?.text ?? ''

    // Limpiar y parsear JSON
    const clean = text.replace(/```json|```/g, '').trim()
    const extracted = JSON.parse(clean)

    // Validaciones básicas
    if (!['luz', 'agua', 'gas'].includes(extracted.service_type)) {
      throw new Error('Tipo de servicio no reconocido')
    }
    if (typeof extracted.amount !== 'number') {
      throw new Error('Importe no encontrado')
    }

    return NextResponse.json(extracted)
  } catch (err: any) {
    console.error('Error extracting receipt:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error al procesar el recibo' },
      { status: 500 }
    )
  }
}
