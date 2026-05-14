---
Task ID: 2-a
Agent: full-stack-developer
Task: Create complete authentication system and ALL API routes for OpsGrid

Work Log:
- Installed jose for Edge-compatible JWT handling
- Created /src/lib/auth.ts with JWT signing/verification (access: 15min, refresh: 7d), password hashing with bcryptjs
- Created /src/lib/auth-cookies.ts for httpOnly cookie management
- Created /src/lib/api-auth.ts with getAuthUser(), requireAuth(), requireLeader() helpers
- Created /src/lib/business-rules.ts with calculateFTE, calculateUtilization, calculateSupportPct, getUtilizationColor, calculateProgress, isLate, getWorkingDaysInMonth
- Created /src/lib/validations.ts with all Zod schemas (login, collaborator, project, macro, timeEntry, allocation, impactPreview)
- Created /src/middleware.ts for route protection (redirects to /login for pages, 401 JSON for API routes)
- Auth API Routes:
  - POST /api/auth/login - validates credentials, sets JWT cookies
  - POST /api/auth/refresh - refreshes tokens using refresh_token cookie
  - POST /api/auth/logout - clears both cookies
  - GET /api/auth/me - returns current user from JWT
- Collaborator API Routes:
  - GET /api/collaborators - list with ?active=true filter
  - POST /api/collaborators - create [LEADER only]
  - PATCH /api/collaborators/[id] - update [LEADER only]
  - DELETE /api/collaborators/[id] - soft delete [LEADER only]
  - GET /api/collaborators/[id]/capacity?year=2026 - monthly capacity matrix
- Project & Macro API Routes:
  - GET /api/projects - list with filters ?type=&status=&priority=
  - POST /api/projects - create [LEADER only]
  - GET /api/projects/[id] - detail with aggregated data
  - PATCH /api/projects/[id] - update [LEADER only]
  - DELETE /api/projects/[id] - delete [LEADER only]
  - POST /api/projects/[id]/macros - create macro [LEADER only]
  - PATCH /api/macros/[id] - update macro [LEADER only]
  - DELETE /api/macros/[id] - delete macro [LEADER only]
- Time Entry API Routes:
  - GET /api/entries - list with filters ?from=&to=&collaboratorId=&projectId=
  - POST /api/entries - create with overload warning
  - PATCH /api/entries/[id] - update
  - DELETE /api/entries/[id] - delete
  - POST /api/entries/import - CSV import
  - GET /api/entries/export?format=csv|xlsx - CSV export
- Allocation API Routes:
  - GET /api/allocations?month=YYYY-MM - list with month filter
  - POST /api/allocations - create [LEADER only] with impact analysis
  - PATCH /api/allocations/[id] - update [LEADER only]
  - DELETE /api/allocations/[id] - delete [LEADER only]
- Dashboard API Routes:
  - GET /api/dashboard/overview?month=YYYY-MM - comprehensive dashboard data
  - GET /api/dashboard/recommendations - rule-based recommendations
  - GET /api/dashboard/overload?month=YYYY-MM - overloaded collaborators
  - GET /api/dashboard/late-projects - late project listing
- Impact Analysis:
  - POST /api/impact/preview - preview impact of adding hours to a collaborator

Stage Summary:
- All 22 API endpoints implemented and tested
- Authentication flow: JWT access + refresh tokens in httpOnly cookies
- Role-based access: LEADER-only mutations, COLLABORATOR read access
- Error responses use `message` key for consistency with api-client.ts
- Middleware protects routes and adds user info to headers
- Lint passes clean
- All endpoints tested successfully via curl

---
Task ID: 3-a
Agent: full-stack-developer
Task: Build Dashboard Gerencial and Lançamentos (Entries) pages

Work Log:
- Built Dashboard Gerencial page (/src/app/dashboard/page.tsx):
  - 4 top KPI cards: Total Itens Ativos, Horas Previstas (Mês), Horas Realizadas (Mês), Colaboradores Sobrecarregados
  - Each card uses ops-label, ops-mono, ops-glow, with appropriate icons (FolderKanban, Target, Clock, AlertTriangle)
  - Sobrecarregados card turns danger color when count > 0, success when 0
  - Month selector with left/right navigation arrows and Calendar icon
  - Recharts BarChart (horizontal bars, cyan color) for Top 5 Projetos por Horas
  - Recharts PieChart (donut style) for Distribuição por Tipo with type-specific colors (PROJECT=cyan, MACRO=emerald, INCIDENT=amber, REQUEST=violet)
  - Colaboradores Sobrecarregados section with utilization bars colored by RN-04 (green≤80%, yellow≤100%, red>100%)
  - Projetos Atrasados section with red indicators, planned delivery date, days overdue badge, status badge
  - Recomendações Automáticas section with lightbulb icon and cyan accent cards
  - Data fetched via @tanstack/react-query with dashboard-overview key
  - All loading states handled with spinner
  - Empty states shown when no data for month

