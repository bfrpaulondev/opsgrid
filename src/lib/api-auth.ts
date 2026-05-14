import { NextRequest, NextResponse } from 'next/server'
import { verifyToken, type TokenPayload } from './auth'

export interface AuthResult {
  success: true
  user: TokenPayload
}

export interface AuthError {
  success: false
  response: NextResponse
}

export async function getAuthUser(
  request: NextRequest
): Promise<AuthResult | AuthError> {
  const token = request.cookies.get('access_token')?.value

  if (!token) {
    return {
      success: false,
      response: NextResponse.json(
        { message: 'Authentication required' },
        { status: 401 }
      ),
    }
  }

  const payload = await verifyToken(token)

  if (!payload) {
    return {
      success: false,
      response: NextResponse.json(
        { message: 'Invalid or expired token' },
        { status: 401 }
      ),
    }
  }

  return { success: true, user: payload }
}

export async function requireAuth(
  request: NextRequest
): Promise<AuthResult | AuthError> {
  return getAuthUser(request)
}

export async function requireLeader(
  request: NextRequest
): Promise<AuthResult | AuthError> {
  const authResult = await getAuthUser(request)

  if (!authResult.success) {
    return authResult
  }

  if (authResult.user.role !== 'LEADER') {
    return {
      success: false,
      response: NextResponse.json(
        { message: 'Leader access required' },
        { status: 403 }
      ),
    }
  }

  return authResult
}
