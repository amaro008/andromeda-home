import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export async function POST(request: NextRequest) {
  // Crear cliente de Supabase pasando las cookies del request directamente
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll() {
          // No necesitamos setear cookies en esta ruta
        },
      },
    }
  )

  const { data: { user }, error: userError } = await supabase.auth.getUser()

  console.log('[save] user:', user?.id ?? 'null', 'error:', userError?.message ?? 'none')
  console.log('[save] cookies:', request.cookies.getAll().map(c => c.name).join(', '))

  if (!user) {
    return NextResponse.json(
      { error: `No autorizado: ${userError?.message ?? 'sin sesión'}` },
      { status: 401 }
    )
  }

  try {
    const body = await request.json()

    const { error } = await supabase
      .schema('andromeda')
      .from('receipts')
      .insert({
        user_id:                  user.id,
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

    if (error) {
      console.error('[save] insert error:', error)
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[save] error:', err.message)
    return NextResponse.json({ error: err.message ?? 'Error al guardar' }, { status: 500 })
  }
}
