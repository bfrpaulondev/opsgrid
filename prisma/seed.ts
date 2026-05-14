import mongoose from 'mongoose'
import bcrypt from 'bcryptjs'
import { subDays, format, addDays } from 'date-fns'
import { User } from '../src/models/User'
import { Collaborator } from '../src/models/Collaborator'
import { Project } from '../src/models/Project'
import { MacroActivity } from '../src/models/MacroActivity'
import { TimeEntry } from '../src/models/TimeEntry'
import { PlannedAllocation } from '../src/models/PlannedAllocation'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://bfrpaulondev_db_user:ohDOYLmDAN6NGHnS@cluster0.sczzlhb.mongodb.net/opsgrid'

async function main() {
  console.log('🌱 Reseeding database with Rodrigo Martins team...')

  await mongoose.connect(MONGODB_URI)
  console.log('✅ Connected to MongoDB')

  // Clean ALL existing data
  await TimeEntry.deleteMany({})
  await PlannedAllocation.deleteMany({})
  await MacroActivity.deleteMany({})
  await User.deleteMany({})
  await Collaborator.deleteMany({})
  await Project.deleteMany({})
  console.log('🗑️  All previous data deleted')

  // ═══════════════════════════════════════════════════════════
  // COLLABORATORS — Rodrigo's Cyber Warfare / DevSecOps team
  // ═══════════════════════════════════════════════════════════

  const rodrigo = await Collaborator.create({
    name: 'Rodrigo Martins',
    jobTitle: 'Cyber Warfare Ops DevSecOps Coordinator',
    monthlyCapacityH: 160,
    supportPct: 0.10,
    active: true,
  })

  const ana = await Collaborator.create({
    name: 'Ana Sousa',
    jobTitle: 'Senior DevSecOps Engineer',
    monthlyCapacityH: 160,
    supportPct: 0.20,
    active: true,
  })

  const pedro = await Collaborator.create({
    name: 'Pedro Lima',
    jobTitle: 'SRE & Observability Engineer',
    monthlyCapacityH: 160,
    supportPct: 0.25,
    active: true,
  })

  const mariana = await Collaborator.create({
    name: 'Mariana Costa',
    jobTitle: 'Cyber Security Analyst',
    monthlyCapacityH: 160,
    supportPct: 0.15,
    active: true,
  })

  const tiagoS = await Collaborator.create({
    name: 'Tiago Ferreira',
    jobTitle: 'Infrastructure & Zabbix Specialist',
    monthlyCapacityH: 160,
    supportPct: 0.30,
    active: true,
  })

  console.log('✅ Created 5 collaborators')

  // ═══════════════════════════════════════════════════════════
  // USERS — all with password OpsGrid@2026!
  // ═══════════════════════════════════════════════════════════

  const passwordHash = await bcrypt.hash('OpsGrid@2026!', 12)

  await User.create({
    email: 'rodrigo.martins@opsgrid.local',
    passwordHash,
    name: 'Rodrigo Martins',
    role: 'LEADER',
    collaboratorId: rodrigo._id,
  })

  await User.create({
    email: 'ana.sousa@opsgrid.local',
    passwordHash,
    name: 'Ana Sousa',
    role: 'COLLABORATOR',
    collaboratorId: ana._id,
  })

  await User.create({
    email: 'pedro.lima@opsgrid.local',
    passwordHash,
    name: 'Pedro Lima',
    role: 'COLLABORATOR',
    collaboratorId: pedro._id,
  })

  await User.create({
    email: 'mariana.costa@opsgrid.local',
    passwordHash,
    name: 'Mariana Costa',
    role: 'COLLABORATOR',
    collaboratorId: mariana._id,
  })

  await User.create({
    email: 'tiago.ferreira@opsgrid.local',
    passwordHash,
    name: 'Tiago Ferreira',
    role: 'COLLABORATOR',
    collaboratorId: tiagoS._id,
  })

  console.log('✅ Created 5 users')

  // ═══════════════════════════════════════════════════════════
  // PROJECTS
  // ═══════════════════════════════════════════════════════════

  const projDevSecOps = await Project.create({
    name: 'Pipeline DevSecOps Hardening',
    client: 'BankPlus',
    type: 'PROJECT',
    priority: 'CRITICAL',
    status: 'IN_PROGRESS',
    startDate: subDays(new Date(), 30),
    plannedDelivery: addDays(new Date(), 45),
    riskNotes: 'Integração com SAST/DAST tools — dependência de licenças',
  })

  const projObservability = await Project.create({
    name: 'Observability Stack Migration',
    client: 'RetailMax',
    type: 'PROJECT',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    startDate: subDays(new Date(), 20),
    plannedDelivery: addDays(new Date(), 60),
    riskNotes: 'Migração de Prometheus/Grafana para novo cluster',
  })

  const projIncident = await Project.create({
    name: 'Incidente APT29 — Phishing Campaign',
    client: 'BankPlus',
    type: 'INCIDENT',
    priority: 'CRITICAL',
    status: 'IN_PROGRESS',
    startDate: subDays(new Date(), 3),
    plannedDelivery: addDays(new Date(), 7),
    riskNotes: 'Campanha ativa de phishing direcionada — contenção em curso',
  })

  const projZabbix = await Project.create({
    name: 'Zabbix HA Cluster Deployment',
    client: 'Internal',
    type: 'MACRO',
    priority: 'MEDIUM',
    status: 'TRIAGE',
    startDate: subDays(new Date(), 5),
    plannedDelivery: addDays(new Date(), 90),
  })

  const projVPN = await Project.create({
    name: 'Pedido Acesso VPN — Onboarding',
    client: 'Internal',
    type: 'REQUEST',
    priority: 'LOW',
    status: 'IN_PROGRESS',
    startDate: subDays(new Date(), 2),
    plannedDelivery: addDays(new Date(), 3),
  })

  const projSOC = await Project.create({
    name: 'SOC Automation Playbooks',
    client: 'RetailMax',
    type: 'PROJECT',
    priority: 'HIGH',
    status: 'IN_PROGRESS',
    startDate: subDays(new Date(), 15),
    plannedDelivery: addDays(new Date(), 30),
    riskNotes: 'Dependência de API do SIEM para automação',
  })

  const projCompliance = await Project.create({
    name: 'ISO 27001 Audit Preparation',
    client: 'BankPlus',
    type: 'PROJECT',
    priority: 'MEDIUM',
    status: 'BLOCKED',
    startDate: subDays(new Date(), 10),
    plannedDelivery: addDays(new Date(), 60),
    riskNotes: 'Bloqueado — aguarda documentação do cliente',
  })

  const projCloudSec = await Project.create({
    name: 'Cloud Security Posture Mgmt',
    client: 'Internal',
    type: 'PROJECT',
    priority: 'HIGH',
    status: 'NOT_STARTED',
    startDate: addDays(new Date(), 5),
    plannedDelivery: addDays(new Date(), 90),
  })

  console.log('✅ Created 8 projects')

  // ═══════════════════════════════════════════════════════════
  // MACRO ACTIVITIES
  // ═══════════════════════════════════════════════════════════

  const macro1 = await MacroActivity.create({
    projectId: projDevSecOps._id,
    name: 'SAST Integration',
    status: 'DONE',
    progressPct: 100,
    plannedDelivery: subDays(new Date(), 10),
  })

  const macro2 = await MacroActivity.create({
    projectId: projDevSecOps._id,
    name: 'DAST Pipeline Setup',
    status: 'IN_PROGRESS',
    progressPct: 60,
    plannedDelivery: addDays(new Date(), 20),
  })

  const macro3 = await MacroActivity.create({
    projectId: projDevSecOps._id,
    name: 'Secret Scanning & Compliance Gates',
    status: 'NOT_STARTED',
    progressPct: 0,
    plannedDelivery: addDays(new Date(), 45),
  })

  const macro4 = await MacroActivity.create({
    projectId: projObservability._id,
    name: 'Prometheus Federation Setup',
    status: 'IN_PROGRESS',
    progressPct: 40,
    plannedDelivery: addDays(new Date(), 30),
  })

  const macro5 = await MacroActivity.create({
    projectId: projObservability._id,
    name: 'Grafana Dashboards Migration',
    status: 'NOT_STARTED',
    progressPct: 0,
    plannedDelivery: addDays(new Date(), 55),
  })

  const macro6 = await MacroActivity.create({
    projectId: projSOC._id,
    name: 'Playbook Design & Implementation',
    status: 'IN_PROGRESS',
    progressPct: 35,
    plannedDelivery: addDays(new Date(), 25),
  })

  console.log('✅ Created 6 macro activities')

  // ═══════════════════════════════════════════════════════════
  // TIME ENTRIES — realistic data over last 30 days
  // ═══════════════════════════════════════════════════════════

  const collabs = [rodrigo, ana, pedro, mariana, tiagoS]
  const projs = [projDevSecOps, projObservability, projIncident, projZabbix, projVPN, projSOC, projCompliance, projCloudSec]
  const macros = [macro1, macro2, macro3, macro4, macro5, macro6]

  const entryTemplates = [
    // Rodrigo — Leader, split between coordination and hands-on
    { c: 0, p: 0, m: 1, d: 1, h: 4, sup: false, st: 'IN_PROGRESS', pr: 60, n: 'Configuração DAST pipeline — SonarQube integration' },
    { c: 0, p: 2, m: null, d: 2, h: 8, sup: false, st: 'IN_PROGRESS', pr: null, n: 'Coordenação resposta a incidente APT29' },
    { c: 0, p: 5, m: 5, d: 3, h: 6, sup: false, st: 'IN_PROGRESS', pr: 35, n: 'Review playbooks SOC automation' },
    { c: 0, p: 0, m: 1, d: 5, h: 6, sup: false, st: 'IN_PROGRESS', pr: 55, n: 'Ajustes pipeline SAST — false positives' },
    { c: 0, p: 4, m: null, d: 6, h: 2, sup: true, st: 'IN_PROGRESS', pr: null, n: 'Aprovação acesso VPN novo colaborador' },
    { c: 0, p: 6, m: null, d: 8, h: 4, sup: false, st: 'BLOCKED', pr: null, n: 'Preparação documentação ISO 27001' },
    { c: 0, p: 2, m: null, d: 10, h: 8, sup: false, st: 'IN_PROGRESS', pr: null, n: 'Investigação phishing — análise cabeçalhos' },
    { c: 0, p: 5, m: 5, d: 12, h: 6, sup: false, st: 'IN_PROGRESS', pr: 30, n: 'Design playbook ransomware containment' },
    { c: 0, p: 0, m: 0, d: 15, h: 4, sup: false, st: 'DONE', pr: 100, n: 'Validação SAST integration completa' },
    { c: 0, p: 1, m: 3, d: 18, h: 6, sup: false, st: 'IN_PROGRESS', pr: 40, n: 'Setup Prometheus federation' },
    { c: 0, p: 7, m: null, d: 20, h: 2, sup: true, st: 'NOT_STARTED', pr: null, n: 'Planeamento CSPM tooling' },
    { c: 0, p: 2, m: null, d: 22, h: 8, sup: false, st: 'IN_PROGRESS', pr: null, n: 'Liderança resposta incidente — pós-mortem' },

    // Ana — DevSecOps engineer, heavy on pipeline work
    { c: 1, p: 0, m: 1, d: 1, h: 8, sup: false, st: 'IN_PROGRESS', pr: 60, n: 'Implementação DAST scanner no CI/CD' },
    { c: 1, p: 0, m: 2, d: 2, h: 8, sup: false, st: 'IN_PROGRESS', pr: 60, n: 'OWASP ZAP integration no pipeline' },
    { c: 1, p: 5, m: 5, d: 4, h: 6, sup: false, st: 'IN_PROGRESS', pr: 35, n: 'Desenvolvimento playbook auto-remediation' },
    { c: 1, p: 0, m: 2, d: 6, h: 8, sup: false, st: 'IN_PROGRESS', pr: 55, n: 'Configuração compliance gates' },
    { c: 1, p: 6, m: null, d: 8, h: 4, sup: false, st: 'BLOCKED', pr: null, n: 'Levantamento requisitos compliance' },
    { c: 1, p: 0, m: 0, d: 10, h: 6, sup: false, st: 'DONE', pr: 100, n: 'SAST — correção false positives' },
    { c: 1, p: 5, m: 5, d: 13, h: 8, sup: false, st: 'IN_PROGRESS', pr: 30, n: 'Implementação playbook SIEM integration' },
    { c: 1, p: 4, m: null, d: 15, h: 2, sup: true, st: 'IN_PROGRESS', pr: null, n: 'Suporte VPN acesso temporário' },
    { c: 1, p: 0, m: 1, d: 17, h: 8, sup: false, st: 'IN_PROGRESS', pr: 65, n: 'DAST pipeline — testes regressão' },
    { c: 1, p: 7, m: null, d: 20, h: 4, sup: false, st: 'NOT_STARTED', pr: null, n: 'Pesquisa CSPM tools' },

    // Pedro — SRE/Observability
    { c: 2, p: 1, m: 3, d: 1, h: 8, sup: false, st: 'IN_PROGRESS', pr: 40, n: 'Prometheus federation — config clusters' },
    { c: 2, p: 1, m: 3, d: 3, h: 8, sup: false, st: 'IN_PROGRESS', pr: 35, n: 'Configuração alertas multi-cluster' },
    { c: 2, p: 3, m: null, d: 5, h: 6, sup: false, st: 'TRIAGE', pr: null, n: 'Levantamento requisitos Zabbix HA' },
    { c: 2, p: 1, m: 4, d: 7, h: 8, sup: false, st: 'NOT_STARTED', pr: 0, n: 'Início migração dashboards Grafana' },
    { c: 2, p: 4, m: null, d: 9, h: 2, sup: true, st: 'IN_PROGRESS', pr: null, n: 'Suporte monitorização VPN' },
    { c: 2, p: 1, m: 3, d: 11, h: 8, sup: false, st: 'IN_PROGRESS', pr: 45, n: 'Prometheus remote-write setup' },
    { c: 2, p: 3, m: null, d: 14, h: 4, sup: false, st: 'TRIAGE', pr: null, n: 'Design arquitetura Zabbix cluster' },
    { c: 2, p: 1, m: 3, d: 16, h: 8, sup: false, st: 'IN_PROGRESS', pr: 50, n: 'Thanos setup para long-term storage' },
    { c: 2, p: 4, m: null, d: 19, h: 2, sup: true, st: 'IN_PROGRESS', pr: null, n: 'Config VPN novo node' },

    // Mariana — Cyber Security Analyst
    { c: 3, p: 2, m: null, d: 1, h: 8, sup: false, st: 'IN_PROGRESS', pr: null, n: 'Análise forense email phishing' },
    { c: 3, p: 2, m: null, d: 2, h: 8, sup: false, st: 'IN_PROGRESS', pr: null, n: 'Investigação IoC — C2 infrastructure' },
    { c: 3, p: 5, m: 5, d: 4, h: 6, sup: false, st: 'IN_PROGRESS', pr: 35, n: 'Definição regras detecção automatizadas' },
    { c: 3, p: 6, m: null, d: 6, h: 4, sup: false, st: 'BLOCKED', pr: null, n: 'Mapeamento controlos ISO 27001' },
    { c: 3, p: 2, m: null, d: 7, h: 8, sup: false, st: 'IN_PROGRESS', pr: null, n: 'Containment phishing — bloqueio domínios' },
    { c: 3, p: 0, m: 2, d: 9, h: 4, sup: false, st: 'IN_PROGRESS', pr: 55, n: 'Security review DAST findings' },
    { c: 3, p: 5, m: 5, d: 12, h: 6, sup: false, st: 'IN_PROGRESS', pr: 40, n: 'Playbook phishing auto-response' },
    { c: 3, p: 4, m: null, d: 14, h: 2, sup: true, st: 'IN_PROGRESS', pr: null, n: 'Verificação acessos VPN utilizadores' },
    { c: 3, p: 2, m: null, d: 16, h: 8, sup: false, st: 'IN_PROGRESS', pr: null, n: 'Pós-mortem incidente — relatório' },
    { c: 3, p: 7, m: null, d: 19, h: 4, sup: false, st: 'NOT_STARTED', pr: null, n: 'Cloud security assessment setup' },

    // Tiago — Infra & Zabbix
    { c: 4, p: 3, m: null, d: 1, h: 6, sup: false, st: 'TRIAGE', pr: null, n: 'Levantamento requisitos Zabbix HA' },
    { c: 4, p: 4, m: null, d: 2, h: 4, sup: false, st: 'IN_PROGRESS', pr: null, n: 'Configuração VPN site-to-site' },
    { c: 4, p: 3, m: null, d: 4, h: 8, sup: false, st: 'TRIAGE', pr: null, n: 'Design Zabbix cluster — PostgreSQL backend' },
    { c: 4, p: 4, m: null, d: 6, h: 4, sup: true, st: 'IN_PROGRESS', pr: null, n: 'Suporte VPN — troubleshooting' },
    { c: 4, p: 3, m: null, d: 8, h: 8, sup: false, st: 'TRIAGE', pr: null, n: 'Zabbix proxy setup para remotes' },
    { c: 4, p: 1, m: 3, d: 10, h: 4, sup: false, st: 'IN_PROGRESS', pr: 40, n: 'Suporte infra Prometheus' },
    { c: 4, p: 4, m: null, d: 12, h: 2, sup: true, st: 'IN_PROGRESS', pr: null, n: 'Configuração VPN novo escritório' },
    { c: 4, p: 3, m: null, d: 14, h: 6, sup: false, st: 'TRIAGE', pr: null, n: 'Zabbix templates customizados' },
    { c: 4, p: 1, m: 4, d: 17, h: 4, sup: false, st: 'NOT_STARTED', pr: 0, n: 'Setup Grafana data sources' },
    { c: 4, p: 4, m: null, d: 19, h: 2, sup: true, st: 'IN_PROGRESS', pr: null, n: 'Suporte rede — pedido VPN' },
  ]

  const timeEntriesData = []

  for (const t of entryTemplates) {
    const date = subDays(new Date(), t.d)
    const normalizedDate = new Date(date.getFullYear(), date.getMonth(), date.getDate())

    timeEntriesData.push({
      date: normalizedDate,
      projectId: projs[t.p]._id,
      macroId: t.m !== null ? macros[t.m]._id : null,
      collaboratorId: collabs[t.c]._id,
      hours: t.h,
      isSupport: t.sup,
      statusSnapshot: t.st,
      progressSnapshot: t.pr,
      note: t.n,
    })
  }

  await TimeEntry.insertMany(timeEntriesData)
  console.log(`✅ Created ${timeEntriesData.length} time entries`)

  // ═══════════════════════════════════════════════════════════
  // PLANNED ALLOCATIONS — current month
  // ═══════════════════════════════════════════════════════════

  const currentMonth = format(new Date(), 'yyyy-MM')

  const allocations = [
    { proj: projDevSecOps, collab: rodrigo, hours: 40 },
    { proj: projIncident, collab: rodrigo, hours: 40 },
    { proj: projSOC, collab: rodrigo, hours: 30 },
    { proj: projDevSecOps, collab: ana, hours: 80 },
    { proj: projSOC, collab: ana, hours: 40 },
    { proj: projObservability, collab: pedro, hours: 100 },
    { proj: projZabbix, collab: pedro, hours: 30 },
    { proj: projIncident, collab: mariana, hours: 60 },
    { proj: projSOC, collab: mariana, hours: 40 },
    { proj: projCompliance, collab: mariana, hours: 20 },
    { proj: projZabbix, collab: tiagoS, hours: 80 },
    { proj: projVPN, collab: tiagoS, hours: 20 },
  ]

  for (const a of allocations) {
    await PlannedAllocation.create({
      projectId: a.proj._id,
      collaboratorId: a.collab._id,
      month: currentMonth,
      plannedHours: a.hours,
    })
  }

  console.log(`✅ Created ${allocations.length} planned allocations`)

  // ═══════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════

  const counts = {
    users: await User.countDocuments(),
    collaborators: await Collaborator.countDocuments(),
    projects: await Project.countDocuments(),
    macros: await MacroActivity.countDocuments(),
    timeEntries: await TimeEntry.countDocuments(),
    allocations: await PlannedAllocation.countDocuments(),
  }

  console.log('\n📊 Seed Summary:')
  console.log(`   Users: ${counts.users}`)
  console.log(`   Collaborators: ${counts.collaborators}`)
  console.log(`   Projects: ${counts.projects}`)
  console.log(`   Macro Activities: ${counts.macros}`)
  console.log(`   Time Entries: ${counts.timeEntries}`)
  console.log(`   Planned Allocations: ${counts.allocations}`)

  console.log('\n🔐 User Credentials (all passwords: OpsGrid@2026!):')
  console.log('   LEADER:      rodrigo.martins@opsgrid.local')
  console.log('   COLLABORATOR: ana.sousa@opsgrid.local')
  console.log('   COLLABORATOR: pedro.lima@opsgrid.local')
  console.log('   COLLABORATOR: mariana.costa@opsgrid.local')
  console.log('   COLLABORATOR: tiago.ferreira@opsgrid.local')

  console.log('\n🌱 Seeding complete!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await mongoose.disconnect()
  })
