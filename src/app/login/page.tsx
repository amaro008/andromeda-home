'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Credenciales incorrectas. Verifica tu email y contraseña.')
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                        w-[600px] h-[600px] rounded-full opacity-10"
             style={{ background: 'radial-gradient(circle, #639922 0%, transparent 70%)' }} />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-andromeda-800 flex items-center justify-center mb-4 border border-andromeda-600/40">
            <svg width="36" height="36" viewBox="0 0 96 96" fill="none">
              <path d="M48 14L18 40H28V78H44V58H52V78H68V40H78L48 14Z" fill="#97C459"/>
              <circle cx="48" cy="30" r="4" fill="#C0DD97"/>
              <circle cx="64" cy="23" r="2.5" fill="#639922" opacity="0.9"/>
              <circle cx="73" cy="35" r="1.8" fill="#639922" opacity="0.7"/>
              <circle cx="33" cy="22" r="2" fill="#639922" opacity="0.8"/>
              <line x1="48" y1="30" x2="64" y2="23" stroke="#C0DD97" strokeWidth="0.8" opacity="0.5"/>
              <line x1="48" y1="30" x2="73" y2="35" stroke="#C0DD97" strokeWidth="0.6" opacity="0.4"/>
              <line x1="48" y1="30" x2="33" y2="22" stroke="#C0DD97" strokeWidth="0.7" opacity="0.45"/>
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-100 tracking-tight">Andrómeda</h1>
          <p className="text-zinc-500 text-sm mt-1">Control de hogar</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="card space-y-4">
          <div>
            <label className="label">Email</label>
            <input
              type="email"
              className="input"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <label className="label">Contraseña</label>
            <input
              type="password"
              className="input"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>

          {error && (
            <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-zinc-600 text-xs mt-6">
          Acceso restringido — solo miembros del hogar
        </p>
      </div>
    </div>
  )
}
