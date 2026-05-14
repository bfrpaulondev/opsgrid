# Task 3-a: Dashboard Gerencial & Lançamentos Pages

## Agent: full-stack-developer

## Summary
Built both the Dashboard Gerencial and Lançamentos (Entries) pages with full functionality.

## Dashboard Gerencial (`/src/app/dashboard/page.tsx`)
- 4 KPI cards with ops-glow, ops-label, ops-mono styling
- Month selector with navigation arrows
- Recharts BarChart (Top 5 Projects by Hours) and PieChart (Distribution by Type)
- Colaboradores Sobrecarregados with utilization bars (RN-04 color coding)
- Projetos Atrasados with days overdue calculation
- Recomendações Automáticas from API
- All data via @tanstack/react-query

## Lançamentos (`/src/app/entries/page.tsx`)
- TanStack Table v8 with sorting and all required columns
- StatusBadge with color coding per spec
- Role-based filtering (COLLABORATOR sees only own entries)
- Full filter bar (collaborator, project, date range)
- Create/Edit dialogs with date picker, project/collaborator/macro selects
- Delete confirmation with AlertDialog
- CSV Export (downloads file via fetch)
- CSV Import (file upload + preview table + confirm)
- Toast notifications for all operations
- Overload warning on create

## Lint: Clean (0 errors, 0 warnings)
