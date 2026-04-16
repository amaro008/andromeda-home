'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, Legend } from 'recharts'

const SVC_COLOR: Record<string, string> = { luz: '#F59E0B', agua: '#3B82F6', gas: '#F97316' }
const SVC_LABEL: Record<string, string> = { luz: 'Luz ⚡', agua: 'Agua 💧', gas: 'Gas 🔥' }

interface Receipt {
  id: string
  service_type: 'luz' | 'agua' | 'gas'
  provider: string
  amount: number
  consumption: number
  consumption_unit: string
  period_start: string
  period_end: string
  issue_date: string
  due_date: string
  tariff: string
  consumption_basic: number
  consumption_intermediate: number
  consumption_excess: number
  government_subsidy: number
  subtotal: number
  tax_amount: number
}

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-semibold ${color}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-600">{sub}</span>}
    </div>
  )
}

export default function DashboardPage() {
  const [receipts, setReceipts] = useState<Receipt[]>([])
  const [loading, setLoading] = useState(true)
  const [userName, setUserName] = useState('usuario')
  const supabase = createClient()

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setUserName(user.email?.split('@')[0] ?? 'usuario')

      const { data } = await supabase
        .from('andromeda_receipts')
        .select('*')
        .order('period_start', { ascending: false })
        .limit(24)

      setReceipts((data ?? []) as Receipt[])
      setLoading(false)
    }
    load()
  }, [])

  const totalSpent = receipts.reduce((s, r) => s + Number(r.amount), 0)
  const byService = {
    luz:  receipts.filter(r => r.service_type === 'luz').reduce((s, r) => s + Number(r.amount), 0),
    agua: receipts.filter(r => r.service_type === 'agua').reduce((s, r) => s + Number(r.amount), 0),
    gas:  receipts.filter(r => r.service_type === 'gas').reduce((s, r) => s + Number(r.amount), 0),
  }

  // Datos para gráfica de gasto por periodo
  const chartData = receipts
    .slice()
    .reverse()
    .reduce((acc: any[], r) => {
      const label = r.period_end
        ? format(new Date(r.period_end), 'MMM yy', { locale: es })
        : 'Sin fecha'
      const existing = acc.find(d => d.periodo === label)
      if (existing) {
        existing[r.service_type] = (existing[r.service_type] ?? 0) + Number(r.amount)
      } else {
        acc.push({ periodo: label, [r.service_type]: Number(r.amount) })
      }
      return acc
    }, [])

  const recent = receipts.slice(0, 5)

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">
          Bienvenido, <span className="text-andromeda-200">{userName}</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard label="Total registrado" value={`$${totalSpent.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`} sub={`${receipts.length} recibos`} color="text-andromeda-200" />
        <StatCard label="Luz" value={`$${byService.luz.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`} color="text-amber-400" />
        <StatCard label="Agua" value={`$${byService.agua.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`} color="text-blue-400" />
        <StatCard label="Gas" value={`$${byService.gas.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`} color="text-orange-400" />
      </div>

      {/* Gráfica */}
      {chartData.length > 0 && (
        <div className="card">
          <h2 className="text-sm font-medium text-zinc-100 mb-4">Gasto por periodo</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis dataKey="periodo" tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#71717a' }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', borderRadius: 8, fontSize: 12 }}
                formatter={(v: any) => [`$${Number(v).toLocaleString('es-MX')}`, '']}
              />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              {['luz', 'agua', 'gas'].map(s => (
                <Bar key={s} dataKey={s} name={SVC_LABEL[s]} fill={SVC_COLOR[s]} radius={[3, 3, 0, 0]} maxBarSize={32} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Últimos recibos */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-medium text-zinc-100">Últimos recibos</h2>
          <Link href="/recibos" className="text-xs text-andromeda-400 hover:text-andromeda-200 transition-colors">Ver todos →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-zinc-500 text-sm mb-4">Aún no hay recibos registrados.</p>
            <Link href="/recibos" className="btn-primary">Subir primer recibo</Link>
          </div>
        ) : (
          <div className="space-y-0">
            {recent.map(r => (
              <Link key={r.id} href={`/recibos/${r.id}`}
                className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30 -mx-2 px-2 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <span className={`badge-${r.service_type}`}>
                    {r.service_type === 'luz' ? '⚡' : r.service_type === 'agua' ? '💧' : '🔥'} {r.provider}
                  </span>
                  <span className="text-xs text-zinc-500">
                    {r.period_end ? format(new Date(r.period_end), 'MMM yyyy', { locale: es }) : '—'}
                    {r.consumption ? ` · ${r.consumption} ${r.consumption_unit ?? ''}` : ''}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-100">
                    ${Number(r.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                  </span>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Accesos rápidos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Link href="/recibos" className="card hover:border-andromeda-600/50 transition-colors group cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-andromeda-800/60 flex items-center justify-center border border-andromeda-600/30 group-hover:border-andromeda-400/50 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#97C459" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-100">Subir recibo</p>
              <p className="text-xs text-zinc-500">Foto o PDF, la IA extrae los datos</p>
            </div>
          </div>
        </Link>
        <div className="card opacity-40 cursor-not-allowed">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Dispositivos</p>
              <p className="text-xs text-zinc-600">Tapo y Shelly — Sprint 3</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
