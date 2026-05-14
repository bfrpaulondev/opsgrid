'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api-client'

export default function Home() {
  const { user, isLoading, setUser } = useAuthStore()
  const router = useRouter()

  useEffect(() => {
    async function checkAuth() {
      try {
        const userData = await api.get<{
          id: string
          email: string
          name: string
          role: 'LEADER' | 'COLLABORATOR'
          collaboratorId: string | null
        }>('/auth/me')
        setUser(userData)
      } catch {
        setUser(null)
        router.replace('/login')
      }
    }
    checkAuth()
  }, [setUser, router])

  useEffect(() => {
    if (!user || isLoading) return
    if (user.role === 'LEADER') {
      router.replace('/dashboard')
    } else {
      router.replace('/my-work')
    }
  }, [user, isLoading, router])

  return (
    <div className="flex h-svh w-full items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <span className="ops-label">A carregar OpsGrid...</span>
      </div>
    </div>
  )
}
