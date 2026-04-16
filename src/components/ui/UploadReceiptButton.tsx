'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

interface Props {
  variant?: 'primary' | 'default'
}

type Step = 'idle' | 'processing' | 'confirm' | 'saving' | 'done' | 'error'

interface ExtractedData {
  service_type: 'luz' | 'agua' | 'gas'
  provider: string
  issue_date: string
  period_start: string
  period_end: string
  consumption: number
  consumption_unit: string
  amount: number
  currency: string
  ai_confidence: number
  raw_text: string
}

const SERVICE_ICON: Record<string, string> = { luz: '⚡', agua: '💧', gas: '🔥' }
const SERVICE_LABEL: Record<string, string> = { luz: 'Luz', agua: 'Agua', gas: 'Gas' }

export default function UploadReceiptButton({ variant = 'default' }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  function handleOpen() {
    setOpen(true)
    setStep('idle')
    setFile(null)
    setPreview(null)
    setExtracted(null)
    setError(null)
  }

  function handleClose() { setOpen(false) }

  async function processFile(f: File) {
    setFile(f)
    if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f))
    else setPreview(null)
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
      setError(err.message)
      setStep('error')
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (f) processFile(f)
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const f = e.dataTransfer.files?.[0]
    if (f && (f.type.startsWith('image/') || f.type === 'application/pdf')) processFile(f)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }, [])

  const handleDragLeave = useCallback(() => setDragOver(false), [])

  async function handleSave() {
    if (!extracted) return
    setStep('saving')
    try {
      const res = await fetch('/api/recibos/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(extracted),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Error al guardar')
      setStep('done')
      setTimeout(() => { setOpen(false); router.refresh() }, 1500)
    } catch (err: any) {
      setError(err.message)
      setStep('error')
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

            {/* Header */}
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

              {/* IDLE — drag & drop zone */}
              {step === 'idle' && (
                <div>
                  <input ref={inputRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleFileInput} />
                  <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => inputRef.current?.click()}
                    className={clsx(
                      'relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all duration-200',
                      dragOver
                        ? 'border-andromeda-400 bg-andromeda-800/20 scale-[1.01]'
                        : 'border-zinc-700 hover:border-andromeda-600 hover:bg-zinc-800/40'
                    )}
                  >
                    <div className={clsx(
                      'w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 transition-colors',
                      dragOver ? 'bg-andromeda-800/60' : 'bg-zinc-800'
                    )}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={dragOver ? '#97C459' : '#52525b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    {dragOver ? (
                      <p className="text-andromeda-200 font-medium text-sm">Suelta aquí</p>
                    ) : (
                      <>
                        <p className="text-zinc-200 font-medium text-sm mb-1">Arrastra el recibo aquí</p>
                        <p className="text-zinc-500 text-xs">o toca para seleccionar · Foto o PDF</p>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-3 mt-4">
                    {['luz', 'agua', 'gas'].map(s => (
                      <div key={s} className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-zinc-800/50 border border-zinc-800">
                        <span className="text-sm">{SERVICE_ICON[s]}</span>
                        <span className="text-xs text-zinc-500">{SERVICE_LABEL[s]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* PROCESSING */}
              {step === 'processing' && (
                <div className="text-center py-10">
                  {preview && (
                    <img src={preview} alt="Recibo" className="w-24 h-24 object-cover rounded-xl mx-auto mb-5 opacity-60 border border-zinc-700" />
                  )}
                  <div className="relative w-10 h-10 mx-auto mb-4">
                    <div className="absolute inset-0 border-2 border-andromeda-800 rounded-full" />
                    <div className="absolute inset-0 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-zinc-200">Analizando recibo...</p>
                  <p className="text-xs text-zinc-500 mt-1">Gemini está leyendo los datos</p>
                </div>
              )}

              {/* CONFIRM */}
              {step === 'confirm' && extracted && (
                <div>
                  <div className="flex items-center gap-2 mb-5">
                    <span className={`badge-${extracted.service_type}`}>
                      {SERVICE_ICON[extracted.service_type]} {SERVICE_LABEL[extracted.service_type]}
                    </span>
                    <div className="flex-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-andromeda-400 transition-all"
                        style={{ width: `${Math.round(extracted.ai_confidence * 100)}%` }}
                      />
                    </div>
                    <span className="text-xs text-zinc-500">{Math.round(extracted.ai_confidence * 100)}%</span>
                  </div>

                  <div className="bg-zinc-800/50 rounded-xl overflow-hidden mb-5">
                    {[
                      { label: 'Proveedor', value: extracted.provider || '—' },
                      { label: 'Fecha', value: extracted.issue_date || '—' },
                      { label: 'Periodo', value: extracted.period_start && extracted.period_end ? `${extracted.period_start} → ${extracted.period_end}` : '—' },
                      { label: 'Consumo', value: extracted.consumption ? `${extracted.consumption} ${extracted.consumption_unit}` : '—' },
                    ].map((row, i) => (
                      <div key={row.label} className={clsx('flex justify-between px-4 py-2.5', i > 0 && 'border-t border-zinc-800')}>
                        <span className="text-xs text-zinc-500">{row.label}</span>
                        <span className="text-xs text-zinc-300">{row.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between bg-andromeda-800/30 border border-andromeda-600/30 rounded-xl px-4 py-3 mb-5">
                    <span className="text-sm text-zinc-400">Total a pagar</span>
                    <span className="text-xl font-semibold text-andromeda-200">
                      ${extracted.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep('idle')} className="btn-ghost flex-1">Reintentar</button>
                    <button onClick={handleSave} className="btn-primary flex-1">Guardar recibo</button>
                  </div>
                </div>
              )}

              {/* SAVING */}
              {step === 'saving' && (
                <div className="text-center py-10">
                  <div className="w-10 h-10 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-zinc-300">Guardando...</p>
                </div>
              )}

              {/* DONE */}
              {step === 'done' && (
                <div className="text-center py-10">
                  <div className="w-14 h-14 rounded-full bg-andromeda-800/60 border border-andromeda-600/40 flex items-center justify-center mx-auto mb-4">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#97C459" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20,6 9,17 4,12"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-zinc-100">Recibo guardado</p>
                  <p className="text-xs text-zinc-500 mt-1">Los datos quedaron registrados</p>
                </div>
              )}

              {/* ERROR */}
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
