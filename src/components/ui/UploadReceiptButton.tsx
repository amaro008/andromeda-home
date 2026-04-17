'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import clsx from 'clsx'

interface Props { variant?: 'primary' | 'default' }
type Step = 'idle' | 'processing' | 'confirm' | 'saving' | 'done' | 'error'

interface ExtractedData {
  service_type: 'luz' | 'agua' | 'gas'
  provider: string
  account_number?: string
  service_number?: string
  nis?: string
  meter_number?: string
  tariff?: string
  issue_date?: string
  due_date?: string
  period_start?: string
  period_end?: string
  consumption?: number
  consumption_unit?: string
  consumption_basic?: number
  consumption_intermediate?: number
  consumption_excess?: number
  subtotal?: number
  tax_amount?: number
  government_subsidy?: number
  previous_balance?: number
  amount: number
  currency: string
  ai_confidence: number
  raw_text?: string
  [key: string]: any
}

const SVC = {
  luz:  { label: 'Luz',  icon: '⚡', badge: 'badge-luz'  },
  agua: { label: 'Agua', icon: '💧', badge: 'badge-agua' },
  gas:  { label: 'Gas',  icon: '🔥', badge: 'badge-gas'  },
}

function Row({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null
  return (
    <div className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-200 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

export default function UploadReceiptButton({ variant = 'default' }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [preview, setPreview] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createClient()

  function handleOpen() {
    setOpen(true); setStep('idle'); setPreview(null); setExtracted(null); setError(null)
  }
  function handleClose() { setOpen(false) }

  async function processFile(f: File) {
    if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f))
    setStep('processing')
    try {
      const fd = new FormData()
      fd.append('file', f)
      const res = await fetch('/api/recibos/extract', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al procesar')
      setExtracted(data)
      setStep('confirm')
    } catch (err: any) {
      setError(err.message); setStep('error')
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) processFile(f)
  }, [])

  async function handleSave() {
    if (!extracted) return
    setStep('saving')
    try {
      // Obtener user_id desde el cliente Supabase (browser tiene la sesión)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('No hay sesión activa — cierra sesión y vuelve a entrar')

      const res = await fetch('/api/recibos/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...extracted, user_id: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      setStep('done')
      setTimeout(() => { setOpen(false); router.refresh() }, 1500)
    } catch (err: any) {
      setError(err.message); setStep('error')
    }
  }

  return (
    <>
      <button onClick={handleOpen} className={variant === 'primary' ? 'btn-primary' : 'btn-ghost'}>
        + Subir recibo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">

            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-andromeda-800 flex items-center justify-center">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#97C459" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/>
                  </svg>
                </div>
                <h3 className="text-sm font-medium text-zinc-100">Nuevo recibo</h3>
              </div>
              <button onClick={handleClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-6">
              {step === 'idle' && (
                <div>
                  <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileInput} />
                  <div
                    onDrop={handleDrop}
                    onDragOver={e => { e.preventDefault(); setDragOver(true) }}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => inputRef.current?.click()}
                    className={clsx(
                      'border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
                      dragOver ? 'border-andromeda-400 bg-andromeda-800/20 scale-[1.01]' : 'border-zinc-700 hover:border-andromeda-600 hover:bg-zinc-800/40'
                    )}
                  >
                    <div className={clsx('w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors', dragOver ? 'bg-andromeda-800/60' : 'bg-zinc-800')}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#97C459' : '#52525b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    {dragOver
                      ? <p className="text-andromeda-200 font-medium text-sm">Suelta aquí</p>
                      : <><p className="text-zinc-200 font-medium text-sm mb-1">Arrastra el recibo aquí</p><p className="text-zinc-500 text-xs">o toca para seleccionar · Foto o PDF</p></>
                    }
                  </div>
                  <div className="flex gap-2 mt-4">
                    {(['luz', 'agua', 'gas'] as const).map(s => (
                      <div key={s} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-800/50 border border-zinc-800">
                        <span className="text-sm">{SVC[s].icon}</span>
                        <span className="text-xs text-zinc-500">{SVC[s].label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {step === 'processing' && (
                <div className="text-center py-10">
                  {preview && <img src={preview} alt="" className="w-20 h-20 object-cover rounded-xl mx-auto mb-5 opacity-50 border border-zinc-700" />}
                  <div className="relative w-10 h-10 mx-auto mb-4">
                    <div className="absolute inset-0 border-2 border-andromeda-800 rounded-full" />
                    <div className="absolute inset-0 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-zinc-200">Analizando recibo...</p>
                  <p className="text-xs text-zinc-500 mt-1">Gemini está leyendo los datos</p>
                </div>
              )}

              {step === 'confirm' && extracted && (
                <div>
                  <div className="flex items-center gap-3 mb-4">
                    <span className={SVC[extracted.service_type].badge}>
                      {SVC[extracted.service_type].icon} {SVC[extracted.service_type].label}
                    </span>
                    <span className="text-xs text-zinc-500 truncate flex-1">{extracted.provider}</span>
                    <span className="text-xs text-zinc-600">IA {Math.round(extracted.ai_confidence * 100)}%</span>
                  </div>
                  <div className="bg-andromeda-800/30 border border-andromeda-600/30 rounded-xl px-4 py-3 mb-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-zinc-400">Total del mes</span>
                      <span className="text-2xl font-semibold text-andromeda-200">
                        ${extracted.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                    {(extracted.previous_balance ?? 0) > 0 && <>
                      <div className="flex items-center justify-between border-t border-andromeda-600/20 pt-2">
                        <span className="text-xs text-amber-400">+ Adeudo anterior</span>
                        <span className="text-sm text-amber-400">${Number(extracted.previous_balance).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <div className="flex items-center justify-between border-t border-zinc-700 pt-2">
                        <span className="text-xs text-zinc-500">Total a pagar</span>
                        <span className="text-sm font-medium text-zinc-300">${Number(extracted.total_with_balance ?? extracted.amount).toLocaleString('es-MX', { minimumFractionDigits: 2 })}</span>
                      </div>
                    </>}
                  </div>
                  <div className="bg-zinc-800/40 rounded-xl px-4 py-1 mb-5 max-h-52 overflow-y-auto">
                    <Row label="Periodo" value={extracted.period_start && extracted.period_end ? `${extracted.period_start} → ${extracted.period_end}` : null} />
                    <Row label="Fecha límite" value={extracted.due_date} />
                    <Row label="Consumo" value={extracted.consumption ? `${extracted.consumption} ${extracted.consumption_unit}` : null} />
                    {extracted.service_type === 'luz' && <>
                      <Row label="Básico" value={extracted.consumption_basic ? `${extracted.consumption_basic} kWh` : null} />
                      <Row label="Intermedio" value={extracted.consumption_intermediate ? `${extracted.consumption_intermediate} kWh` : null} />
                      <Row label="Excedente" value={extracted.consumption_excess ? `${extracted.consumption_excess} kWh` : null} />
                      <Row label="Apoyo gubernamental" value={extracted.government_subsidy ? `$${extracted.government_subsidy}` : null} />
                    </>}
                    <Row label="Subtotal" value={extracted.subtotal ? `$${extracted.subtotal}` : null} />
                    <Row label="IVA" value={extracted.tax_amount ? `$${extracted.tax_amount}` : null} />
                    <Row label="Tarifa" value={extracted.tariff} />
                    <Row label="Medidor" value={extracted.meter_number} />
                    <Row label="No. cuenta" value={extracted.account_number} />
                    <Row label="NIS" value={extracted.nis} />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setStep('idle')} className="btn-ghost flex-1">Reintentar</button>
                    <button onClick={handleSave} className="btn-primary flex-1">Guardar recibo</button>
                  </div>
                </div>
              )}

              {step === 'saving' && (
                <div className="text-center py-10">
                  <div className="w-10 h-10 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-zinc-300">Guardando...</p>
                </div>
              )}

              {step === 'done' && (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-full bg-andromeda-800/60 border border-andromeda-600/40 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#97C459" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
                  </div>
                  <p className="text-sm font-medium text-zinc-100">Recibo guardado</p>
                  <p className="text-xs text-zinc-500 mt-1">Datos registrados correctamente</p>
                </div>
              )}

              {step === 'error' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-red-400 mb-1">No se pudo procesar</p>
                  <p className="text-xs text-zinc-500 mb-5 max-w-xs mx-auto">{error}</p>
                  <button onClick={() => setStep('idle')} className="btn-ghost">Intentar de nuevo</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
