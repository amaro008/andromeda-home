'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams, useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

const SVC_LABEL: Record<string, string> = { luz: 'Luz ⚡', agua: 'Agua 💧', gas: 'Gas 🔥' }

function Field({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between items-start py-3 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className="text-sm text-zinc-200 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <h3 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-2">{title}</h3>
      {children}
    </div>
  )
}

export default function ReceiptDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [receipt, setReceipt] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('andromeda_receipts')
        .select('*')
        .eq('id', id)
        .single()
      setReceipt(data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!receipt) return (
    <div className="p-6 text-center">
      <p className="text-zinc-400">Recibo no encontrado</p>
      <Link href="/recibos" className="btn-ghost mt-4 inline-block">← Volver</Link>
    </div>
  )

  const r = receipt

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <button onClick={() => router.back()} className="text-zinc-500 hover:text-zinc-300 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6"/></svg>
        </button>
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            {SVC_LABEL[r.service_type]} — {r.provider}
          </h1>
          <p className="text-zinc-500 text-sm">
            Registrado el {format(new Date(r.created_at), "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
      </div>

      {/* Total destacado */}
      <div className="card bg-andromeda-800/20 border-andromeda-600/30">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Total pagado</p>
            <p className="text-3xl font-semibold text-andromeda-200">
              ${Number(r.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
            </p>
          </div>
          <div className="text-right">
            {r.due_date && <p className="text-xs text-zinc-500">Límite de pago</p>}
            {r.due_date && <p className="text-sm text-zinc-300">{format(new Date(r.due_date), "d MMM yyyy", { locale: es })}</p>}
          </div>
        </div>
      </div>

      {/* Periodo y consumo */}
      <Section title="Consumo">
        <Field label="Periodo" value={r.period_start && r.period_end
          ? `${format(new Date(r.period_start), "d MMM yyyy", { locale: es })} → ${format(new Date(r.period_end), "d MMM yyyy", { locale: es })}`
          : null} />
        <Field label="Consumo total" value={r.consumption ? `${r.consumption} ${r.consumption_unit ?? ''}` : null} />
        {r.service_type === 'luz' && <>
          <Field label="Bloque básico" value={r.consumption_basic ? `${r.consumption_basic} kWh` : null} />
          <Field label="Bloque intermedio" value={r.consumption_intermediate ? `${r.consumption_intermediate} kWh` : null} />
          <Field label="Bloque excedente" value={r.consumption_excess ? `${r.consumption_excess} kWh` : null} />
          <Field label="Apoyo gubernamental" value={r.government_subsidy ? `$${Number(r.government_subsidy).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : null} />
        </>}
        <Field label="Tarifa" value={r.tariff} />
      </Section>

      {/* Desglose */}
      <Section title="Desglose del cobro">
        <Field label="Subtotal" value={r.subtotal ? `$${Number(r.subtotal).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : null} />
        <Field label="IVA" value={r.tax_amount ? `$${Number(r.tax_amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}` : null} />
        <Field label="Total" value={`$${Number(r.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}`} />
      </Section>

      {/* Datos de cuenta */}
      <Section title="Datos del servicio">
        <Field label="Proveedor" value={r.provider} />
        <Field label="No. cuenta" value={r.account_number} />
        <Field label="No. servicio" value={r.service_number} />
        <Field label="NIS" value={r.nis} />
        <Field label="NIR" value={r.nir} />
        <Field label="Medidor" value={r.meter_number} />
        <Field label="Dirección" value={r.address} />
      </Section>

      {/* Fiscal */}
      {(r.uuid_cfdi || r.invoice_folio) && (
        <Section title="Datos fiscales">
          <Field label="Folio" value={r.invoice_folio} />
          <Field label="UUID CFDI" value={r.uuid_cfdi} />
        </Section>
      )}

      {/* Confianza IA */}
      {r.ai_confidence && (
        <p className="text-xs text-zinc-600 text-center">
          Datos extraídos por IA con {Math.round(r.ai_confidence * 100)}% de confianza
        </p>
      )}
    </div>
  )
}
