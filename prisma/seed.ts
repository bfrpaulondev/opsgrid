import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { subDays, format, addDays } from 'date-fns'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean existing data
  await db.timeEntry.deleteMany()
  await db.plannedAllocation.deleteMany()
  await db.macroActivity.deleteMany()
  await db.monthlySnapshot.deleteMany()
  await db.user.deleteMany()
  await db.collaborator.deleteMany()
  await db.project.deleteMany()

  // ─── Collaborators ───────────────────────────────────────
  const tiago = await db.collaborator.create({
    data: {
      name: 'Tiago Neves',
      jobTitle: 'Tech Lead',
      monthlyCapacityH: 160,
      supportPct: 0.15,
      active: true,
    },
  })

  const ines = await db.collaborator.create({
    data: {
      name: 'Inês Rocha',
      jobTitle: 'DevOps Engineer',
      monthlyCapacityH: 160,
      supportPct: 0.25,
      active: true,
    },
  })

  const rui = await db.collaborator.create({
    data: {
      name: 'Rui Matos',
      jobTitle: 'Security Analyst',
      monthlyCapacityH: 160,
      supportPct: 0.1,
      active: true,
    },
  })

  console.log('✅ Created 3 collaborators')

  // ─── Users ───────────────────────────────────────────────
  const passwordHash = await bcrypt.hash('Ops123!', 12)

  await db.user.create({
    data: {
      email: 'leader@opsgrid.local',
      passwordHash,
      name: 'Tiago Neves',
      role: 'LEADER',
      collaboratorId: tiago.id,
    },
  })

  await db.user.create({
    data: {
      email: 'colaborador@opsgrid.local',
      passwordHash,
      name: 'Inês Rocha',
      role: 'COLLABORATOR',
      collaboratorId: ines.id,
    },
  })

  console.log('✅ Created 2 users')

  // ─── Projects ────────────────────────────────────────────
  const projectCybersec = await db.project.create({
    data: {
      name: 'Plataforma de Cibersegurança',
      client: 'BankPlus',
      type: 'PROJECT',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      startDate: subDays(new Date(), 45),
      plannedDelivery: addDays(new Date(), 30),
      riskNotes: 'Dependência de fornecedor externo para módulo SIEM',
    },
  })

  const projectCloudMig = await db.project.create({
    data: {
      name: 'Migração Cloud AWS',
      client: 'RetailMax',
      type: 'PROJECT',
      priority: 'CRITICAL',
      status: 'IN_PROGRESS',
      startDate: subDays(new Date(), 60),
      plannedDelivery: addDays(new Date(), 15),
      riskNotes: 'Janela de migração limitada — risco de downtime',
    },
  })

  const projectSIEM = await db.project.create({
    data: {
      name: 'Monitorização SIEM',
      client: 'Internal',
      type: 'MACRO',
      priority: 'MEDIUM',
      status: 'IN_PROGRESS',
      startDate: subDays(new Date(), 30),
      plannedDelivery: addDays(new Date(), 60),
    },
  })

  const projectRansomware = await db.project.create({
    data: {
      name: 'Incidente Ransomware Q1',
      client: 'BankPlus',
      type: 'INCIDENT',
      priority: 'CRITICAL',
      status: 'DONE',
      startDate: subDays(new Date(), 55),
      plannedDelivery: subDays(new Date(), 20),
      actualDelivery: subDays(new Date(), 18),
      riskNotes: 'Incidente resolvido — pós-mortem pendente',
    },
  })

  const projectVPN = await db.project.create({
    data: {
      name: 'Pedido de Acesso VPN',
      client: 'Internal',
      type: 'REQUEST',
      priority: 'LOW',
      status: 'IN_PROGRESS',
      startDate: subDays(new Date(), 10),
      plannedDelivery: addDays(new Date(), 5),
    },
  })

  const projectAudit = await db.project.create({
    data: {
      name: 'Auditoria de Compliance',
      client: 'RetailMax',
      type: 'PROJECT',
      priority: 'MEDIUM',
      status: 'TRIAGE',
      startDate: subDays(new Date(), 5),
      plannedDelivery: addDays(new Date(), 90),
      riskNotes: 'Aguarda aprovação de escopo pelo cliente',
    },
  })

  console.log('✅ Created 6 projects')

  // ─── Macro Activities ────────────────────────────────────
  const macro1 = await db.macroActivity.create({
    data: {
      projectId: projectCybersec.id,
      name: 'Análise de Requisitos',
      status: 'DONE',
      progressPct: 100,
      plannedDelivery: subDays(new Date(), 20),
    },
  })

  const macro2 = await db.macroActivity.create({
    data: {
      projectId: projectCybersec.id,
      name: 'Desenvolvimento Core',
      status: 'IN_PROGRESS',
      progressPct: 65,
      plannedDelivery: addDays(new Date(), 15),
    },
  })

  const macro3 = await db.macroActivity.create({
    data: {
      projectId: projectCybersec.id,
      name: 'Integração SIEM',
      status: 'NOT_STARTED',
      progressPct: 0,
      plannedDelivery: addDays(new Date(), 30),
    },
  })

  const macro4 = await db.macroActivity.create({
    data: {
      projectId: projectCloudMig.id,
      name: 'Assessment de Infraestrutura',
      status: 'DONE',
      progressPct: 100,
      plannedDelivery: subDays(new Date(), 30),
    },
  })

  const macro5 = await db.macroActivity.create({
    data: {
      projectId: projectCloudMig.id,
      name: 'Migração de Workloads',
      status: 'IN_PROGRESS',
      progressPct: 40,
      plannedDelivery: addDays(new Date(), 15),
    },
  })

  console.log('✅ Created 5 macro activities')

  // ─── Time Entries (30 spread over last 60 days) ──────────
  const collaborators = [tiago, ines, rui]
  const projects = [
    projectCybersec,
    projectCloudMig,
    projectSIEM,
    projectRansomware,
    projectVPN,
    projectAudit,
  ]
  const macros = [macro1, macro2, macro3, macro4, macro5]

  const statuses = ['NOT_STARTED', 'IN_PROGRESS', 'TRIAGE', 'BLOCKED', 'DONE']

  const timeEntriesData: Array<{
    date: Date
    projectId: string
    macroId: string | null
    collaboratorId: string
    hours: number
    isSupport: boolean
    statusSnapshot: string
    progressSnapshot: number | null
    note: string | null
  }> = []

  // Generate realistic time entries
  const entryTemplates = [
    // Tiago entries (12 entries)
    { collab: 0, proj: 0, macro: 1, daysAgo: 1, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: 65, note: 'Desenvolvimento do módulo de autenticação' },
    { collab: 0, proj: 0, macro: 2, daysAgo: 3, hours: 6, isSupport: false, status: 'IN_PROGRESS', progress: 65, note: 'Configuração integração SIEM' },
    { collab: 0, proj: 1, macro: 4, daysAgo: 5, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: 40, note: 'Migração de workloads AWS' },
    { collab: 0, proj: 0, macro: 1, daysAgo: 8, hours: 7, isSupport: false, status: 'IN_PROGRESS', progress: 60, note: 'Review de código do módulo core' },
    { collab: 0, proj: 1, macro: 3, daysAgo: 10, hours: 4, isSupport: false, status: 'DONE', progress: 100, note: 'Assessment concluído' },
    { collab: 0, proj: 2, macro: null, daysAgo: 12, hours: 6, isSupport: false, status: 'IN_PROGRESS', progress: null, note: 'Configuração dashboards SIEM' },
    { collab: 0, proj: 3, macro: null, daysAgo: 15, hours: 8, isSupport: false, status: 'DONE', progress: null, note: 'Resposta a incidente ransomware' },
    { collab: 0, proj: 0, macro: 0, daysAgo: 20, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: 45, note: 'Análise de requisitos de segurança' },
    { collab: 0, proj: 4, macro: null, daysAgo: 25, hours: 2, isSupport: true, status: 'IN_PROGRESS', progress: null, note: 'Suporte pedido VPN' },
    { collab: 0, proj: 1, macro: 3, daysAgo: 30, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: 30, note: 'Levantamento de infraestrutura' },
    { collab: 0, proj: 3, macro: null, daysAgo: 40, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: null, note: 'Investigação incidente' },
    { collab: 0, proj: 0, macro: 0, daysAgo: 50, hours: 6, isSupport: false, status: 'NOT_STARTED', progress: 10, note: 'Kick-off análise requisitos' },

    // Inês entries (10 entries)
    { collab: 1, proj: 1, macro: 4, daysAgo: 2, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: 40, note: 'Migração workloads EC2' },
    { collab: 1, proj: 1, macro: 3, daysAgo: 4, hours: 6, isSupport: false, status: 'DONE', progress: 100, note: 'Documentação assessment' },
    { collab: 1, proj: 2, macro: null, daysAgo: 7, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: null, note: 'Configuração regras SIEM' },
    { collab: 1, proj: 4, macro: null, daysAgo: 9, hours: 4, isSupport: true, status: 'IN_PROGRESS', progress: null, note: 'Configuração acesso VPN' },
    { collab: 1, proj: 0, macro: 2, daysAgo: 11, hours: 6, isSupport: false, status: 'IN_PROGRESS', progress: 55, note: 'Integração SIEM módulo' },
    { collab: 1, proj: 1, macro: 4, daysAgo: 14, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: 35, note: 'Pipeline CI/CD para migração' },
    { collab: 1, proj: 5, macro: null, daysAgo: 18, hours: 4, isSupport: false, status: 'TRIAGE', progress: null, note: 'Levantamento requisitos auditoria' },
    { collab: 1, proj: 3, macro: null, daysAgo: 22, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: null, note: 'Contenção incidente' },
    { collab: 1, proj: 0, macro: 1, daysAgo: 35, hours: 7, isSupport: false, status: 'IN_PROGRESS', progress: 50, note: 'Dev módulo core' },
    { collab: 1, proj: 2, macro: null, daysAgo: 45, hours: 6, isSupport: false, status: 'NOT_STARTED', progress: null, note: 'Setup inicial SIEM' },

    // Rui entries (8 entries)
    { collab: 2, proj: 3, macro: null, daysAgo: 1, hours: 6, isSupport: false, status: 'DONE', progress: null, note: 'Pós-mortem ransomware' },
    { collab: 2, proj: 0, macro: 1, daysAgo: 4, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: 65, note: 'Security testing módulo core' },
    { collab: 2, proj: 2, macro: null, daysAgo: 6, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: null, note: 'Tuning de alertas SIEM' },
    { collab: 2, proj: 3, macro: null, daysAgo: 9, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: null, note: 'Análise forense incidente' },
    { collab: 2, proj: 5, macro: null, daysAgo: 13, hours: 6, isSupport: false, status: 'TRIAGE', progress: null, note: 'Verificação compliance' },
    { collab: 2, proj: 0, macro: 0, daysAgo: 19, hours: 7, isSupport: false, status: 'IN_PROGRESS', progress: 40, note: 'Requisitos de segurança' },
    { collab: 2, proj: 4, macro: null, daysAgo: 28, hours: 2, isSupport: true, status: 'IN_PROGRESS', progress: null, note: 'Revisão acesso VPN' },
    { collab: 2, proj: 3, macro: null, daysAgo: 38, hours: 8, isSupport: false, status: 'IN_PROGRESS', progress: null, note: 'Resposta a incidente' },
  ]

  for (const entry of entryTemplates) {
    const date = subDays(new Date(), entry.daysAgo)
    // Normalize date to start of day
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    timeEntriesData.push({
      date: normalizedDate,
      projectId: projects[entry.proj].id,
      macroId: entry.macro !== null ? macros[entry.macro].id : null,
      collaboratorId: collaborators[entry.collab].id,
      hours: entry.hours,
      isSupport: entry.isSupport,
      statusSnapshot: entry.status,
      progressSnapshot: entry.progress,
      note: entry.note,
    })
  }

  for (const entryData of timeEntriesData) {
    await db.timeEntry.create({ data: entryData })
  }

  console.log(`✅ Created ${timeEntriesData.length} time entries`)

  // ─── Planned Allocations (5 for current month) ──────────
  const currentMonth = format(new Date(), 'yyyy-MM')

  await db.plannedAllocation.create({
    data: {
      projectId: projectCybersec.id,
      collaboratorId: tiago.id,
      month: currentMonth,
      plannedHours: 80,
    },
  })

  await db.plannedAllocation.create({
    data: {
      projectId: projectCloudMig.id,
      collaboratorId: tiago.id,
      month: currentMonth,
      plannedHours: 40,
    },
  })

  await db.plannedAllocation.create({
    data: {
      projectId: projectCloudMig.id,
      collaboratorId: ines.id,
      month: currentMonth,
      plannedHours: 100,
    },
  })

  await db.plannedAllocation.create({
    data: {
      projectId: projectSIEM.id,
      collaboratorId: ines.id,
      month: currentMonth,
      plannedHours: 40,
    },
  })

  await db.plannedAllocation.create({
    data: {
      projectId: projectCybersec.id,
      collaboratorId: rui.id,
      month: currentMonth,
      plannedHours: 60,
    },
  })

  console.log('✅ Created 5 planned allocations')

  // ─── Summary ─────────────────────────────────────────────
  const counts = {
    users: await db.user.count(),
    collaborators: await db.collaborator.count(),
    projects: await db.project.count(),
    macros: await db.macroActivity.count(),
    timeEntries: await db.timeEntry.count(),
    allocations: await db.plannedAllocation.count(),
  }

  console.log('\n📊 Seed Summary:')
  console.log(`   Users: ${counts.users}`)
  console.log(`   Collaborators: ${counts.collaborators}`)
  console.log(`   Projects: ${counts.projects}`)
  console.log(`   Macro Activities: ${counts.macros}`)
  console.log(`   Time Entries: ${counts.timeEntries}`)
  console.log(`   Planned Allocations: ${counts.allocations}`)
  console.log('\n🌱 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
