import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // user_id viene del cliente (ya autenticado via Supabase en el browser)
    const userId = body.user_id
    if (!userId) {
      return NextResponse.json({ error: 'user_id requerido' }, { status: 400 })
    }

    // Service role key — puede insertar sin restricciones de RLS
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) {
      // Fallback: usar anon key con RLS (requiere que user_id sea válido)
      return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada' }, { status: 500 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { error } = await supabase
      .schema('andromeda')
      .from('receipts')
      .insert({
        user_id:                  userId,
        service_type:             body.service_type,
        provider:                 body.provider ?? null,
        issue_date:               body.issue_date ?? null,
        period_start:             body.period_start ?? null,
        period_end:               body.period_end ?? null,
        consumption:              body.consumption ?? null,
        consumption_unit:         body.consumption_unit ?? null,
        amount:                   body.amount,
        currency:                 body.currency ?? 'MXN',
        raw_text:                 body.raw_text ?? null,
        ai_confidence:            body.ai_confidence ?? null,
        account_number:           body.account_number ?? null,
        service_number:           body.service_number ?? null,
        nis:                      body.nis ?? null,
        nir:                      body.nir ?? null,
        meter_number:             body.meter_number ?? null,
        tariff:                   body.tariff ?? null,
        invoice_folio:            body.invoice_folio ?? null,
        uuid_cfdi:                body.uuid_cfdi ?? null,
        due_date:                 body.due_date ?? null,
        subtotal:                 body.subtotal ?? null,
        tax_amount:               body.tax_amount ?? null,
        government_subsidy:       body.government_subsidy ?? null,
        previous_balance:         body.previous_balance ?? null,
        consumption_basic:        body.consumption_basic ?? null,
        consumption_intermediate: body.consumption_intermediate ?? null,
        consumption_excess:       body.consumption_excess ?? null,
        address:                  body.address ?? null,
      })

    if (error) throw error

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[save] error:', err.message)
    return NextResponse.json({ error: err.message ?? 'Error al guardar' }, { status: 500 })
  }
}
