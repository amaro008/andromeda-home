import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  try {
    const body = await request.json()

    const { error } = await supabase
      .schema('andromeda')
      .from('receipts')
      .insert({
        user_id:          user.id,
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
    console.error('Error saving receipt:', err)
    return NextResponse.json(
      { error: err.message ?? 'Error al guardar' },
      { status: 500 }
    )
  }
}
