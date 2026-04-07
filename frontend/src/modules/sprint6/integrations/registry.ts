// ── Sprint 6.0 — Integration Registry ──────────────────────────────
// Single source of truth for all data integrations used by the Sprint 6.0
// test area dashboards. Each entry describes a data connection, its status,
// the table/hook/service involved, and any pending dependencies.
//
// This registry powers the Integrações & Conexões KPI page and serves as
// the technical map for wiring real data sources later.

export type IntegrationStatus = "active" | "prepared" | "pending";

export type IntegrationCategory =
  | "database"
  | "hook"
  | "edge-function"
  | "external-api"
  | "future";

export interface IntegrationEntry {
  id: string;
  /** Human-readable name */
  name: string;
  /** Which dashboard(s) consume this */
  consumers: string[];
  category: IntegrationCategory;
  status: IntegrationStatus;
  /** DB table, RPC, or external endpoint */
  source: string;
  /** Frontend hook or service file */
  hookOrService: string | null;
  /** Types file / interface used */
  typesRef: string | null;
  /** Brief description of what it provides */
  description: string;
  /** What's missing for full functionality */
  pendingDeps: string[];
}

// ── Registry ────────────────────────────────────────────────────────

export const INTEGRATION_REGISTRY: IntegrationEntry[] = [
  // ─── Active (data flowing) ────────────────────────────────────────
  {
    id: "elapsed-times",
    name: "Tempos Decorridos (Bitrix)",
    consumers: ["ROI", "Capacidade"],
    category: "external-api",
    status: "active",
    source: "External Supabase → RPC sync-bitrix-times",
    hookOrService: "src/modules/tasks/api/useElapsedTimes.ts",
    typesRef: "src/modules/tasks/types.ts",
    description: "Registros individuais de tempo por tarefa, vindos do Bitrix via edge function de sincronização.",
    pendingDeps: [],
  },
  {
    id: "project-hours",
    name: "Horas por Projeto (RPC)",
    consumers: ["ROI"],
    category: "external-api",
    status: "active",
    source: "External Supabase → RPC get_consumo_horas",
    hookOrService: "src/modules/tasks/api/useProjectHours.ts",
    typesRef: "src/modules/tasks/types.ts",
    description: "Horas realizadas agregadas por projeto, via RPC no Supabase externo.",
    pendingDeps: [],
  },
  {
    id: "tasks-bitrix",
    name: "Tarefas (Bitrix)",
    consumers: ["ROI", "Capacidade"],
    category: "external-api",
    status: "active",
    source: "External Supabase → Edge Function Get-Projetcs-And-Tasks-Bitrix",
    hookOrService: "src/modules/tasks/api/useTasks.ts",
    typesRef: "src/modules/tasks/types.ts",
    description: "Lista de tarefas com responsável, projeto e status, sincronizadas do Bitrix.",
    pendingDeps: [],
  },
  {
    id: "contracted-hours",
    name: "Horas Contratadas",
    consumers: ["ROI"],
    category: "database",
    status: "active",
    source: "Lovable Cloud → project_contracted_hours",
    hookOrService: "src/modules/analytics/hooks/useContractedHours.ts",
    typesRef: null,
    description: "Horas contratadas por projeto. Tabela criada e hook funcional com upsert.",
    pendingDeps: [],
  },
  {
    id: "users-table",
    name: "Tabela de Usuários",
    consumers: ["Capacidade", "Cadastros"],
    category: "database",
    status: "active",
    source: "Lovable Cloud → users",
    hookOrService: "src/modules/users/api/useUsersApi.ts",
    typesRef: "src/modules/users/types.ts",
    description: "Dados base de usuários incluindo department e seniority_level (colunas já criadas).",
    pendingDeps: [],
  },

  // ─── Active (tables + hooks consuming) ─────────────────────────────
  {
    id: "user-capacity",
    name: "Capacidade de Usuários",
    consumers: ["Capacidade"],
    category: "database",
    status: "active",
    source: "Lovable Cloud → user_capacity",
    hookOrService: "src/modules/sprint6/hooks/useCapacityData.ts",
    typesRef: "src/modules/sprint6/types.ts → CapacityUser",
    description: "Horas disponíveis por usuário/mês. Consumido pelo useCapacityData para cálculo de utilização % e sobrecarga.",
    pendingDeps: [],
  },
  {
    id: "client-kpis",
    name: "KPIs de Clientes",
    consumers: ["Saúde do Cliente"],
    category: "database",
    status: "active",
    source: "Lovable Cloud → client_kpis",
    hookOrService: "src/modules/sprint6/hooks/useClientHealthData.ts",
    typesRef: "src/modules/sprint6/types.ts → ClientKpi",
    description: "EBITDA, Churn e NPS por cliente/mês. Consumido pelo useClientHealthData com cálculo de health score e detecção de risco.",
    pendingDeps: [],
  },
  {
    id: "client-benchmarks",
    name: "Benchmarks Setoriais",
    consumers: ["Saúde do Cliente"],
    category: "database",
    status: "active",
    source: "Lovable Cloud → client_benchmarks",
    hookOrService: "src/modules/sprint6/hooks/useClientHealthData.ts",
    typesRef: "src/modules/sprint6/types.ts → ClientHealthSummary.benchmarks",
    description: "Médias setoriais de EBITDA, Churn e NPS. Consumido para calibrar a fórmula de health score.",
    pendingDeps: [],
  },
  {
    id: "users-department",
    name: "Departamento (users.department)",
    consumers: ["Capacidade"],
    category: "database",
    status: "active",
    source: "Lovable Cloud → users.department",
    hookOrService: "src/modules/sprint6/hooks/useCapacityData.ts",
    typesRef: null,
    description: "Coluna department consumida pelo useCapacityData. Filtro de departamento ativo no Sprint6Filters.",
    pendingDeps: [],
  },
  {
    id: "users-seniority",
    name: "Senioridade (users.seniority_level)",
    consumers: ["Capacidade"],
    category: "database",
    status: "active",
    source: "Lovable Cloud → users.seniority_level",
    hookOrService: "src/modules/sprint6/hooks/useCapacityData.ts",
    typesRef: "src/modules/sprint6/types.ts → SeniorityLevel",
    description: "Coluna seniority_level consumida pelo useCapacityData. Filtro de senioridade ativo no Sprint6Filters.",
    pendingDeps: [],
  },

  // ─── Active (newly created) ────────────────────────────────────────
  {
    id: "project-financials",
    name: "Dados Financeiros de Projetos",
    consumers: ["ROI"],
    category: "database",
    status: "active",
    source: "Lovable Cloud → project_financials",
    hookOrService: "src/modules/sprint6/hooks/useProjectFinancials.ts",
    typesRef: "src/modules/sprint6/hooks/useProjectFinancials.ts → ProjectFinancialRow",
    description: "Receita, custo/hora e custo total estimado por projeto. Consumido pelo useRoiData para cálculo de ROI %.",
    pendingDeps: [],
  },
  {
    id: "health-score-config",
    name: "Pesos do Health Score (Configurável)",
    consumers: ["Saúde do Cliente"],
    category: "database",
    status: "active",
    source: "Lovable Cloud → health_score_config",
    hookOrService: "src/modules/sprint6/hooks/useClientHealthData.ts",
    typesRef: null,
    description: "Pesos configuráveis (EBITDA/Churn/NPS) para a fórmula de Health Score. Admin pode alterar via Cadastros Manuais.",
    pendingDeps: [],
  },
  {
    id: "health-score-formula",
    name: "Fórmula de Health Score",
    consumers: ["Saúde do Cliente"],
    category: "hook",
    status: "active",
    source: "Cálculo derivado no useClientHealthData",
    hookOrService: "src/modules/sprint6/hooks/useClientHealthData.ts",
    typesRef: "src/modules/sprint6/types.ts → ClientKpi.healthScore",
    description: "Fórmula ponderada com pesos configuráveis da tabela health_score_config. Limiar de risco: score < 40. Fallback: 40/30/30.",
    pendingDeps: [],
  },
  {
    id: "erp-crm-import",
    name: "Import Automático (ERP/CRM)",
    consumers: ["Saúde do Cliente"],
    category: "future",
    status: "pending",
    source: "Integração externa (a definir)",
    hookOrService: null,
    typesRef: null,
    description: "Importação automática de EBITDA, Churn e NPS a partir de sistemas ERP/CRM do cliente.",
    pendingDeps: [
      "Definir sistema de origem (ERP/CRM específico)",
      "Criar edge function para sincronização",
      "Mapear campos entre sistema externo e client_kpis",
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────

export function getIntegrationsByStatus(status: IntegrationStatus): IntegrationEntry[] {
  return INTEGRATION_REGISTRY.filter((i) => i.status === status);
}

export function getIntegrationsByConsumer(consumer: string): IntegrationEntry[] {
  return INTEGRATION_REGISTRY.filter((i) => i.consumers.includes(consumer));
}

export function getIntegrationStats() {
  const active = INTEGRATION_REGISTRY.filter((i) => i.status === "active").length;
  const prepared = INTEGRATION_REGISTRY.filter((i) => i.status === "prepared").length;
  const pending = INTEGRATION_REGISTRY.filter((i) => i.status === "pending").length;
  return { active, prepared, pending, total: INTEGRATION_REGISTRY.length };
}
