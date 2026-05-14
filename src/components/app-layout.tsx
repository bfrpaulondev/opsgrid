'use client'

import { SidebarProvider, SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app-sidebar'
import { Separator } from '@/components/ui/separator'
import { useAuthStore } from '@/stores/auth-store'
import { useEffect } from 'react'
import { api } from '@/lib/api-client'
import { useRouter, usePathname } from 'next/navigation'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, setUser, setLoading } = useAuthStore()
  const router = useRouter()
  const pathname = usePathname()

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
    if (!user) {
      checkAuth()
    }
  }, [user, setUser, setLoading, router])

  // Check role-based access
  useEffect(() => {
    if (!user || isLoading) return
    const leaderOnlyPaths = ['/dashboard', '/projects', '/capacity', '/team']
    if (user.role !== 'LEADER' && leaderOnlyPaths.some((p) => pathname.startsWith(p))) {
      router.replace('/my-work')
    }
  }, [user, isLoading, pathname, router])

  if (isLoading || !user) {
    return (
      <div className="flex h-svh w-full items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="ops-label">A verificar autenticação...</span>
        </div>
      </div>
    )
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator orientation="vertical" className="mr-2 h-4 bg-border" />
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-ops-accent animate-pulse" />
            <span className="ops-label">OpsGrid</span>
          </div>
        </header>
        <div className="flex-1 overflow-auto p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
