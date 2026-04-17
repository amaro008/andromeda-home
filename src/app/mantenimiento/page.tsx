'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { format, addDays, addWeeks, addMonths, addYears, isToday, isBefore, differenceInDays, getYear, getMonth, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth } from 'date-fns'
import { es } from 'date-fns/locale'
import clsx from 'clsx'

// ─── Types ───────────────────────────────────────────────────────────────────
interface Category { id: string; name: string; color: string; icon: string }
interface Provider { id: string; name: string; category: string; phone: string; whatsapp_number: string; notes: string; services_count: number }
interface Task {
  id: string; title: string; category_id: string | null; frequency: string; frequency_days: number | null
  next_date: string; estimated_cost: number | null; notes: string | null; status: string; provider_id: string | null
  category?: Category; provider?: Provider
}
interface HistoryEntry { id: string; task_id: string; completed_date: string; actual_cost: number | null; notes: string | null }

// ─── Constants ───────────────────────────────────────────────────────────────
const FREQ_LABELS: Record<string, string> = {
  once: 'Una vez', weekly: 'Semanal', monthly: 'Mensual', bimonthly: 'Bimestral',
  quarterly: 'Trimestral', semiannual: 'Semestral', annual: 'Anual', custom: 'Personalizado'
}
const DEFAULT_CATEGORIES = [
  { name: 'Climatización', color: '#3B82F6', icon: 'wind' },
  { name: 'Plomería',      color: '#06B6D4', icon: 'droplets' },
  { name: 'Eléctrico',     color: '#F59E0B', icon: 'zap' },
  { name: 'Jardinería',    color: '#22C55E', icon: 'leaf' },
  { name: 'General',       color: '#8B5CF6', icon: 'wrench' },
]
const CAT_COLORS = ['#3B82F6','#06B6D4','#F59E0B','#22C55E','#8B5CF6','#EF4444','#F97316','#639922','#EC4899','#6B7280']

function calcNextDate(freq: string, freqDays: number | null): string {
  const now = new Date()
  let next: Date
  switch (freq) {
    case 'weekly':     next = addWeeks(now, 1); break
    case 'monthly':    next = addMonths(now, 1); break
    case 'bimonthly':  next = addMonths(now, 2); break
    case 'quarterly':  next = addMonths(now, 3); break
    case 'semiannual': next = addMonths(now, 6); break
    case 'annual':     next = addYears(now, 1); break
    case 'custom':     next = addDays(now, freqDays ?? 30); break
    default:           next = addDays(now, 7)
  }
  return next.toISOString().split('T')[0]
}

function getTaskStatus(task: Task): 'overdue' | 'soon' | 'upcoming' | 'done' {
  if (task.status === 'done') return 'done'
  const d = new Date(task.next_date)
  const today = new Date(); today.setHours(0,0,0,0)
  if (isBefore(d, today)) return 'overdue'
  if (differenceInDays(d, today) <= 7) return 'soon'
  return 'upcoming'
}

// ─── ICS Generator ───────────────────────────────────────────────────────────
function downloadICS(task: Task) {
  const d = task.next_date.replace(/-/g, '')
  const uid = `andromeda-${task.id}@andromeda.home`
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Andrómeda//Home//ES',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART;VALUE=DATE:${d}`,
    `DTEND;VALUE=DATE:${d}`,
    `SUMMARY:🏠 ${task.title}`,
    `DESCRIPTION:Mantenimiento hogar Andrómeda${task.estimated_cost ? ` · Costo estimado $${task.estimated_cost}` : ''}${task.notes ? `\n${task.notes}` : ''}`,
    'BEGIN:VALARM', 'TRIGGER:-P1D', 'ACTION:DISPLAY', `DESCRIPTION:Recordatorio: ${task.title}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR'
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${task.title.replace(/\s+/g, '_')}.ics`
  a.click()
}

