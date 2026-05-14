import { create } from 'zustand'

interface User {
  id: string
  email: string
  name: string
  role: 'LEADER' | 'COLLABORATOR'
  collaboratorId: string | null
}

interface AuthState {
  user: User | null
  isLoading: boolean
  setUser: (user: User | null) => void
  setLoading: (loading: boolean) => void
  logout: () => void
  isLeader: () => boolean
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isLoading: true,
  setUser: (user) => set({ user, isLoading: false }),
  setLoading: (isLoading) => set({ isLoading }),
  logout: () => {
    set({ user: null, isLoading: false })
    // Call logout API to clear JWT cookies
    fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
      () => {}
    )
    window.location.href = '/login'
  },
  isLeader: () => get().user?.role === 'LEADER',
}))
