import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, signAccessToken, signRefreshToken } from '@/lib/auth'
import { setAuthCookies, clearAuthCookies } from '@/lib/auth-cookies'

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get('refresh_token')?.value

  if (!refreshToken) {
    const response = NextResponse.json(
      { message: 'No refresh token' },
      { status: 401 }
    )
    return clearAuthCookies(response)
  }

  const payload = await verifyToken(refreshToken)

  if (!payload) {
    const response = NextResponse.json(
      { message: 'Invalid refresh token' },
      { status: 401 }
    )
    return clearAuthCookies(response)
  }

  // Issue new tokens
  const tokenPayload = {
    userId: payload.userId,
    email: payload.email,
    role: payload.role,
    collaboratorId: payload.collaboratorId,
  }

  const newAccessToken = await signAccessToken(tokenPayload)
  const newRefreshToken = await signRefreshToken(tokenPayload)

  const response = NextResponse.json({ message: 'Tokens refreshed' })
  return setAuthCookies(response, newAccessToken, newRefreshToken)
}
