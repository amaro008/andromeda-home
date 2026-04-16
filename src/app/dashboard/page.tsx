import { createClient } from '@/lib/supabase/server'
import { Receipt } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import Link from 'next/link'

const SERVICE_LABELS: Record<string, string> = { luz: 'Luz', agua: 'Agua', gas: 'Gas' }
const SERVICE_UNITS: Record<string, string>  = { luz: 'kWh', agua: 'L', gas: 'm³' }

function StatCard({ label, value, sub, color }: { label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="card flex flex-col gap-1">
      <span className="text-xs text-zinc-500 uppercase tracking-wide">{label}</span>
      <span className={`text-2xl font-semibold ${color}`}>{value}</span>
      {sub && <span className="text-xs text-zinc-600">{sub}</span>}
    </div>
  )
}

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  const { data: receipts } = await supabase
    
    .from('andromeda_receipts')
    .select('*')
    .order('issue_date', { ascending: false })
    .limit(20)

  const all = (receipts ?? []) as Receipt[]

  const totalSpent = all.reduce((s, r) => s + (r.amount ?? 0), 0)
  const byService = {
    luz:  all.filter(r => r.service_type === 'luz').reduce((s, r) => s + r.amount, 0),
    agua: all.filter(r => r.service_type === 'agua').reduce((s, r) => s + r.amount, 0),
    gas:  all.filter(r => r.service_type === 'gas').reduce((s, r) => s + r.amount, 0),
  }
  const recent = all.slice(0, 5)

  const userName = session?.user?.email?.split('@')[0] ?? 'usuario'

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-zinc-100">
          Bienvenido, <span className="text-andromeda-200">{userName}</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-1">
          {format(new Date(), "EEEE d 'de' MMMM, yyyy", { locale: es })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total registrado" value={`$${totalSpent.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`} sub="todos los servicios" color="text-andromeda-200" />
        <StatCard label="Luz"  value={`$${byService.luz.toLocaleString('es-MX',  { minimumFractionDigits: 0 })}`} color="text-amber-400" />
        <StatCard label="Agua" value={`$${byService.agua.toLocaleString('es-MX', { minimumFractionDigits: 0 })}`} color="text-blue-400" />
        <StatCard label="Gas"  value={`$${byService.gas.toLocaleString('es-MX',  { minimumFractionDigits: 0 })}`} color="text-orange-400" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-sm font-medium text-zinc-100">Últimos recibos</h2>
          <Link href="/recibos" className="text-xs text-andromeda-400 hover:text-andromeda-200 transition-colors">Ver todos →</Link>
        </div>

        {recent.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-zinc-500 text-sm">Aún no hay recibos registrados.</p>
            <Link href="/recibos" className="btn-primary inline-block mt-4">Subir primer recibo</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recent.map(r => (
              <div key={r.id} className="flex items-center justify-between py-2.5 border-b border-zinc-800 last:border-0">
                <div className="flex items-center gap-3">
                  <span className={`badge-${r.service_type}`}>{SERVICE_LABELS[r.service_type]}</span>
                  <div>
                    <p className="text-sm text-zinc-200">{r.provider ?? 'Proveedor'}</p>
                    <p className="text-xs text-zinc-500">
                      {r.issue_date ? format(new Date(r.issue_date), "d MMM yyyy", { locale: es }) : 'Sin fecha'}
                      {r.consumption && ` · ${r.consumption} ${SERVICE_UNITS[r.service_type]}`}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-zinc-100">
                  ${r.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-6">
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

        <div className="card opacity-50 cursor-not-allowed">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-zinc-800 flex items-center justify-center border border-zinc-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-400">Dispositivos</p>
              <p className="text-xs text-zinc-600">Tapo y Shelly — próximamente</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
