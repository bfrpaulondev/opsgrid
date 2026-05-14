# OpsGrid — Operational Command Center

## Sistema de gestão operacional e gerencial para equipas técnicas

### Credenciais de Teste
- **LEADER**: `leader@opsgrid.local` / `Ops123!`
- **COLLABORATOR**: `colaborador@opsgrid.local` / `Ops123!`

### Funcionalidades Implementadas

#### 8 Telas
1. **Login** — Autenticação JWT com cookies httpOnly
2. **Dashboard Gerencial** — KPI cards, gráfico de barras (Top 5 projetos), gráfico donut (distribuição por tipo), lista de sobrecarregados, projetos atrasados, recomendações automáticas
3. **Lançamentos** — TanStack Table v8 com filtros, CRUD inline, importação/exportação CSV
4. **Projetos** — Tabela com drawer de detalhes, macros, lançamentos e alocações
5. **Capacidade** — Matriz colaborador×mês com células coloridas por utilização
6. **Meu Trabalho** — Vista pessoal do colaborador com registo de tempo
7. **Equipa** — CRUD de colaboradores com barras de utilização
8. **Análise de Impacto** — Warning ao alocar acima de 100%

#### 22 API Endpoints
- Auth: login, refresh, logout, me
- Collaborators: CRUD + capacity matrix
- Projects: CRUD + macros
- Entries: CRUD + CSV import/export
- Allocations: CRUD + impact analysis
- Dashboard: overview, recommendations, overload, late-projects
- Impact: preview

#### Regras de Negócio
- RN-01: Capacidade mensal configurável (default 160h)
- RN-02: FTE = horas/160 com 2 casas decimais
- RN-03: % Suporte calculado sobre total
- RN-04: Utilização com indicadores visuais (verde≤80%, amarelo≤100%, vermelho>100%)
- RN-05: Progresso manual ou calculado
- RN-06: Status derivado + deteção de atraso
- RN-07: Snapshot mensal (cron job)
- RN-08: Análise de impacto com warning

#### Design System
- Tema dark "Command Center / Cyber Ops"
- Cores: zinc-950 fundo, zinc-900 cards, cyan-400 accent
- Tipografia: Inter (body) + JetBrains Mono (dados)
- Bordas finas, labels uppercase, micro-acentos em cyan
- Scrollbar customizada
- Efeitos glow com ops-glow

#### Stack
- Next.js 16 + TypeScript
- Tailwind CSS 4 + shadcn/ui
- Prisma ORM (SQLite)
- TanStack Table v8 + TanStack Query
- Recharts
- Zustand (auth store)
- JWT (jose) + bcryptjs
- Zod (validação)
