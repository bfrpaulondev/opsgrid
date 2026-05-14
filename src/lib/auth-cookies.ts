import { NextResponse } from 'next/server'

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
}

export function setAuthCookies(
  response: NextResponse,
  accessToken: string,
  refreshToken: string
): NextResponse {
  response.cookies.set('access_token', accessToken, {
    ...COOKIE_OPTIONS,
    maxAge: 15 * 60, // 15 minutes
  })
  response.cookies.set('refresh_token', refreshToken, {
    ...COOKIE_OPTIONS,
    maxAge: 7 * 24 * 60 * 60, // 7 days
  })
  return response
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.set('access_token', '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  })
  response.cookies.set('refresh_token', '', {
    ...COOKIE_OPTIONS,
    maxAge: 0,
  })
  return response
}