// ─── Icon component ──────────────────────────────────────────────────────────
function CatIcon({ icon, size = 14 }: { icon: string; size?: number }) {
  const s = { width: size, height: size }
  const p = { fill: 'none', stroke: 'currentColor', strokeWidth: '2', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (icon === 'wind') return <svg viewBox="0 0 24 24" style={s} {...p}><path d="M9.59 4.59A2 2 0 1111 8H2m10.59 11.41A2 2 0 1014 16H2m15.73-8.27A2.5 2.5 0 1119.5 12H2"/></svg>
  if (icon === 'droplets') return <svg viewBox="0 0 24 24" style={s} {...p}><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0014 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 01-11.91 4.97"/></svg>
  if (icon === 'zap') return <svg viewBox="0 0 24 24" style={s} {...p}><polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/></svg>
  if (icon === 'leaf') return <svg viewBox="0 0 24 24" style={s} {...p}><path d="M17 8C8 10 5.9 16.17 3.82 19.34A1 1 0 005.24 20c5.71-3.3 9-7 11-12z"/></svg>
  return <svg viewBox="0 0 24 24" style={s} {...p}><path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/></svg>
}

// ─── Mini Calendar ────────────────────────────────────────────────────────────
function MiniCalendar({ tasks, onDayClick }: { tasks: Task[]; onDayClick: (d: Date) => void }) {
  const [current, setCurrent] = useState(new Date())
  const start = startOfMonth(current)
  const end = endOfMonth(current)
  const days = eachDayOfInterval({ start, end })
  const startDow = start.getDay()

  function tasksOnDay(d: Date) {
    return tasks.filter(t => t.next_date && isSameDay(new Date(t.next_date), d))
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrent(addMonths(current, -1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15,18 9,12 15,6"/></svg>
        </button>
        <span className="text-sm font-medium text-zinc-100 capitalize">
          {format(current, 'MMMM yyyy', { locale: es })}
        </span>
        <button onClick={() => setCurrent(addMonths(current, 1))} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-800 text-zinc-400 transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,18 15,12 9,6"/></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 mb-2">
        {['Do','Lu','Ma','Mi','Ju','Vi','Sa'].map(d => (
          <div key={d} className="text-center text-xs text-zinc-600 py-1">{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {Array.from({ length: startDow }).map((_, i) => <div key={`e${i}`} />)}
        {days.map(day => {
          const dayTasks = tasksOnDay(day)
          const today = isToday(day)
          const hasOverdue = dayTasks.some(t => getTaskStatus(t) === 'overdue')
          const hasSoon = dayTasks.some(t => getTaskStatus(t) === 'soon')
          const hasUpcoming = dayTasks.some(t => getTaskStatus(t) === 'upcoming')
          return (
            <div key={day.toISOString()} onClick={() => dayTasks.length > 0 && onDayClick(day)}
              className={clsx('relative flex flex-col items-center py-1 rounded-lg transition-colors',
                dayTasks.length > 0 && 'cursor-pointer hover:bg-zinc-800',
                today && 'bg-andromeda-800/40')}>
              <span className={clsx('text-xs', today ? 'text-andromeda-200 font-medium' : 'text-zinc-400')}>
                {format(day, 'd')}
              </span>
              {dayTasks.length > 0 && (
                <div className="flex gap-0.5 mt-0.5">
                  {hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-red-400" />}
                  {hasSoon && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                  {hasUpcoming && <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#97C459' }} />}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-zinc-800">
        {[['bg-red-400','Vencida'],['bg-amber-400','Esta semana'],['bg-[#97C459]','Programada']].map(([c,l]) => (
          <div key={l} className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${c}`} />
            <span className="text-xs text-zinc-500">{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Task Form Modal ──────────────────────────────────────────────────────────
function TaskModal({ task, categories, providers, onSave, onClose, userId }: {
  task?: Task | null; categories: Category[]; providers: Provider[]
  onSave: () => void; onClose: () => void; userId: string
}) {
  const [form, setForm] = useState({
    title: task?.title ?? '',
    category_id: task?.category_id ?? '',
    frequency: task?.frequency ?? 'quarterly',
    frequency_days: task?.frequency_days ?? 30,
    next_date: task?.next_date ?? new Date().toISOString().split('T')[0],
    estimated_cost: task?.estimated_cost ?? '',
    notes: task?.notes ?? '',
    provider_id: task?.provider_id ?? '',
  })
  const [saving, setSaving] = useState(false)

  async function save() {
    if (!form.title || !form.next_date) return
    setSaving(true)
    const body = {
      ...form,
      user_id: userId,
      category_id: form.category_id || null,
      provider_id: form.provider_id || null,
      estimated_cost: form.estimated_cost ? Number(form.estimated_cost) : null,
      frequency_days: form.frequency === 'custom' ? Number(form.frequency_days) : null,
      status: 'pending',
    }
    if (task?.id) {
      await fetch('/api/mantenimiento/tasks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...body, id: task.id }) })
    } else {
      await fetch('/api/mantenimiento/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    }
    setSaving(false); onSave()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
          <h3 className="text-sm font-medium text-zinc-100">{task ? 'Editar tarea' : 'Nueva tarea'}</h3>
          <button onClick={onClose} className="text-zinc-600 hover:text-zinc-300 transition-colors">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
          <div>
            <label className="label">Nombre de la tarea</label>
            <input className="input" value={form.title} onChange={e => setForm(f => ({...f,title:e.target.value}))} placeholder="ej: Servicio AC principal" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Categoría</label>
              <select className="input" value={form.category_id} onChange={e => setForm(f => ({...f,category_id:e.target.value}))}>
                <option value="">Sin categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Recurrencia</label>
              <select className="input" value={form.frequency} onChange={e => setForm(f => ({...f,frequency:e.target.value}))}>
                {Object.entries(FREQ_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          {form.frequency === 'custom' && (
            <div>
              <label className="label">Cada cuántos días</label>
              <input type="number" className="input" value={form.frequency_days} onChange={e => setForm(f => ({...f,frequency_days:Number(e.target.value)}))} min="1" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Próxima fecha</label>
              <input type="date" className="input" value={form.next_date} onChange={e => setForm(f => ({...f,next_date:e.target.value}))} />
            </div>
            <div>
              <label className="label">Costo estimado</label>
              <input type="number" className="input" value={form.estimated_cost} onChange={e => setForm(f => ({...f,estimated_cost:e.target.value}))} placeholder="$0.00" />
            </div>
          </div>
          <div>
            <label className="label">Proveedor (opcional)</label>
            <select className="input" value={form.provider_id} onChange={e => setForm(f => ({...f,provider_id:e.target.value}))}>
              <option value="">Sin proveedor</option>
              {providers.map(p => <option key={p.id} value={p.id}>{p.name} · {p.category}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Notas</label>
            <textarea className="input" rows={2} value={form.notes ?? ''} onChange={e => setForm(f => ({...f,notes:e.target.value}))} placeholder="Instrucciones, recordatorios..." />
          </div>
        </div>
        <div className="flex gap-3 px-6 py-4 border-t border-zinc-800">
          <button onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={save} className="btn-primary flex-1" disabled={saving || !form.title}>
            {saving ? 'Guardando...' : task ? 'Guardar cambios' : 'Crear tarea'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Complete Modal ───────────────────────────────────────────────────────────
function CompleteModal({ task, onConfirm, onClose }: { task: Task; onConfirm: (cost: number|null, notes: string) => void; onClose: () => void }) {
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <h3 className="text-sm font-medium text-zinc-100 mb-1">Marcar como completada</h3>
        <p className="text-xs text-zinc-500 mb-4">{task.title}</p>
        <div className="space-y-3">
          <div>
            <label className="label">Costo real (opcional)</label>
            <input type="number" className="input" placeholder="$0.00" value={cost} onChange={e => setCost(e.target.value)} />
          </div>
          <div>
            <label className="label">Notas (opcional)</label>
            <textarea className="input" rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones del servicio..." />
          </div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={() => onConfirm(cost ? Number(cost) : null, notes)} className="btn-primary flex-1">Completar</button>
        </div>
      </div>
    </div>
  )
}

// ─── Next Proposal Banner ────────────────────────────────────────────────────
function ProposalBanner({ task, nextDate, onConfirm, onDismiss }: { task: Task; nextDate: string; onConfirm: (d: string) => void; onDismiss: () => void }) {
  const [customDate, setCustomDate] = useState(nextDate)
  const [editing, setEditing] = useState(false)
  return (
    <div className="bg-andromeda-800/30 border border-andromeda-600/40 rounded-xl p-4 flex items-center gap-4">
      <div className="w-9 h-9 bg-andromeda-800/60 rounded-lg flex items-center justify-center shrink-0">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#97C459" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-andromeda-200">{task.title} — siguiente ocurrencia</p>
        {editing ? (
          <input type="date" className="input mt-1 text-xs py-1" value={customDate} onChange={e => setCustomDate(e.target.value)} />
        ) : (
          <p className="text-xs text-zinc-400 mt-0.5">
            Propuesta: {format(new Date(nextDate), "d 'de' MMMM yyyy", { locale: es })}
            <button onClick={() => setEditing(true)} className="ml-2 text-andromeda-400 underline">cambiar</button>
          </p>
        )}
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={() => onConfirm(customDate)} className="btn-primary text-xs px-3 py-2">Confirmar</button>
        <button onClick={onDismiss} className="btn-ghost text-xs px-3 py-2">Descartar</button>
      </div>
    </div>
  )
}

// ─── Provider Card ────────────────────────────────────────────────────────────
function ProviderCard({ p, onEdit, onDelete }: { p: Provider; onEdit: () => void; onDelete: () => void }) {
  const initials = p.name.split(' ').slice(0,2).map(w => w[0]).join('').toUpperCase()
  const waUrl = p.whatsapp_number ? `https://wa.me/52${p.whatsapp_number.replace(/\D/g,'')}` : null
  return (
    <div className="bg-zinc-800/50 rounded-xl p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-full bg-andromeda-800/60 border border-andromeda-600/30 flex items-center justify-center text-xs font-medium text-andromeda-200 shrink-0">{initials}</div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-zinc-100 truncate">{p.name}</p>
          <p className="text-xs text-zinc-500 truncate">{p.category}{p.phone ? ` · ${p.phone}` : ''}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-700 text-zinc-500 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-zinc-700 text-zinc-500 hover:text-red-400 transition-colors">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/></svg>
          </button>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-600">{p.services_count} servicio{p.services_count !== 1 ? 's' : ''}</span>
        {waUrl ? (
          <a href={waUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs bg-andromeda-800/40 text-andromeda-300 border border-andromeda-600/30 rounded-lg px-2.5 py-1.5 hover:bg-andromeda-800/60 transition-colors">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z"/></svg>
            WhatsApp
          </a>
        ) : <span className="text-xs text-zinc-700">Sin WhatsApp</span>}
      </div>
    </div>
  )
}

// ─── Provider Modal ───────────────────────────────────────────────────────────
function ProviderModal({ prov, onSave, onClose, userId }: { prov?: Provider|null; onSave: ()=>void; onClose: ()=>void; userId: string }) {
  const [form, setForm] = useState({ name: prov?.name??'', category: prov?.category??'', phone: prov?.phone??'', whatsapp_number: prov?.whatsapp_number??'', notes: prov?.notes??'' })
  const [saving, setSaving] = useState(false)
  async function save() {
    if (!form.name) return; setSaving(true)
    const body = { ...form, user_id: userId }
    if (prov?.id) await fetch('/api/mantenimiento/providers', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...body,id:prov.id}) })
    else await fetch('/api/mantenimiento/providers', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    setSaving(false); onSave()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm shadow-2xl p-6">
        <h3 className="text-sm font-medium text-zinc-100 mb-4">{prov ? 'Editar proveedor' : 'Nuevo proveedor'}</h3>
        <div className="space-y-3">
          <div><label className="label">Nombre</label><input className="input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Juan Ramírez" /></div>
          <div><label className="label">Especialidad</label><input className="input" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="Plomero, Electricista..." /></div>
          <div><label className="label">Teléfono</label><input className="input" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} placeholder="811-234-5678" /></div>
          <div><label className="label">WhatsApp (solo números con lada)</label><input className="input" value={form.whatsapp_number} onChange={e=>setForm(f=>({...f,whatsapp_number:e.target.value}))} placeholder="8112345678" /></div>
          <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="Referencias, observaciones..." /></div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={onClose} className="btn-ghost flex-1">Cancelar</button>
          <button onClick={save} className="btn-primary flex-1" disabled={saving||!form.name}>{saving?'Guardando...':prov?'Guardar':'Agregar'}</button>
        </div>
      </div>
    </div>
  )
}

// ─── Category Manager ─────────────────────────────────────────────────────────
function CategoryManager({ categories, userId, onUpdate }: { categories: Category[]; userId: string; onUpdate: ()=>void }) {
  const [editing, setEditing] = useState<Category|null>(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name:'', color: CAT_COLORS[0] })

  async function save() {
    if (!form.name) return
    const body = { ...form, user_id: userId, icon: 'wrench' }
    if (editing) await fetch('/api/mantenimiento/categories', { method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify({...body,id:editing.id}) })
    else await fetch('/api/mantenimiento/categories', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) })
    setAdding(false); setEditing(null); setForm({name:'',color:CAT_COLORS[0]}); onUpdate()
  }
  async function del(id: string) {
    await fetch('/api/mantenimiento/categories', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id,user_id:userId}) })
    onUpdate()
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Categorías</h3>
        <button onClick={()=>setAdding(true)} className="text-xs text-andromeda-400 hover:text-andromeda-200 transition-colors">+ Agregar</button>
      </div>
      <div className="space-y-2">
        {categories.map(c => (
          <div key={c.id} className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full shrink-0" style={{background:c.color}}/>
            <span className="text-sm text-zinc-300 flex-1">{c.name}</span>
            <button onClick={()=>{setEditing(c);setForm({name:c.name,color:c.color});setAdding(true)}} className="text-xs text-zinc-600 hover:text-zinc-300 transition-colors">Editar</button>
            <button onClick={()=>del(c.id)} className="text-xs text-zinc-700 hover:text-red-400 transition-colors">✕</button>
          </div>
        ))}
      </div>
      {adding && (
        <div className="mt-3 pt-3 border-t border-zinc-800 space-y-2">
          <input className="input text-sm" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Nombre de categoría" />
          <div className="flex gap-2 flex-wrap">
            {CAT_COLORS.map(c => (
              <button key={c} onClick={()=>setForm(f=>({...f,color:c}))}
                className={clsx('w-6 h-6 rounded-full transition-all',form.color===c?'ring-2 ring-white ring-offset-1 ring-offset-zinc-900':'')}
                style={{background:c}}/>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={()=>{setAdding(false);setEditing(null)}} className="btn-ghost flex-1 text-xs py-1.5">Cancelar</button>
            <button onClick={save} className="btn-primary flex-1 text-xs py-1.5">Guardar</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function MantenimientoPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [providers, setProviders] = useState<Provider[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState('')
  const [view, setView] = useState<'list'|'calendar'>('list')
  const [filterCat, setFilterCat] = useState<string>('all')
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [editingTask, setEditingTask] = useState<Task|null>(null)
  const [completingTask, setCompletingTask] = useState<Task|null>(null)
  const [proposal, setProposal] = useState<{task:Task;nextDate:string}|null>(null)
  const [showProviders, setShowProviders] = useState(false)
  const [showProviderModal, setShowProviderModal] = useState(false)
  const [editingProvider, setEditingProvider] = useState<Provider|null>(null)
  const [deleteProvider, setDeleteProvider] = useState<Provider|null>(null)
  const [selectedDayTasks, setSelectedDayTasks] = useState<Task[]|null>(null)
  const [selectedDay, setSelectedDay] = useState<Date|null>(null)
  const supabase = createClient()

  async function loadAll() {
    const {data:{user}} = await supabase.auth.getUser()
    if (!user) return
    setUserId(user.id)
    const [tc, tp, tt] = await Promise.all([
      supabase.from('andromeda_categories').select('*').eq('user_id', user.id).order('name'),
      supabase.from('andromeda_providers').select('*').eq('user_id', user.id).order('name'),
      supabase.from('andromeda_tasks').select('*').eq('user_id', user.id).order('next_date'),
    ])
    const cats = (tc.data ?? []) as Category[]
    const provs = (tp.data ?? []) as Provider[]
    let rawTasks = (tt.data ?? []) as Task[]

    // Auto-create default categories if none
    if (cats.length === 0) {
      for (const dc of DEFAULT_CATEGORIES) {
        const {data:nc} = await supabase.from('andromeda_categories').insert({...dc,user_id:user.id}).select().single()
        if (nc) cats.push(nc as Category)
      }
    }

    // Enrich tasks
    rawTasks = rawTasks.map(t => ({
      ...t,
      category: cats.find(c => c.id === t.category_id),
      provider: provs.find(p => p.id === t.provider_id),
    }))

    // Update overdue status
    const today = new Date(); today.setHours(0,0,0,0)
    for (const t of rawTasks) {
      if (t.status === 'pending' && isBefore(new Date(t.next_date), today)) {
        await supabase.from('andromeda_tasks').update({status:'overdue'}).eq('id',t.id)
        t.status = 'overdue'
      }
    }

    setCategories(cats); setProviders(provs); setTasks(rawTasks); setLoading(false)
  }

  useEffect(()=>{ loadAll() },[])

  async function handleComplete(cost: number|null, notes: string) {
    if (!completingTask) return
    const res = await fetch('/api/mantenimiento/complete', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ task_id: completingTask.id, user_id: userId, actual_cost: cost, notes })
    })
    const data = await res.json()
    setCompletingTask(null)
    if (data.nextDate && completingTask.frequency !== 'once') {
      setProposal({ task: completingTask, nextDate: data.nextDate })
    }
    loadAll()
  }

  async function confirmProposal(date: string) {
    if (!proposal) return
    await fetch('/api/mantenimiento/tasks', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        user_id: userId,
        title: proposal.task.title,
        category_id: proposal.task.category_id,
        frequency: proposal.task.frequency,
        frequency_days: proposal.task.frequency_days,
        next_date: date,
        estimated_cost: proposal.task.estimated_cost,
        notes: proposal.task.notes,
        provider_id: proposal.task.provider_id,
        status: 'pending',
      })
    })
    setProposal(null); loadAll()
  }

  async function deleteTask(id: string) {
    await fetch('/api/mantenimiento/tasks', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id,user_id:userId}) })
    loadAll()
  }

  async function doDeleteProvider() {
    if (!deleteProvider) return
    await fetch('/api/mantenimiento/providers', { method:'DELETE', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:deleteProvider.id,user_id:userId}) })
    setDeleteProvider(null); loadAll()
  }

  const overdue   = tasks.filter(t => getTaskStatus(t) === 'overdue')
  const soon      = tasks.filter(t => getTaskStatus(t) === 'soon')
  const upcoming  = tasks.filter(t => getTaskStatus(t) === 'upcoming')
  const done      = tasks.filter(t => getTaskStatus(t) === 'done')
  const estMonth  = tasks.filter(t => t.status !== 'done').reduce((s,t) => s + (Number(t.estimated_cost)||0), 0)

  const filtered = (list: Task[]) => filterCat === 'all' ? list : list.filter(t => t.category_id === filterCat)

  function TaskRow({ t }: { t: Task }) {
    const st = getTaskStatus(t)
    const dotColor = st==='overdue'?'bg-red-400':st==='soon'?'bg-amber-400':st==='done'?'bg-zinc-600':'bg-andromeda-400'
    const dateLabel = st==='overdue'
      ? `Vencida · hace ${differenceInDays(new Date(), new Date(t.next_date))} días`
      : st==='soon'
      ? differenceInDays(new Date(t.next_date), new Date())===0 ? 'Hoy' : `En ${differenceInDays(new Date(t.next_date), new Date())} días · ${format(new Date(t.next_date),'d MMM',{locale:es})}`
      : format(new Date(t.next_date),'d MMM yyyy',{locale:es})
    const badgeCls = st==='overdue'?'bg-red-500/15 text-red-400':st==='soon'?'bg-amber-500/15 text-amber-400':st==='done'?'bg-zinc-700 text-zinc-500':'bg-andromeda-800/40 text-andromeda-300'

    return (
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800 last:border-0 hover:bg-zinc-800/20 transition-colors group">
        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}/>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-zinc-200">{t.title}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full ${badgeCls}`}>{dateLabel}</span>
            {t.category && <span className="text-xs px-2 py-0.5 rounded" style={{background:t.category.color+'22',color:t.category.color}}>{t.category.name}</span>}
            <span className="text-xs text-zinc-600">{FREQ_LABELS[t.frequency]}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {t.estimated_cost && <span className="text-xs text-zinc-500">${Number(t.estimated_cost).toLocaleString('es-MX')}</span>}
          {st !== 'done' && (
            <>
              <button onClick={()=>setCompletingTask(t)} title="Marcar como hecha"
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-andromeda-600/30 text-andromeda-400 hover:bg-andromeda-800/40 transition-colors opacity-0 group-hover:opacity-100">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20,6 9,17 4,12"/></svg>
              </button>
              <button onClick={()=>downloadICS(t)} title="Agregar a calendario Apple"
                className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors opacity-0 group-hover:opacity-100">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
              </button>
            </>
          )}
          <button onClick={()=>{setEditingTask(t);setShowTaskModal(true)}} title="Editar"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-500 transition-colors opacity-0 group-hover:opacity-100">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button onClick={()=>deleteTask(t.id)} title="Eliminar"
            className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:text-red-400 hover:border-red-500/30 transition-colors opacity-0 group-hover:opacity-100">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/></svg>
          </button>
        </div>
      </div>
    )
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-2 border-andromeda-400 border-t-transparent rounded-full animate-spin"/></div>

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-100">Mantenimiento</h1>
          <p className="text-zinc-500 text-sm mt-0.5">{tasks.filter(t=>t.status!=='done').length} tareas activas</p>
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-lg overflow-hidden border border-zinc-700">
            <button onClick={()=>setView('list')} className={clsx('px-3 py-2 text-xs transition-colors',view==='list'?'bg-andromeda-800/60 text-andromeda-200':'text-zinc-500 hover:text-zinc-300')}>Lista</button>
            <button onClick={()=>setView('calendar')} className={clsx('px-3 py-2 text-xs transition-colors border-l border-zinc-700',view==='calendar'?'bg-andromeda-800/60 text-andromeda-200':'text-zinc-500 hover:text-zinc-300')}>Calendario</button>
          </div>
          <button onClick={()=>{setEditingTask(null);setShowTaskModal(true)}} className="btn-primary">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Nueva tarea
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          {label:'Vencidas',val:overdue.length,color:'text-red-400'},
          {label:'Esta semana',val:soon.length,color:'text-amber-400'},
          {label:'Programadas',val:upcoming.length,color:'text-andromeda-200'},
          {label:'Gasto estimado',val:`$${estMonth.toLocaleString('es-MX')}`,color:'text-zinc-100'},
        ].map(s=>(
          <div key={s.label} className="card flex flex-col gap-1">
            <span className="text-xs text-zinc-500 uppercase tracking-wide">{s.label}</span>
            <span className={`text-2xl font-semibold ${s.color}`}>{s.val}</span>
          </div>
        ))}
      </div>

      {/* Proposal banner */}
      {proposal && (
        <ProposalBanner task={proposal.task} nextDate={proposal.nextDate}
          onConfirm={confirmProposal} onDismiss={()=>setProposal(null)} />
      )}

      {/* Calendar / List */}
      {view === 'calendar' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <MiniCalendar tasks={tasks} onDayClick={d=>{setSelectedDay(d);setSelectedDayTasks(tasks.filter(t=>t.next_date&&isSameDay(new Date(t.next_date),d)))}} />
          </div>
          <div className="card">
            <h3 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">
              {selectedDay ? format(selectedDay,'d MMM yyyy',{locale:es}) : 'Selecciona un día'}
            </h3>
            {!selectedDayTasks || selectedDayTasks.length===0 ? (
              <p className="text-xs text-zinc-600">Sin tareas este día</p>
            ) : selectedDayTasks.map(t=>(
              <div key={t.id} className="py-2 border-b border-zinc-800 last:border-0">
                <p className="text-sm text-zinc-200">{t.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{t.category?.name ?? 'Sin categoría'}</p>
              </div>
            ))}
          </div>
          <div className="lg:col-span-3">
            <CategoryManager categories={categories} userId={userId} onUpdate={loadAll}/>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            {/* Filter row */}
            <div className="flex gap-2 flex-wrap">
              <button onClick={()=>setFilterCat('all')} className={clsx('text-xs px-2.5 py-1 rounded-full border transition-colors',filterCat==='all'?'bg-andromeda-800/60 text-andromeda-200 border-andromeda-600/40':'text-zinc-500 hover:text-zinc-300 border-transparent')}>Todas</button>
              {categories.map(c=>(
                <button key={c.id} onClick={()=>setFilterCat(c.id)}
                  className={clsx('text-xs px-2.5 py-1 rounded-full border transition-colors',filterCat===c.id?'text-white border-transparent':'text-zinc-500 hover:text-zinc-300 border-transparent')}
                  style={filterCat===c.id?{background:c.color+'33',borderColor:c.color+'66',color:c.color}:{}}>
                  {c.name}
                </button>
              ))}
            </div>

            {/* Overdue */}
            {filtered(overdue).length > 0 && (
              <div className="card p-0 overflow-hidden border-red-500/20">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-red-400"/>
                  <span className="text-sm font-medium text-red-400">Vencidas · {filtered(overdue).length}</span>
                </div>
                {filtered(overdue).map(t=><TaskRow key={t.id} t={t}/>)}
              </div>
            )}

            {/* Soon */}
            {filtered(soon).length > 0 && (
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-400"/>
                  <span className="text-sm font-medium text-amber-400">Esta semana · {filtered(soon).length}</span>
                </div>
                {filtered(soon).map(t=><TaskRow key={t.id} t={t}/>)}
              </div>
            )}

            {/* Upcoming */}
            {filtered(upcoming).length > 0 && (
              <div className="card p-0 overflow-hidden">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-andromeda-400"/>
                  <span className="text-sm font-medium text-zinc-300">Programadas · {filtered(upcoming).length}</span>
                </div>
                {filtered(upcoming).map(t=><TaskRow key={t.id} t={t}/>)}
              </div>
            )}

            {/* Done */}
            {filtered(done).length > 0 && (
              <div className="card p-0 overflow-hidden opacity-60">
                <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-zinc-600"/>
                  <span className="text-sm font-medium text-zinc-500">Completadas · {filtered(done).length}</span>
                </div>
                {filtered(done).map(t=><TaskRow key={t.id} t={t}/>)}
              </div>
            )}

            {tasks.length === 0 && (
              <div className="card text-center py-12">
                <p className="text-zinc-500 text-sm mb-3">Sin tareas de mantenimiento aún</p>
                <button onClick={()=>{setEditingTask(null);setShowTaskModal(true)}} className="btn-primary">Crear primera tarea</button>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          <div className="space-y-4">
            <CategoryManager categories={categories} userId={userId} onUpdate={loadAll}/>

            {/* Providers */}
            <div className="card p-0 overflow-hidden">
              <button onClick={()=>setShowProviders(v=>!v)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/30 transition-colors">
                <span className="text-xs font-medium text-zinc-400 uppercase tracking-wide">Proveedores · {providers.length}</span>
                <div className="flex items-center gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#71717a" strokeWidth="2" className={clsx('transition-transform',showProviders&&'rotate-180')}><polyline points="6,9 12,15 18,9"/></svg>
                </div>
              </button>
              {showProviders && (
                <div className="p-3 pt-0 space-y-2">
                  {providers.map(p=>(
                    <ProviderCard key={p.id} p={p} onEdit={()=>{setEditingProvider(p);setShowProviderModal(true)}} onDelete={()=>setDeleteProvider(p)}/>
                  ))}
                  <button onClick={()=>{setEditingProvider(null);setShowProviderModal(true)}} className="btn-ghost w-full text-xs py-2">+ Agregar proveedor</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {showTaskModal && (
        <TaskModal task={editingTask} categories={categories} providers={providers} userId={userId}
          onSave={()=>{setShowTaskModal(false);setEditingTask(null);loadAll()}}
          onClose={()=>{setShowTaskModal(false);setEditingTask(null)}} />
      )}
      {completingTask && (
        <CompleteModal task={completingTask} onConfirm={handleComplete} onClose={()=>setCompletingTask(null)}/>
      )}
      {showProviderModal && (
        <ProviderModal prov={editingProvider} userId={userId}
          onSave={()=>{setShowProviderModal(false);setEditingProvider(null);loadAll()}}
          onClose={()=>{setShowProviderModal(false);setEditingProvider(null)}} />
      )}
      {deleteProvider && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-sm p-6">
            <h3 className="text-sm font-medium text-zinc-100 mb-2">¿Eliminar proveedor?</h3>
            <p className="text-xs text-zinc-500 mb-4">{deleteProvider.name}</p>
            <div className="flex gap-3">
              <button onClick={()=>setDeleteProvider(null)} className="btn-ghost flex-1">Cancelar</button>
              <button onClick={doDeleteProvider} className="flex-1 bg-red-500/10 text-red-400 border border-red-500/20 text-sm font-medium px-4 py-2.5 rounded-lg transition-colors hover:bg-red-500/20">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
