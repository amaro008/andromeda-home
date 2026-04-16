'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

interface Props {
  variant?: 'primary' | 'default'
}

type Step = 'idle' | 'preview' | 'processing' | 'confirm' | 'saving' | 'done' | 'error'

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

export default function UploadReceiptButton({ variant = 'default' }: Props) {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedData | null>(null)
  const [error, setError] = useState<string | null>(null)
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

  function handleClose() {
    setOpen(false)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      const url = URL.createObjectURL(f)
      setPreview(url)
    } else {
      setPreview(null)
    }
    setStep('preview')
  }

  async function handleProcess() {
    if (!file) return
    setStep('processing')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/recibos/extract', { method: 'POST', body: formData })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error ?? 'Error al procesar el recibo')

      setExtracted(data)
      setStep('confirm')
    } catch (err: any) {
      setError(err.message)
      setStep('error')
    }
  }

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
      setTimeout(() => {
        setOpen(false)
        router.refresh()
      }, 1500)
    } catch (err: any) {
      setError(err.message)
      setStep('error')
    }
  }

  const SERVICE_COLORS: Record<string, string> = {
    luz: 'text-amber-400',
    agua: 'text-blue-400',
    gas: 'text-orange-400',
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className={variant === 'primary' ? 'btn-primary' : 'btn-ghost'}
      >
        + Subir recibo
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-100">Subir recibo</h3>
              <button onClick={handleClose} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>

            <div className="p-6">
              {/* STEP: idle — zona de carga */}
              {step === 'idle' && (
                <div>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <button
                    onClick={() => inputRef.current?.click()}
                    className="w-full border-2 border-dashed border-zinc-700 hover:border-andromeda-600 rounded-xl p-10 text-center transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-zinc-800 group-hover:bg-andromeda-800/40 flex items-center justify-center mx-auto mb-3 transition-colors">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#639922" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
                      </svg>
                    </div>
                    <p className="text-sm text-zinc-300 font-medium">Toca para seleccionar</p>
                    <p className="text-xs text-zinc-500 mt-1">Foto o PDF del recibo</p>
                  </button>
                </div>
              )}

              {/* STEP: preview */}
              {step === 'preview' && (
                <div>
                  {preview ? (
                    <img src={preview} alt="Recibo" className="w-full max-h-52 object-contain rounded-lg mb-4 bg-zinc-800" />
                  ) : (
                    <div className="w-full h-24 flex items-center justify-center bg-zinc-800 rounded-lg mb-4">
                      <p className="text-zinc-400 text-sm">📄 {file?.name}</p>
                    </div>
                  )}
                  <p className="text-xs text-zinc-500 text-center mb-5">
                    La IA leerá el recibo y extraerá fecha, consumo e importe
                  </p>
                  <div className="flex gap-3">
                    <button onClick={() => setStep('idle')} className="btn-ghost flex-1">Cambiar</button>
                    <button onClick={handleProcess} className="btn-primary flex-1">Procesar con IA</button>
                  </div>
                </div>
              )}

              {/* STEP: processing */}
              {step === 'processing' && (
                <div className="text-center py-8">
                  <div className="w-10 h-10 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-zinc-300 font-medium">Leyendo recibo...</p>
                  <p className="text-xs text-zinc-500 mt-1">La IA está extrayendo los datos</p>
                </div>
              )}

              {/* STEP: confirm */}
              {step === 'confirm' && extracted && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`badge-${extracted.service_type} text-sm`}>
                      {extracted.service_type.charAt(0).toUpperCase() + extracted.service_type.slice(1)}
                    </span>
                    <span className="text-xs text-zinc-500">
                      Confianza IA: {Math.round(extracted.ai_confidence * 100)}%
                    </span>
                  </div>

                  <div className="space-y-2 mb-5">
                    {[
                      { label: 'Proveedor', value: extracted.provider },
                      { label: 'Fecha', value: extracted.issue_date },
                      { label: 'Periodo', value: extracted.period_start && extracted.period_end ? `${extracted.period_start} → ${extracted.period_end}` : '—' },
                      { label: 'Consumo', value: extracted.consumption ? `${extracted.consumption} ${extracted.consumption_unit}` : '—' },
                      { label: 'Importe', value: `$${extracted.amount.toLocaleString('es-MX', { minimumFractionDigits: 2 })} ${extracted.currency}`, highlight: true },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between items-center py-2 border-b border-zinc-800 last:border-0">
                        <span className="text-xs text-zinc-500">{row.label}</span>
                        <span className={clsx('text-sm', row.highlight ? 'text-andromeda-200 font-medium' : 'text-zinc-200')}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-3">
                    <button onClick={() => setStep('preview')} className="btn-ghost flex-1">Corregir</button>
                    <button onClick={handleSave} className="btn-primary flex-1">Guardar</button>
                  </div>
                </div>
              )}

              {/* STEP: saving */}
              {step === 'saving' && (
                <div className="text-center py-8">
                  <div className="w-10 h-10 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-zinc-300">Guardando...</p>
                </div>
              )}

              {/* STEP: done */}
              {step === 'done' && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-andromeda-800/60 border border-andromeda-600/40 flex items-center justify-center mx-auto mb-3">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#97C459" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20,6 9,17 4,12"/>
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-zinc-100">¡Recibo guardado!</p>
                </div>
              )}

              {/* STEP: error */}
              {step === 'error' && (
                <div className="text-center py-6">
                  <p className="text-red-400 text-sm mb-1">Error al procesar</p>
                  <p className="text-zinc-500 text-xs mb-5">{error}</p>
                  <button onClick={() => setStep('preview')} className="btn-ghost">Intentar de nuevo</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
