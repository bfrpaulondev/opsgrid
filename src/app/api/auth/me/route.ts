import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/api-auth'
import { connectDB } from '@/lib/db'
import { User } from '@/models/User'

export async function GET(request: NextRequest) {
  const authResult = await getAuthUser(request)

  if (!authResult.success) {
    return authResult.response
  }

  await connectDB()

  const user = await User.findById(authResult.user.userId).select(
    'email name role collaboratorId'
  )

  if (!user) {
    return NextResponse.json(
      { message: 'User not found' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    collaboratorId: user.collaboratorId ? user.collaboratorId.toString() : null,
  })
}
