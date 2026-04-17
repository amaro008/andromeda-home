'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, getYear, getMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import { ComposedChart, Bar, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import clsx from 'clsx'

interface Receipt {
  id: string; service_type: 'luz'|'agua'|'gas'; provider: string
  amount: number; previous_balance: number; total_with_balance: number
  consumption: number|null; consumption_unit: string|null
  consumption_basic: number|null; consumption_intermediate: number|null; consumption_excess: number|null
  period_start: string|null; period_end: string|null; issue_date: string|null; due_date: string|null
  tariff: string|null; meter_number: string|null; account_number: string|null; nis: string|null
  subtotal: number|null; tax_amount: number|null; government_subsidy: number|null; ai_confidence: number|null
  created_at: string
}

interface ExtractedData { [key: string]: any; service_type: 'luz'|'agua'|'gas'; provider: string; amount: number }

const SVC = {
  luz:  { label:'Luz',  icon:'⚡', color:'#F59E0B', badge:'badge-luz',  unit:'kWh' },
  agua: { label:'Agua', icon:'💧', color:'#3B82F6', badge:'badge-agua', unit:'m³'  },
  gas:  { label:'Gas',  icon:'🔥', color:'#F97316', badge:'badge-gas',  unit:'m³'  },
}
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const KPIS = [
  { key:'gasto',    label:'Gasto ($)'       },
  { key:'consumo',  label:'Consumo'         },
  { key:'unitario', label:'Unitario ($/ud)'  },
]

function getMonthKey(r: Receipt) {
  const d = r.period_end ? new Date(r.period_end) : r.issue_date ? new Date(r.issue_date) : null
  return d ? { year: getYear(d), month: getMonth(d) } : null
}

function buildChart(receipts: Receipt[], svc: 'luz'|'agua'|'gas', kpi: string) {
  const now = new Date(); const cy = getYear(now); const py = cy-1
  const rows = receipts.filter(r => r.service_type === svc)
  const data: Record<number,{prev?:number;cur?:number}> = {}
  for (let m=0;m<12;m++) data[m]={}
  rows.forEach(r => {
    const mk = getMonthKey(r); if (!mk) return
    const val = kpi==='gasto' ? Number(r.amount)
      : kpi==='consumo' ? (r.consumption ? Number(r.consumption) : null)
      : (r.consumption && Number(r.consumption)>0 ? Number(r.amount)/Number(r.consumption) : null)
    if (val===null) return
    if (mk.year===py) data[mk.month].prev=val
    if (mk.year===cy) data[mk.month].cur=val
  })
  return MONTHS.map((m,i) => ({ mes:m, 'Año anterior':data[i].prev??null, 'Año actual':data[i].cur??null }))
}

function ServiceChart({ receipts, svc, kpi }: { receipts:Receipt[]; svc:'luz'|'agua'|'gas'; kpi:string }) {
  const data = buildChart(receipts, svc, kpi)
  const s = SVC[svc]
  const hasData = data.some(d => d['Año anterior']!==null || d['Año actual']!==null)
  if (!hasData) return <div className="flex items-center justify-center h-36 text-zinc-600 text-xs">Sin datos aún</div>
  const fmt = (v:any) => kpi==='consumo' ? `${Number(v).toFixed(1)} ${s.unit}` : `$${Number(v).toLocaleString('es-MX',{minimumFractionDigits:0})}`
  return (
    <ResponsiveContainer width="100%" height={160}>
      <ComposedChart data={data} margin={{top:4,right:4,left:-24,bottom:0}}>
        <XAxis dataKey="mes" tick={{fontSize:10,fill:'#71717a'}} axisLine={false} tickLine={false}/>
        <YAxis tick={{fontSize:10,fill:'#71717a'}} axisLine={false} tickLine={false}/>
        <Tooltip contentStyle={{background:'#18181b',border:'1px solid #3f3f46',borderRadius:8,fontSize:11}} formatter={(v:any,n:string)=>[fmt(v),n]}/>
        <Area dataKey="Año anterior" fill={s.color} fillOpacity={0.12} stroke={s.color} strokeOpacity={0.3} strokeWidth={1} dot={false} connectNulls/>
        <Bar dataKey="Año actual" fill={s.color} fillOpacity={0.85} radius={[3,3,0,0]} maxBarSize={28}/>
      </ComposedChart>
    </ResponsiveContainer>
  )
}

