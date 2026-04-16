import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Rutas protegidas — verificar cookie de Supabase manualmente
  const protectedPaths = ['/dashboard', '/recibos', '/mantenimiento', '/energia']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  // Supabase guarda la sesión en una cookie con este patrón
  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  console.log('[middleware]', pathname, '| hasSession:', hasSession, '| cookies:', allCookies.map(c => c.name).join(', '))

  if (isProtected && !hasSession) {
    console.log('[middleware] blocking — redirecting to login')
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/login' && hasSession) {
    console.log('[middleware] already authed — redirecting to dashboard')
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
