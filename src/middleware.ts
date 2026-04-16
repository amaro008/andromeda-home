import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Las rutas de API manejan su propio auth — no interceptar
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  const allCookies = request.cookies.getAll()
  const hasSession = allCookies.some(c =>
    c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
  )

  const protectedPaths = ['/dashboard', '/recibos', '/mantenimiento', '/energia']
  const isProtected = protectedPaths.some(p => pathname.startsWith(p))

  if (isProtected && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  if (pathname === '/login' && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