function DropZone({ onFile }: { onFile:(f:File)=>void }) {
  const [drag,setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files?.[0];if(f)onFile(f)}}
      onDragOver={e=>{e.preventDefault();setDrag(true)}} onDragLeave={()=>setDrag(false)}
      onClick={()=>ref.current?.click()}
      className={clsx('border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all duration-200 flex items-center gap-4',
        drag ? 'border-andromeda-400 bg-andromeda-800/20' : 'border-zinc-700 hover:border-andromeda-600 hover:bg-zinc-800/30')}>
      <input ref={ref} type="file" accept="image/*,application/pdf" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)onFile(f)}}/>
      <div className={clsx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0',drag?'bg-andromeda-800/60':'bg-zinc-800')}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={drag?'#97C459':'#52525b'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/>
        </svg>
      </div>
      <div className="text-left">
        {drag ? <p className="text-sm text-andromeda-200 font-medium">Suelta aquí</p>
          : <><p className="text-sm text-zinc-300 font-medium">Arrastra un recibo o toca para seleccionar</p>
              <p className="text-xs text-zinc-500">PDF o foto · CFE, SADM, Naturgy</p></>}
      </div>
    </div>
  )
}

function UploadModal({ file, receipts, onClose, onSaved }: { file:File; receipts:Receipt[]; onClose:()=>void; onSaved:()=>void }) {
  type Step = 'processing'|'missing_consumption'|'confirm'|'duplicate'|'saving'|'done'|'error'
  const [step,setStep] = useState<Step>('processing')
  const [extracted,setExtracted] = useState<ExtractedData|null>(null)
  const [error,setError] = useState('')
  const [manualVal,setManualVal] = useState('')
  const [duplicate,setDuplicate] = useState<Receipt|null>(null)
  const supabase = createClient()

  function checkDup(d:ExtractedData, list:Receipt[]) {
    return list.find(r => r.service_type===d.service_type && r.period_start===(d.period_start??null) && r.period_end===(d.period_end??null)) ?? null
  }

  useEffect(()=>{
    ;(async()=>{
      try {
        const fd=new FormData(); fd.append('file',file)
        const res=await fetch('/api/recibos/extract',{method:'POST',body:fd})
        const data=await res.json()
        if(!res.ok) throw new Error(data.error??'Error')
        if(!data.total_with_balance) data.total_with_balance=data.amount+(data.previous_balance??0)
        setExtracted(data)
        if(!data.consumption){setStep('missing_consumption');return}
        const dup=checkDup(data,receipts); if(dup){setDuplicate(dup);setStep('duplicate');return}
        setStep('confirm')
      } catch(e:any){setError(e.message);setStep('error')}
    })()
  },[])

  function applyManual(){
    const v=parseFloat(manualVal); if(isNaN(v)||v<=0) return
    const upd={...extracted!,consumption:v}; setExtracted(upd)
    const dup=checkDup(upd,receipts); if(dup){setDuplicate(dup);setStep('duplicate');return}
    setStep('confirm')
  }

  async function save(replaceId?:string){
    if(!extracted) return; setStep('saving')
    try {
      const {data:{user}}=await supabase.auth.getUser(); if(!user) throw new Error('Sin sesión')
      if(replaceId){
        await fetch('/api/recibos/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:replaceId,user_id:user.id})})
      }
      const res=await fetch('/api/recibos/save',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...extracted,user_id:user.id})})
      const data=await res.json(); if(!res.ok) throw new Error(data.error)
      setStep('done'); setTimeout(()=>{onClose();onSaved()},1200)
    } catch(e:any){setError(e.message);setStep('error')}
  }

  const s = extracted ? SVC[extracted.service_type] : null
  const titles:Record<Step,string> = {
    processing:'Analizando...', missing_consumption:'Consumo no detectado',
    confirm:'Confirmar recibo', duplicate:'Recibo duplicado',
    saving:'Guardando...', done:'¡Guardado!', error:'Error'
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-andromeda-800 flex items-center justify-center">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#97C459" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
            </div>
            <h3 className="text-sm font-medium text-zinc-100">{titles[step]}</h3>
          </div>
          {!['processing','saving','done'].includes(step) && (
            <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          )}
        </div>
        <div className="p-6">
          {step==='processing' && (
            <div className="text-center py-8">
              <div className="relative w-10 h-10 mx-auto mb-4">
                <div className="absolute inset-0 border-2 border-andromeda-800 rounded-full"/>
                <div className="absolute inset-0 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin"/>
              </div>
              <p className="text-sm text-zinc-300">Gemini está leyendo el recibo...</p>
              <p className="text-xs text-zinc-500 mt-1">{file.name}</p>
            </div>
          )}
          {step==='missing_consumption' && extracted && s && (
            <div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                <p className="text-xs text-amber-400">No se pudo extraer el volumen de consumo. Puedes capturarlo manualmente o continuar sin él.</p>
              </div>
              <div className="flex items-center justify-between mb-4">
                <span className={s.badge}>{s.icon} {extracted.provider}</span>
                <span className="text-sm font-medium text-andromeda-200">${Number(extracted.amount).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
              </div>
              <label className="label">Consumo ({s.unit})</label>
              <div className="flex gap-2">
                <input type="number" className="input flex-1" placeholder="ej: 700" value={manualVal} onChange={e=>setManualVal(e.target.value)}/>
                <button onClick={applyManual} className="btn-primary px-4" disabled={!manualVal}>Agregar</button>
              </div>
              <button onClick={()=>{const dup=checkDup(extracted,receipts);if(dup){setDuplicate(dup);setStep('duplicate')}else setStep('confirm')}}
                className="btn-ghost w-full mt-3 text-xs">Continuar sin consumo</button>
            </div>
          )}
          {step==='duplicate' && duplicate && extracted && s && (
            <div>
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 mb-4">
                <p className="text-xs text-amber-400">Ya existe un recibo de <strong>{SVC[duplicate.service_type].label}</strong> para este periodo. ¿Reemplazar?</p>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs mb-4">
                <div className="bg-zinc-800/50 rounded-lg p-3">
                  <p className="text-zinc-500 mb-1">Existente</p>
                  <p className="text-zinc-300">${Number(duplicate.amount).toLocaleString('es-MX',{minimumFractionDigits:2})}</p>
                  <p className="text-zinc-500">{duplicate.consumption?`${duplicate.consumption} ${duplicate.consumption_unit}`:'Sin consumo'}</p>
                </div>
                <div className="bg-andromeda-800/20 border border-andromeda-600/20 rounded-lg p-3">
                  <p className="text-zinc-500 mb-1">Nuevo</p>
                  <p className="text-andromeda-200">${Number(extracted.amount).toLocaleString('es-MX',{minimumFractionDigits:2})}</p>
                  <p className="text-zinc-500">{extracted.consumption?`${extracted.consumption} ${extracted.consumption_unit}`:'Sin consumo'}</p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={()=>save(duplicate.id)} className="btn-primary flex-1">Reemplazar</button>
              </div>
            </div>
          )}
          {step==='confirm' && extracted && s && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <span className={s.badge}>{s.icon} {extracted.service_type}</span>
                <span className="text-xs text-zinc-500 truncate flex-1">{extracted.provider}</span>
                <span className="text-xs text-zinc-600">IA {Math.round((extracted.ai_confidence??0)*100)}%</span>
              </div>
              <div className="bg-andromeda-800/30 border border-andromeda-600/30 rounded-xl px-4 py-3 mb-4 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-zinc-400">Total del mes</span>
                  <span className="text-2xl font-semibold text-andromeda-200">${Number(extracted.amount).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
                </div>
                {(extracted.previous_balance??0)>0 && <>
                  <div className="flex justify-between border-t border-andromeda-600/20 pt-2">
                    <span className="text-xs text-amber-400">+ Adeudo anterior</span>
                    <span className="text-sm text-amber-400">${Number(extracted.previous_balance).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
                  </div>
                  <div className="flex justify-between border-t border-zinc-700 pt-2">
                    <span className="text-xs text-zinc-500">Total a pagar</span>
                    <span className="text-sm font-medium text-zinc-300">${Number(extracted.total_with_balance).toLocaleString('es-MX',{minimumFractionDigits:2})}</span>
                  </div>
                </>}
              </div>
              <div className="bg-zinc-800/40 rounded-xl px-4 py-1 mb-4 text-xs">
                {extracted.period_start && extracted.period_end && <div className="flex justify-between py-2 border-b border-zinc-800"><span className="text-zinc-500">Periodo</span><span className="text-zinc-300">{extracted.period_start} → {extracted.period_end}</span></div>}
                <div className="flex justify-between py-2 border-b border-zinc-800 last:border-0">
                  <span className={extracted.consumption ? 'text-zinc-500' : 'text-amber-400'}>Consumo</span>
                  <span className="text-zinc-300">{extracted.consumption ? `${extracted.consumption} ${extracted.consumption_unit}` : 'No extraído'}</span>
                </div>
                {extracted.due_date && <div className="flex justify-between py-2"><span className="text-zinc-500">Límite</span><span className="text-zinc-300">{extracted.due_date}</span></div>}
              </div>
              <div className="flex gap-3">
                <button onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
                <button onClick={()=>save()} className="btn-primary flex-1">Guardar recibo</button>
              </div>
            </div>
          )}
          {step==='saving' && <div className="text-center py-8"><div className="w-10 h-10 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"/><p className="text-sm text-zinc-300">Guardando...</p></div>}
          {step==='done' && <div className="text-center py-8"><div className="w-14 h-14 rounded-full bg-andromeda-800/60 border border-andromeda-600/40 flex items-center justify-center mx-auto mb-4"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#97C459" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg></div><p className="text-sm font-medium text-zinc-100">Recibo guardado</p></div>}
          {step==='error' && <div className="text-center py-6"><p className="text-sm text-red-400 mb-1">Error</p><p className="text-xs text-zinc-500 mb-4">{error}</p><button onClick={onClose} className="btn-ghost">Cerrar</button></div>}
        </div>
      </div>
    </div>
  )
}

export default function RecibosPage() {
  const [receipts,setReceipts] = useState<Receipt[]>([])
  const [loading,setLoading] = useState(true)
  const [kpi,setKpi] = useState('gasto')
  const [filter,setFilter] = useState<'all'|'luz'|'agua'|'gas'>('all')
  const [expandedId,setExpandedId] = useState<string|null>(null)
  const [uploadFile,setUploadFile] = useState<File|null>(null)
  const [deleteConfirm,setDeleteConfirm] = useState<Receipt|null>(null)
  const supabase = createClient()

  async function load() {
    const {data} = await supabase.from('andromeda_receipts').select('*').order('period_end',{ascending:false})
    setReceipts((data??[]) as Receipt[]); setLoading(false)
  }
  useEffect(()=>{load()},[])

  async function doDelete(r:Receipt) {
    const {data:{user}} = await supabase.auth.getUser(); if(!user) return
    await fetch('/api/recibos/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:r.id,user_id:user.id})})
    setDeleteConfirm(null); load()
  }

  const curYear = getYear(new Date()); const prevYear = curYear-1
  const filtered = filter==='all' ? receipts : receipts.filter(r=>r.service_type===filter)

  function totalByYear(svc:'luz'|'agua'|'gas', yr:number) {
    return receipts.filter(r=>r.service_type===svc && r.period_end && getYear(new Date(r.period_end))===yr).reduce((s,r)=>s+Number(r.amount),0)
  }
  function yoy(svc:'luz'|'agua'|'gas') {
    const c=totalByYear(svc,curYear), p=totalByYear(svc,prevYear)
    if(!p) return null; const pct=((c-p)/p)*100; return {pct,up:pct>0}
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-100">Recibos</h1>
            <p className="text-zinc-500 text-sm mt-0.5">{receipts.length} registro{receipts.length!==1?'s':''}</p>
          </div>
        </div>
        <DropZone onFile={setUploadFile}/>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card col-span-2 lg:col-span-1 flex flex-col gap-1">
          <span className="text-xs text-zinc-500 uppercase tracking-wide">Total {curYear}</span>
          <span className="text-2xl font-semibold text-andromeda-200">
            ${receipts.filter(r=>r.period_end&&getYear(new Date(r.period_end))===curYear).reduce((s,r)=>s+Number(r.amount),0).toLocaleString('es-MX',{minimumFractionDigits:0})}
          </span>
          <span className="text-xs text-zinc-600">{receipts.filter(r=>r.period_end&&getYear(new Date(r.period_end))===curYear).length} recibos</span>
        </div>
        {(['luz','agua','gas'] as const).map(svc => {
          const y=yoy(svc); const s=SVC[svc]
          return (
            <div key={svc} className="card flex flex-col gap-1">
              <span className="text-xs text-zinc-500 uppercase tracking-wide">{s.label}</span>
              <span className={`text-xl font-semibold ${svc==='luz'?'text-amber-400':svc==='agua'?'text-blue-400':'text-orange-400'}`}>
                ${totalByYear(svc,curYear).toLocaleString('es-MX',{minimumFractionDigits:0})}
              </span>
              {y && <span className={clsx('text-xs',y.up?'text-red-400':'text-green-400')}>{y.up?'↑':'↓'} {Math.abs(y.pct).toFixed(0)}% vs {prevYear}</span>}
            </div>
          )
        })}
      </div>

      {/* Charts */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-zinc-100">Histórico</h2>
          <div className="flex gap-1">
            {KPIS.map(k=>(
              <button key={k.key} onClick={()=>setKpi(k.key)}
                className={clsx('text-xs px-2.5 py-1 rounded-full transition-colors',kpi===k.key?'bg-andromeda-800/60 text-andromeda-200 border border-andromeda-600/40':'text-zinc-500 hover:text-zinc-300 border border-transparent')}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['luz','agua','gas'] as const).map(svc => (
            <div key={svc}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`badge-${svc} text-xs`}>{SVC[svc].icon} {SVC[svc].label}</span>
                <span className="text-xs text-zinc-600">{kpi==='gasto'?'MXN':kpi==='consumo'?SVC[svc].unit:`$/${SVC[svc].unit}`}</span>
              </div>
              <ServiceChart receipts={receipts} svc={svc} kpi={kpi}/>
              <div className="flex gap-3 mt-1 justify-end">
                <span className="flex items-center gap-1 text-xs text-zinc-600"><span className="w-3 h-1 rounded inline-block" style={{background:SVC[svc].color,opacity:0.3}}/>{prevYear}</span>
                <span className="flex items-center gap-1 text-xs text-zinc-500"><span className="w-3 h-3 rounded inline-block" style={{background:SVC[svc].color}}/>{curYear}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="card p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-medium text-zinc-100">Registros</h2>
          <div className="flex gap-1">
            {(['all','luz','agua','gas'] as const).map(f=>(
              <button key={f} onClick={()=>setFilter(f)}
                className={clsx('text-xs px-2.5 py-1 rounded-full transition-colors',filter===f?'bg-andromeda-800/60 text-andromeda-200 border border-andromeda-600/40':'text-zinc-500 hover:text-zinc-300 border border-transparent')}>
                {f==='all'?'Todos':SVC[f].icon+' '+SVC[f].label}
              </button>
            ))}
          </div>
        </div>
        {filtered.length===0 ? (
          <div className="text-center py-10 text-zinc-500 text-sm">No hay recibos{filter!=='all'?` de ${SVC[filter].label.toLowerCase()}`:''} aún</div>
        ) : filtered.map(r => {
          const s=SVC[r.service_type]
          const dateLabel = r.period_end ? format(new Date(r.period_end),'MMM yyyy',{locale:es}) : r.issue_date ? format(new Date(r.issue_date),'MMM yyyy',{locale:es}) : '—'
          const expanded = expandedId===r.id
          return (
            <div key={r.id} className={clsx('border-b border-zinc-800 last:border-0',expanded?'bg-zinc-800/30':'hover:bg-zinc-800/20')}>
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={()=>setExpandedId(expanded?null:r.id)}>
                <span className={`${s.badge} min-w-[32px] text-center`}>{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-zinc-200 truncate">{r.provider}</p>
                  <p className="text-xs text-zinc-500">{dateLabel}{r.consumption?` · ${r.consumption} ${r.consumption_unit??''}`:''}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium text-zinc-100">${Number(r.amount).toLocaleString('es-MX',{minimumFractionDigits:2})}</p>
                  {Number(r.previous_balance)>0 && <p className="text-xs text-amber-400">+${Number(r.previous_balance).toFixed(0)} adeudo</p>}
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="2" className={clsx('shrink-0 transition-transform',expanded&&'rotate-180')}><polyline points="6,9 12,15 18,9"/></svg>
              </div>
              {expanded && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs">
                    {r.period_start && r.period_end && <><span className="text-zinc-500">Periodo</span><span className="text-zinc-300">{format(new Date(r.period_start),'d MMM',{locale:es})} → {format(new Date(r.period_end),'d MMM yyyy',{locale:es})}</span></>}
                    {r.due_date && <><span className="text-zinc-500">Límite pago</span><span className="text-zinc-300">{format(new Date(r.due_date),'d MMM yyyy',{locale:es})}</span></>}
                    {r.tariff && <><span className="text-zinc-500">Tarifa</span><span className="text-zinc-300">{r.tariff}</span></>}
                    {r.meter_number && <><span className="text-zinc-500">Medidor</span><span className="text-zinc-300">{r.meter_number}</span></>}
                    {r.account_number && <><span className="text-zinc-500">Cuenta</span><span className="text-zinc-300">{r.account_number}</span></>}
                    {r.nis && <><span className="text-zinc-500">NIS</span><span className="text-zinc-300">{r.nis}</span></>}
                    {r.subtotal!=null && <><span className="text-zinc-500">Subtotal</span><span className="text-zinc-300">${Number(r.subtotal).toFixed(2)}</span></>}
                    {r.tax_amount!=null && <><span className="text-zinc-500">IVA</span><span className="text-zinc-300">${Number(r.tax_amount).toFixed(2)}</span></>}
                    {r.service_type==='luz' && r.consumption_basic!=null && <><span className="text-zinc-500">Básico/Int/Exc</span><span className="text-zinc-300">{r.consumption_basic}/{r.consumption_intermediate}/{r.consumption_excess} kWh</span></>}
                    {r.government_subsidy!=null && Number(r.government_subsidy)>0 && <><span className="text-zinc-500">Apoyo gov.</span><span className="text-zinc-300">${Number(r.government_subsidy).toFixed(2)}</span></>}
                    {Number(r.previous_balance)>0 && <><span className="text-amber-400">Adeudo ant.</span><span className="text-amber-400">${Number(r.previous_balance).toFixed(2)}</span></>}
                  </div>
                  <div className="flex justify-end">
                    <button onClick={e=>{e.stopPropagation();setDeleteConfirm(r)}}
                      className="text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-400/40 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6M14,11v6"/><path d="M9,6V4h6v2"/></svg>
                      Eliminar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {uploadFile && <UploadModal file={uploadFile} receipts={receipts} onClose={()=>setUploadFile(null)} onSaved={load}/>}

      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">¿Eliminar este recibo?</h3>
            <p className="text-xs text-zinc-500 mb-5">
              {SVC[deleteConfirm.service_type].label} · {deleteConfirm.provider} · ${Number(deleteConfirm.amount).toLocaleString('es-MX',{minimumFractionDigits:2})}
              {deleteConfirm.period_end?` · ${format(new Date(deleteConfirm.period_end),'MMM yyyy',{locale:es})}` :''}
            </p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteConfirm(null)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={()=>doDelete(deleteConfirm)} className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
