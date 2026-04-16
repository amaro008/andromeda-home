import { createClient } from '@/lib/supabase/server'
import { Receipt } from '@/types'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import UploadReceiptButton from '@/components/ui/UploadReceiptButton'

const SERVICE_LABELS: Record<string, string> = { luz: 'Luz', agua: 'Agua', gas: 'Gas' }
const SERVICE_UNITS: Record<string, string>  = { luz: 'kWh', agua: 'L', gas: 'm³' }

export default async function RecibosPage() {
  const supabase = createClient()

  const { data: receipts, error } = await supabase
    
    .from('andromeda_receipts')
    .select('*')
    .order('issue_date', { ascending: false })

  const all = (receipts ?? []) as Receipt[]

  // Agrupar por año-mes
  const grouped: Record<string, Receipt[]> = {}
  for (const r of all) {
    const key = r.issue_date
      ? format(new Date(r.issue_date), 'MMMM yyyy', { locale: es })
      : 'Sin fecha'
    if (!grouped[key]) grouped[key] = []
    grouped[key].push(r)
  }

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Recibos</h1>
          <p className="text-zinc-500 text-sm mt-1">
            {all.length} recibo{all.length !== 1 ? 's' : ''} registrado{all.length !== 1 ? 's' : ''}
          </p>
        </div>
        <UploadReceiptButton />
      </div>

      {/* Tabla por mes */}
      {Object.keys(grouped).length === 0 ? (
        <div className="card text-center py-16">
          <div className="w-12 h-12 rounded-xl bg-andromeda-800/40 border border-andromeda-600/20 flex items-center justify-center mx-auto mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#639922" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/>
            </svg>
          </div>
          <p className="text-zinc-300 font-medium mb-1">Sube tu primer recibo</p>
          <p className="text-zinc-500 text-sm mb-6 max-w-xs mx-auto">
            Toma una foto o sube un PDF — la IA extrae fecha, consumo e importe automáticamente.
          </p>
          <UploadReceiptButton variant="primary" />
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, items]) => (
            <div key={month}>
              <h2 className="text-xs font-medium text-zinc-500 uppercase tracking-widest mb-3 capitalize">
                {month}
              </h2>
              <div className="card p-0 overflow-hidden">
                {items.map((r, i) => (
                  <div
                    key={r.id}
                    className={`flex items-center justify-between px-5 py-3.5 hover:bg-zinc-800/40 transition-colors
                                ${i < items.length - 1 ? 'border-b border-zinc-800' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <span className={`badge-${r.service_type} min-w-[42px] text-center`}>
                        {SERVICE_LABELS[r.service_type]}
                      </span>
                      <div>
                        <p className="text-sm text-zinc-200">{r.provider ?? 'Proveedor desconocido'}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {r.period_start && r.period_end && (
                            <span className="text-xs text-zinc-500">
                              {format(new Date(r.period_start), 'd MMM', { locale: es })} –{' '}
                              {format(new Date(r.period_end), 'd MMM yyyy', { locale: es })}
                            </span>
                          )}
                          {r.consumption && (
                            <span className="text-xs text-zinc-600">
                              · {r.consumption} {SERVICE_UNITS[r.service_type]}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-zinc-100">
                        ${r.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </p>
                      {r.ai_confidence && (
                        <p className="text-[10px] text-zinc-600 mt-0.5">
                          IA {Math.round(r.ai_confidence * 100)}%
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
