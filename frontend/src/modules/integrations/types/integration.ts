export type IntegrationStatus = "DISPONIVEL" | "EM_BREVE" | "CONECTADO";

export type IntegrationField = {
  id: string;
  label: string;
  placeholder?: string;
  type?: string;
  helperText?: string;
};

export type IntegrationBase = {
  id: string;
  name: string;
  description: string;
  status: IntegrationStatus;
  fields: IntegrationField[];
};

export type IntegrationProfile = {
  name: string;
  data: Record<string, string>;
};

export type IntegrationState = {
  status: IntegrationStatus;
  config?: Record<string, string>;
  profiles?: IntegrationProfile[];
  activeProfile?: string;
};

export type IntegrationWithState = IntegrationBase & {
  config?: Record<string, string>;
  profiles?: IntegrationProfile[];
  activeProfile?: string;
};
