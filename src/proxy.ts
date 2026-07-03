import { NextRequest, NextResponse } from 'next/server'

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isPublic = pathname.startsWith('/login') || pathname.startsWith('/api/auth')
  if (!isPublic) {
    const auth = req.cookies.get('matrix_auth')
    if (!auth || auth.value !== 'true') {
      const loginUrl = new URL('/login', req.url)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
