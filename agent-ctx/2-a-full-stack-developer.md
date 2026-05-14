# Task 2-a: Auth System & API Routes

## Summary
Implemented the complete authentication system and all API routes for OpsGrid.

## Files Created/Modified

### Library Files
- `/src/lib/auth.ts` - JWT signing/verification with jose, password hashing with bcryptjs
- `/src/lib/auth-cookies.ts` - httpOnly cookie management for access/refresh tokens
- `/src/lib/api-auth.ts` - getAuthUser(), requireAuth(), requireLeader() helpers
- `/src/lib/business-rules.ts` - FTE, utilization, progress, isLate calculations
- `/src/lib/validations.ts` - All Zod schemas for input validation
- `/src/middleware.ts` - Route protection with JWT verification

### Auth API Routes
- `/src/app/api/auth/login/route.ts` - POST login
- `/src/app/api/auth/refresh/route.ts` - POST refresh tokens
- `/src/app/api/auth/logout/route.ts` - POST logout
- `/src/app/api/auth/me/route.ts` - GET current user

### CRUD API Routes
- `/src/app/api/collaborators/route.ts` - GET list, POST create
- `/src/app/api/collaborators/[id]/route.ts` - PATCH update, DELETE soft-delete
- `/src/app/api/collaborators/[id]/capacity/route.ts` - GET capacity matrix
- `/src/app/api/projects/route.ts` - GET list, POST create
- `/src/app/api/projects/[id]/route.ts` - GET detail, PATCH update, DELETE
- `/src/app/api/projects/[id]/macros/route.ts` - POST create macro
- `/src/app/api/macros/[id]/route.ts` - PATCH update, DELETE
- `/src/app/api/entries/route.ts` - GET list, POST create
- `/src/app/api/entries/[id]/route.ts` - PATCH update, DELETE
- `/src/app/api/entries/import/route.ts` - POST CSV import
- `/src/app/api/entries/export/route.ts` - GET CSV export
- `/src/app/api/allocations/route.ts` - GET list, POST create
- `/src/app/api/allocations/[id]/route.ts` - PATCH update, DELETE

### Dashboard API Routes
- `/src/app/api/dashboard/overview/route.ts` - GET comprehensive dashboard
- `/src/app/api/dashboard/recommendations/route.ts` - GET recommendations
- `/src/app/api/dashboard/overload/route.ts` - GET overloaded collaborators
- `/src/app/api/dashboard/late-projects/route.ts` - GET late projects

### Impact Analysis
- `/src/app/api/impact/preview/route.ts` - POST impact preview

## Key Design Decisions
- Error responses use `message` key (not `error`) for consistency with existing api-client.ts
- JWT tokens stored in httpOnly cookies for security
- Access token: 15min, Refresh token: 7 days
- LEADER-only mutations enforced via requireLeader() helper
- CSV import/export implemented without external libraries
- All dates stored as ISO strings in SQLite
