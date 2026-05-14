---
Task ID: 1
Agent: full-stack-developer
Task: Create Prisma Schema + Seed Data

Work Log:
- Updated prisma/schema.prisma with all 7 OpsGrid models (User, Collaborator, Project, MacroActivity, TimeEntry, PlannedAllocation, MonthlySnapshot)
- Adapted schema for SQLite (String types for enums instead of native enums)
- Ran db:push and db:generate successfully
- Installed bcryptjs and @types/bcryptjs for password hashing
- Created prisma/seed.ts with comprehensive seed data
- Added db:seed script to package.json
- Ran seed successfully — all data created and verified

Stage Summary:
- Schema has 7 models: User, Collaborator, Project, MacroActivity, TimeEntry, PlannedAllocation, MonthlySnapshot
- Seed creates 2 users (leader@opsgrid.local/LEADER, colaborador@opsgrid.local/COLLABORATOR), 3 collaborators (Tiago Neves, Inês Rocha, Rui Matos), 6 projects covering all types (PROJECT, MACRO, INCIDENT, REQUEST), 5 macro activities, 30 time entries spread over last 60 days, 5 planned allocations for current month
- All passwords hashed with bcryptjs (cost factor 12)
- Leader user linked to Tiago Neves, Collaborator user linked to Inês Rocha
- Database is fully seeded and ready for API development
- lib/db.ts already exists with singleton PrismaClient pattern
