import { NextResponse } from 'next/server'
import { clearAuthCookies } from '@/lib/auth-cookies'

export async function POST() {
  const response = NextResponse.json({ message: 'Sessão terminada' })
  return clearAuthCookies(response)
}
