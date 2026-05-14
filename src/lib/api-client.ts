class ApiClient {
  private baseUrl = '/api'

  async get<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path, window.location.origin)
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null) url.searchParams.set(k, v)
      })
    }
    const res = await fetch(url.toString(), { credentials: 'include' })
    if (!res.ok) {
      if (res.status === 401) {
        const refreshed = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include',
        })
        if (refreshed.ok) {
          const retryRes = await fetch(url.toString(), {
            credentials: 'include',
          })
          return retryRes.json()
        }
        throw new Error('Unauthorized')
      }
      throw new Error(`API Error: ${res.status}`)
    }
    return res.json()
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
    })
    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `API Error: ${res.status}`)
    }
    return res.json()
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include',
    })
    if (!res.ok) {
      const error = await res
        .json()
        .catch(() => ({ message: 'Request failed' }))
      throw new Error(error.message || `API Error: ${res.status}`)
    }
    return res.json()
  }

  async delete<T>(path: string): Promise<T> {
    const res = await fetch(this.baseUrl + path, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) {
      throw new Error(`API Error: ${res.status}`)
    }
    return res.json()
  }
}

export const api = new ApiClient()
