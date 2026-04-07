export const PERFIS = ["Administrador", "Consultor", "Gerente", "Coordenador", "Cliente"] as const;
export type Perfil = (typeof PERFIS)[number];

export const PERFIL_TO_ROLE: Record<Perfil, string> = {
  Administrador: "admin",
  Consultor: "consultor",
  Gerente: "gerente",
  Coordenador: "coordenador",
  Cliente: "cliente",
};

export const ROLE_TO_PERFIL: Record<string, Perfil> = {
  admin: "Administrador",
  consultor: "Consultor",
  gerente: "Gerente",
  coordenador: "Coordenador",
  cliente: "Cliente",
};

export const ALL_AREAS = [
  { value: "home", label: "Página Inicial" },
  { value: "tarefas", label: "Tarefas" },
  { value: "analiticas", label: "Analíticas" },
  { value: "calendario", label: "Calendário" },
  { value: "gamificacao", label: "Ranking" },
  { value: "ferramentas", label: "Ferramentas" },
  { value: "comodato", label: "Comodato" },
  { value: "integracoes", label: "Integrações" },
  { value: "usuarios", label: "Usuários" },
  { value: "suporte", label: "Suporte" },
  { value: "sprint", label: "Sprint" },
  { value: "bonificacao", label: "Bonificação" },
  { value: "clientes", label: "Página do Cliente" },
  { value: "diagnostico", label: "Diagnóstico" },
] as const;

export type UserRow = {
  id: string;
  auth_user_id: string;
  email: string;
  name: string;
  user_profile: string;
  active: boolean;
  role?: string;
  bonus_role?: "admin" | "gestor" | "consultor";
  seniority?: "junior" | "pleno" | "senior" | null;
  subordinate_ids?: string[];
  my_coordinator?: string | null;
  bitrix_user_id?: string | null;
  cliente_id?: number | null;
};

export type ProjectRow = {
  id: number;
  name: string;
  active: boolean;
};

export type ClienteRow = {
  cliente_id: number;
  nome: string;
  Ativo: boolean;
};

export type AuditRow = {
  id: string;
  performed_by: string;
  target_user_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
};
