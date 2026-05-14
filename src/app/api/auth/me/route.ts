import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { db } from '@/lib/db'

export async function GET(request: NextRequest) {
  const authResult = await getAuthUser(request)

  if (!authResult.success) {
    return authResult.response
  }

  // Fetch full user data from DB for the name
  const user = await db.user.findUnique({
    where: { id: authResult.user.userId },
    select: { id: true, email: true, name: true, role: true, collaboratorId: true },
  })

  if (!user) {
    return NextResponse.json(
      { message: 'User not found' },
      { status: 401 }
    )
  }

  return NextResponse.json(user)
}
