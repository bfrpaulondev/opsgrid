import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { comparePassword } from '@/lib/auth'
import { signAccessToken, signRefreshToken } from '@/lib/auth'
import { setAuthCookies } from '@/lib/auth-cookies'
import { loginSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Email e palavra-passe são obrigatórios' },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json(
        { message: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    const isValid = await comparePassword(password, user.passwordHash)
    if (!isValid) {
      return NextResponse.json(
        { message: 'Credenciais inválidas' },
        { status: 401 }
      )
    }

    const tokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      collaboratorId: user.collaboratorId || null,
    }

    const accessToken = await signAccessToken(tokenPayload)
    const refreshToken = await signRefreshToken(tokenPayload)

    const userData = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      collaboratorId: user.collaboratorId,
    }

    const response = NextResponse.json(userData)
    return setAuthCookies(response, accessToken, refreshToken)
  } catch {
    return NextResponse.json(
      { message: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
