import { z } from 'zod'

// Auth
export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

// Collaborator
export const collaboratorCreateSchema = z.object({
  name: z.string().min(1),
  jobTitle: z.string().optional().nullable(),
  monthlyCapacityH: z.number().int().positive().default(160),
  supportPct: z.number().min(0).max(100).default(0),
  active: z.boolean().default(true),
})

export const collaboratorUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  jobTitle: z.string().optional().nullable(),
  monthlyCapacityH: z.number().int().positive().optional(),
  supportPct: z.number().min(0).max(100).optional(),
  active: z.boolean().optional(),
})

// Project
export const projectCreateSchema = z.object({
  name: z.string().min(1),
  client: z.string().optional().nullable(),
  type: z.enum(['PROJECT', 'MACRO', 'INCIDENT', 'REQUEST']),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  status: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'TRIAGE', 'BLOCKED', 'DONE'])
    .default('NOT_STARTED'),
  startDate: z.string().optional().nullable(),
  plannedDelivery: z.string().optional().nullable(),
  actualDelivery: z.string().optional().nullable(),
  riskNotes: z.string().optional().nullable(),
})

export const projectUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  client: z.string().optional().nullable(),
  type: z.enum(['PROJECT', 'MACRO', 'INCIDENT', 'REQUEST']).optional(),
  priority: z
    .enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
    .optional(),
  status: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'TRIAGE', 'BLOCKED', 'DONE'])
    .optional(),
  startDate: z.string().optional().nullable(),
  plannedDelivery: z.string().optional().nullable(),
  actualDelivery: z.string().optional().nullable(),
  riskNotes: z.string().optional().nullable(),
})

// Macro
export const macroCreateSchema = z.object({
  name: z.string().min(1),
  status: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'TRIAGE', 'BLOCKED', 'DONE'])
    .default('NOT_STARTED'),
  progressPct: z.number().min(0).max(100).default(0),
  plannedDelivery: z.string().optional().nullable(),
})

export const macroUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  status: z
    .enum(['NOT_STARTED', 'IN_PROGRESS', 'TRIAGE', 'BLOCKED', 'DONE'])
    .optional(),
  progressPct: z.number().min(0).max(100).optional(),
  plannedDelivery: z.string().optional().nullable(),
})

// Time Entry
export const timeEntryCreateSchema = z.object({
  date: z.string().min(1),
  projectId: z.string().min(1),
  macroId: z.string().optional().nullable(),
  collaboratorId: z.string().min(1),
  hours: z.number().positive(),
  isSupport: z.boolean().default(false),
  statusSnapshot: z.string().default('IN_PROGRESS'),
  progressSnapshot: z.number().optional().nullable(),
  note: z.string().optional().nullable(),
})

export const timeEntryUpdateSchema = z.object({
  date: z.string().min(1).optional(),
  projectId: z.string().min(1).optional(),
  macroId: z.string().optional().nullable(),
  collaboratorId: z.string().min(1).optional(),
  hours: z.number().positive().optional(),
  isSupport: z.boolean().optional(),
  statusSnapshot: z.string().optional(),
  progressSnapshot: z.number().optional().nullable(),
  note: z.string().optional().nullable(),
})

// Allocation
export const allocationCreateSchema = z.object({
  projectId: z.string().min(1),
  collaboratorId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  plannedHours: z.number().positive(),
})

export const allocationUpdateSchema = z.object({
  plannedHours: z.number().positive().optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
})

// Impact Preview
export const impactPreviewSchema = z.object({
  collaboratorId: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  hours: z.number().positive(),
})
