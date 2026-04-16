'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import clsx from 'clsx'

const navItems = [
  {
    href: '/dashboard',
    label: 'Inicio',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/>
      </svg>
    ),
  },
  {
    href: '/recibos',
    label: 'Recibos',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/>
      </svg>
    ),
  },
  {
    href: '/energia',
    label: 'Energía',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="13,2 3,14 12,14 11,22 21,10 12,10 13,2"/>
      </svg>
    ),
    badge: 'pronto',
  },
  {
    href: '/mantenimiento',
    label: 'Mantenimiento',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
      </svg>
    ),
    badge: 'pronto',
  },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <aside className="w-56 shrink-0 bg-zinc-900 border-r border-zinc-800 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-zinc-800">
        <div className="w-8 h-8 rounded-lg bg-andromeda-800 flex items-center justify-center border border-andromeda-600/40">
          <svg width="18" height="18" viewBox="0 0 96 96" fill="none">
            <path d="M48 14L18 40H28V78H44V58H52V78H68V40H78L48 14Z" fill="#97C459"/>
            <circle cx="48" cy="30" r="4" fill="#C0DD97"/>
            <circle cx="64" cy="23" r="2.5" fill="#639922" opacity="0.9"/>
            <circle cx="33" cy="22" r="2" fill="#639922" opacity="0.8"/>
            <line x1="48" y1="30" x2="64" y2="23" stroke="#C0DD97" strokeWidth="1" opacity="0.5"/>
            <line x1="48" y1="30" x2="33" y2="22" stroke="#C0DD97" strokeWidth="1" opacity="0.45"/>
          </svg>
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-100 leading-none">Andrómeda</p>
          <p className="text-xs text-zinc-500 mt-0.5">hogar</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {navItems.map(item => (
          <Link
            key={item.href}
            href={item.badge ? '#' : item.href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors group',
              pathname === item.href
                ? 'bg-andromeda-800/60 text-andromeda-100 border border-andromeda-600/30'
                : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800',
              item.badge && 'opacity-50 cursor-not-allowed'
            )}
            onClick={item.badge ? e => e.preventDefault() : undefined}
          >
            <span className={pathname === item.href ? 'text-andromeda-200' : 'text-zinc-500 group-hover:text-zinc-300'}>
              {item.icon}
            </span>
            <span className="flex-1">{item.label}</span>
            {item.badge && (
              <span className="text-[10px] bg-zinc-700 text-zinc-400 px-1.5 py-0.5 rounded-full">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-zinc-800">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800 transition-colors w-full"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/>
          </svg>
          Salir
        </button>
      </div>
    </aside>
  )
}
