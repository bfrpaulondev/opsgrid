# Task 2-b: Theme System, Layout, Sidebar, and Login

## Summary
Completed the full dark-mode "command center" theme, layout structure with sidebar navigation, and login page for OpsGrid.

## Files Created/Modified

### Theme & Global CSS
- `src/app/globals.css` — Dark-only theme with zinc-950 bg, cyan-400 accent, custom scrollbar, ops utility classes

### Layout & Fonts
- `src/app/layout.tsx` — Inter + JetBrains Mono fonts, `className="dark"`, Providers + Toaster

### Providers & State
- `src/components/providers.tsx` — QueryClientProvider (TanStack Query)
- `src/stores/auth-store.ts` — Zustand auth store (user, isLoading, logout, isLeader)

### API Client
- `src/lib/api-client.ts` — Authenticated fetch wrapper with token refresh

### Sidebar & Layout
- `src/components/app-sidebar.tsx` — OpsGrid sidebar with 6 LEADER items, 2 COLLABORATOR items, user info, logout
- `src/components/app-layout.tsx` — SidebarProvider wrapper with auth check and role-based redirect

### Auth API Routes
- `src/app/api/auth/login/route.ts` — JWT-based login with access_token + refresh_token cookies
- `src/app/api/auth/me/route.ts` — Returns current user from JWT
- `src/app/api/auth/logout/route.ts` — Clears auth cookies
- `src/app/api/auth/refresh/route.ts` — Refreshes JWT tokens

### Pages
- `src/app/page.tsx` — Auth redirect (→ /dashboard or /my-work or /login)
- `src/app/login/page.tsx` — Premium dark login with framer-motion animations
- `src/app/dashboard/page.tsx` — Placeholder with AppLayout
- `src/app/entries/page.tsx` — Placeholder with AppLayout
- `src/app/projects/page.tsx` — Placeholder with AppLayout
- `src/app/capacity/page.tsx` — Placeholder with AppLayout
- `src/app/my-work/page.tsx` — Placeholder with AppLayout
- `src/app/team/page.tsx` — Placeholder with AppLayout

### Fixed
- `src/components/ui/sonner.tsx` — Removed next-themes dependency, always dark

## Test Credentials
- LEADER: `leader@opsgrid.local` / `Ops123!`
- COLLABORATOR: `colaborador@opsgrid.local` / `Ops123!`

## Integration Notes
- Integrates with existing `middleware.ts` for route protection
- Uses existing JWT auth system (`src/lib/auth.ts`, `src/lib/auth-cookies.ts`, `src/lib/api-auth.ts`)
- The middleware checks `access_token` cookie (JWT, 15min expiry) and redirects to /login if missing
