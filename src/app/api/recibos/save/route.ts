import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  if (!hasSession) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  // Obtener user_id — intentar desde cookie primero, luego SDK
  let userId: string | null = null
  const authCookie = allCookies.find(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )
  if (authCookie) {
    try {
      // La cookie puede ser base64 o JSON directo
      let val = authCookie.value
      try { val = Buffer.from(val, 'base64').toString() } catch {}
      const parsed = JSON.parse(val)
      userId = parsed?.user?.id ?? parsed?.sub ?? null
    } catch {}
  }

  if (!userId) {
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      userId = session?.user?.id ?? null
    } catch (e) {
      console.error('[andromeda] getSession error:', e)
    }
  }

  console.log('[andromeda] save userId:', userId ? 'found' : 'not found')

  if (!userId) {
    // Último intento: usar service role si está disponible
    return NextResponse.json({ error: 'No se pudo obtener usuario — intenta cerrar sesión y volver a entrar' }, { status: 401 })
  }

  try {
    const supabase = createClient()
    const body = await request.json()

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

    if (error) {
      console.error('[andromeda] insert error:', error)
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[andromeda] save error:', err.message)
    return NextResponse.json({ error: err.message ?? 'Error al guardar' }, { status: 500 })
  }
}
