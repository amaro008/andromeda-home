import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { addDays, addWeeks, addMonths, addYears } from 'date-fns'

function sb() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function calcNextDate(freq: string, freqDays: number | null, from: Date): Date {
  switch (freq) {
    case 'weekly':     return addWeeks(from, 1)
    case 'monthly':    return addMonths(from, 1)
    case 'bimonthly':  return addMonths(from, 2)
    case 'quarterly':  return addMonths(from, 3)
    case 'semiannual': return addMonths(from, 6)
    case 'annual':     return addYears(from, 1)
    case 'custom':     return addDays(from, freqDays ?? 30)
    default:           return from
  }
}

export async function POST(request: NextRequest) {
  try {
    const { task_id, user_id, actual_cost, notes } = await request.json()
    if (!task_id || !user_id) return NextResponse.json({ error: 'task_id y user_id requeridos' }, { status: 400 })

    const { data: task, error: taskErr } = await sb()
      .from('andromeda_tasks').select('*').eq('id', task_id).single()
    if (taskErr || !task) throw new Error('Tarea no encontrada')

    // Save history
    await sb().from('andromeda_task_history').insert({
      task_id, user_id,
      completed_date: new Date().toISOString().split('T')[0],
      actual_cost: actual_cost ?? null,
      notes: notes ?? null,
    })

    // Update provider services count
    if (task.provider_id) {
      const { data: prov } = await sb().from('andromeda_providers').select('services_count').eq('id', task.provider_id).single()
      if (prov) await sb().from('andromeda_providers').update({ services_count: (prov.services_count ?? 0) + 1 }).eq('id', task.provider_id)
    }

    // Calculate next date proposal
    let nextDate = null
    if (task.frequency !== 'once') {
      nextDate = calcNextDate(task.frequency, task.frequency_days, new Date()).toISOString().split('T')[0]
    }

    // Mark as done (don't auto-schedule — user confirms)
    await sb().from('andromeda_tasks').update({ status: 'done' }).eq('id', task_id)

    return NextResponse.json({ ok: true, nextDate, task })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
