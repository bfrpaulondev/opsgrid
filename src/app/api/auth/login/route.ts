import { NextRequest, NextResponse } from 'next/server'
import { connectDB } from '@/lib/db'
import { User } from '@/models/User'
import { comparePassword } from '@/lib/auth'
import { signAccessToken, signRefreshToken } from '@/lib/auth'
import { setAuthCookies } from '@/lib/auth-cookies'
import { loginSchema } from '@/lib/validations'

export async function POST(request: NextRequest) {
  try {
    await connectDB()

    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Email e palavra-passe são obrigatórios' },
        { status: 400 }
      )
    }

    const { email, password } = parsed.data

    const user = await User.findOne({ email: email.toLowerCase() })

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
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      collaboratorId: user.collaboratorId ? user.collaboratorId.toString() : null,
    }

    const accessToken = await signAccessToken(tokenPayload)
    const refreshToken = await signRefreshToken(tokenPayload)

    const userData = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role,
      collaboratorId: user.collaboratorId ? user.collaboratorId.toString() : null,
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
