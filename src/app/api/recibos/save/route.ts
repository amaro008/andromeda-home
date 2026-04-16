import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  // Verificar sesión por cookie directamente
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  if (!hasSession) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Para el insert necesitamos el user_id — usar supabase con la cookie
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()
  const userId = session?.user?.id

  if (!userId) {
    return NextResponse.json({ error: 'No se pudo obtener usuario' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const { error } = await supabase
      .schema('andromeda')
      .from('receipts')
      .insert({
        user_id:          userId,
        service_type:     body.service_type,
        provider:         body.provider ?? null,
        issue_date:       body.issue_date ?? null,
        period_start:     body.period_start ?? null,
        period_end:       body.period_end ?? null,
        consumption:      body.consumption ?? null,
        consumption_unit: body.consumption_unit ?? null,
        amount:           body.amount,
        currency:         body.currency ?? 'MXN',
        raw_text:         body.raw_text ?? null,
        ai_confidence:    body.ai_confidence ?? null,
      })

    if (error) throw error
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('Save receipt error:', err)
    return NextResponse.json({ error: err.message ?? 'Error al guardar' }, { status: 500 })
  }
}
