'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Hexagon, Loader2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/stores/auth-store'
import { api } from '@/lib/api-client'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const { setUser } = useAuthStore()
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const userData = await api.post<{
        id: string
        email: string
        name: string
        role: 'LEADER' | 'COLLABORATOR'
        collaboratorId: string | null
      }>('/auth/login', { email, password })

      setUser(userData)
      toast.success(`Bem-vindo, ${userData.name}!`)

      if (userData.role === 'LEADER') {
        router.push('/dashboard')
      } else {
        router.push('/my-work')
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Erro ao fazer login'
      setError(message)
      toast.error('Credenciais inválidas')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center bg-background p-4">
      {/* Background grid effect */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(34,211,238,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
        <div className="absolute left-1/2 top-0 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/5 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Card */}
        <div className="rounded-xl border border-border bg-card p-8 ops-glow">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1, duration: 0.4 }}
            className="mb-8 flex flex-col items-center gap-3"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 ops-border-glow border">
              <Hexagon className="h-6 w-6 text-primary" />
            </div>
            <div className="text-center">
              <h1 className="text-xl font-bold text-foreground">OpsGrid</h1>
              <p className="ops-label mt-1">Operational Command Center</p>
            </div>
          </motion.div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.3 }}
              className="space-y-2"
            >
              <Label
                htmlFor="email"
                className="ops-label"
              >
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="nome@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="h-10 bg-background border-border placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3, duration: 0.3 }}
              className="space-y-2"
            >
              <Label
                htmlFor="password"
                className="ops-label"
              >
                Palavra-passe
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
                className="h-10 bg-background border-border placeholder:text-muted-foreground/50 focus-visible:border-primary focus-visible:ring-primary/30"
              />
            </motion.div>

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-center gap-2 rounded-md border border-ops-danger/30 bg-ops-danger/10 px-3 py-2 text-sm text-ops-danger"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </motion.div>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.3 }}
            >
              <Button
                type="submit"
                disabled={isLoading || !email || !password}
                className="h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    A autenticar...
                  </>
                ) : (
                  'Entrar'
                )}
              </Button>
            </motion.div>
          </form>

          {/* Footer info */}
          <div className="mt-6 text-center">
            <p className="ops-label text-[0.55rem]">
              Sistema de gestão operacional v1.0
            </p>
          </div>
        </div>

        {/* Bottom accent line */}
        <div className="mx-auto mt-4 h-px w-24 bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
      </motion.div>
    </div>
  )
}