- Built Lançamentos / Time Entries page (/src/app/entries/page.tsx):
  - TanStack Table v8 with all columns: Data, Projeto, Colaborador, Macro, Horas, Status, Progresso %, Suporte?, Nota, Ações
  - Sortable columns with sorting indicators
  - StatusBadge component with color-coded badges (NOT_STARTED=zinc, IN_PROGRESS=cyan, TRIAGE=amber, BLOCKED=red, DONE=emerald)
  - Role-based visibility: LEADER sees all entries, COLLABORATOR sees only own entries
  - Filter bar with: Colaborador select (LEADER only), Projeto select, Date range pickers (from/to), Clear filters button
  - "Novo Lançamento" button opens create dialog with full form:
    - Date picker (Calendar + Popover)
    - Project select (loads from /api/projects)
    - Collaborator select (LEADER only, loads from /api/collaborators)
    - Macro select (conditional, loads from /api/projects/:id based on selected project)
    - Hours, Status, Progress %, isSupport checkbox, Note fields
    - Overload warning toast after creation if collaborator > 100% utilization
  - Edit dialog pre-populated with entry data
  - Delete confirmation with AlertDialog ("Tem a certeza que pretende eliminar este lançamento?")
  - CSV Export button that calls /api/entries/export and downloads file
  - CSV Import dialog with file upload, preview table (first 5 rows), and confirm button
  - Alternating row backgrounds for table readability
  - ops-mono font for hours and dates
  - All mutations invalidate 'entries' query key
  - Toast notifications (sonner) for all CRUD operations and import/export

- Fixed useMemo dependency warnings for React Compiler compatibility
- Fixed filter select "all" value handling to not send to API
- Lint passes clean with 0 errors, 0 warnings

Stage Summary:
- Dashboard Gerencial: fully functional with KPI cards, charts (Bar + Pie), overload indicators, late projects, recommendations
- Lançamentos: fully functional with TanStack Table, CRUD, filters, CSV import/export
- Both pages use 'use client' directive, AppLayout wrapper, dark theme with cyan accent
- All data fetching via @tanstack/react-query with proper cache invalidation
- Consistent use of existing shadcn/ui components and project CSS utilities

---
Task ID: 3-b
Agent: full-stack-developer
Task: Build Projects, Capacity, My Work, and Team pages

Work Log:
- Created shared components:
  - /src/components/status-badge.tsx: StatusBadge with color-coded badges (NOT_STARTED=zinc, IN_PROGRESS=cyan, TRIAGE=amber, BLOCKED=red, DONE=emerald) and Portuguese labels
  - /src/components/priority-badge.tsx: PriorityBadge with color-coded badges (LOW=zinc, MEDIUM=blue, HIGH=amber, CRITICAL=red) and Portuguese labels
  - /src/components/utilization-bar.tsx: UtilizationBar with RN-04 color coding (green≤80%, yellow≤100%, red>100%), configurable size (sm/md), uses getUtilizationColor from business-rules

- Built Projects page (/src/app/projects/page.tsx):
  - Full table with columns: Projeto/Macro, Tipo, Progresso %, FTE (Mês), Entrega Prevista, Status, Prioridade, Notas de Risco
  - Search input for filtering by name/client
  - Type and Status filter selects
  - Late projects highlighted with red left border and alert triangle icon
  - Click on row → opens Sheet (side="right") with project detail
  - Sheet contains: project info (dates, hours, FTE, progress), risk notes with alert styling
  - Tabs in sheet: Macros, Lançamentos, Alocações
  - Macros tab: list of macro activities with status badges, progress bars, add new button
  - Lançamentos tab: time entries for project with support badge
  - Alocações tab: planned allocations filtered by project
  - "Novo Projeto" button opens Dialog with full form (name, client, type, priority, status, date pickers, risk notes)
  - Edit project via drawer (pencil icon in sheet header)
  - Delete project with confirmation
  - Create Macro dialog within project sheet
  - Zod validation for create/update using existing schemas

- Built Capacity Monthly page (/src/app/capacity/page.tsx):
  - Year selector with prev/next buttons
  - Matrix: Collaborator × Month (Jan-Dez)
  - Each cell shows total hours + utilization percentage
  - Cell background colored by RN-04: green (≤80%), yellow (80-100%), red (>100%)
  - % Suporte column showing yearly support percentage
  - Sticky first column (collaborator name)
  - Click on cell → opens Sheet with detail breakdown:
    - Summary cards: total hours, utilization %, project hours, support hours
    - Utilization bar visualization
    - Project breakdown listing hours per project with support badge
  - Legend bar showing color meanings

- Built My Work page (/src/app/my-work/page.tsx):
  - Summary cards: Horas Lançadas Este Mês, % Capacidade Utilizada, Projetos Atribuídos
  - Activity list grouped by project with hours and entry count
  - "Registar Tempo" button on each project → opens dialog pre-filled with project
  - Global "Registar Tempo" button at top
  - Planned allocations without entries shown separately with dashed borders
  - Recent time entries table (last 10) with date, project, hours, type badges
  - Time entry dialog: project select, date input, hours input, isSupport checkbox, note textarea
  - Overload warning handling from API response
  - Uses auth store to identify current collaborator

- Built Team page (/src/app/team/page.tsx):
  - Collaborators table: Nome, Cargo, Capacidade/mês, % Suporte, Ativo, Utilização (Mês), Ações
  - Search filter by name/job title
  - Toggle to show/hide inactive collaborators
  - Active/Inactive badges with colors
  - UtilizationBar for each collaborator using current month entries
  - Edit button → Dialog with form (name, jobTitle, capacity, support%, active toggle)
  - Deactivate button → confirmation AlertDialog
  - Link User button (for collaborators without user account) → dialog with email input
  - Zod validation for create/update using collaboratorCreateSchema/collaboratorUpdateSchema
  - Inactive collaborators shown with reduced opacity

- Fixed React Compiler memoization warning in My Work page by extracting collaboratorId variable

Stage Summary:
- All 4 pages built: Projects, Capacity, My Work, Team
- 3 shared components: StatusBadge, PriorityBadge, UtilizationBar
- All pages use 'use client', AppLayout wrapper, dark command center theme with cyan accent
- Data fetching via @tanstack/react-query with proper cache invalidation
- CRUD operations with toast notifications (sonner)
- Zod validation on all forms
- RN-04 utilization color coding consistently applied
- Lint passes clean with 0 errors, 0 warnings
