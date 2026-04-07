import { IntegrationBase } from "@/modules/integrations/types/integration";

export const INTEGRATIONS: IntegrationBase[] = [
  {
    id: "google-calendar",
    name: "Google Calendar",
    description: "Sincronize eventos com sua agenda.",
    status: "DISPONIVEL",
    fields: [
      { id: "apiKey", label: "API Key", placeholder: "AIza..." },
      { id: "calendarId", label: "ID do Calendario", placeholder: "primario" },
    ],
  },
  {
    id: "google-meet",
    name: "Google Meet",
    description: "Links e reunioes automaticas.",
    status: "EM_BREVE",
    fields: [
      { id: "workspaceId", label: "Workspace ID" },
      { id: "botToken", label: "Bot Token" },
    ],
  },
  {
    id: "whatsapp-api",
    name: "WhatsApp API",
    description: "Envie notificacoes e mensagens.",
    status: "DISPONIVEL",
    fields: [
      { id: "phoneNumber", label: "Numero", placeholder: "+55 11 99999-9999" },
      { id: "token", label: "Token API", placeholder: "EAAM..." },
    ],
  },
  {
    id: "webhook-http",
    name: "Webhook HTTP",
    description: "Dispare eventos personalizados.",
    status: "DISPONIVEL",
    fields: [
      { id: "endpoint", label: "URL do Endpoint", placeholder: "https://..." },
      { id: "secret", label: "Token Secreto", placeholder: "******" },
    ],
  },
  {
    id: "supabase",
    name: "Supabase",
    description: "Banco e auth prontos para uso.",
    status: "DISPONIVEL",
    fields: [
      { id: "projectUrl", label: "URL do Projeto", placeholder: "https://xxxxx.supabase.co" },
      { id: "anonKey", label: "Chave Publica", placeholder: "eyJhbGci..." },
    ],
  },
  {
    id: "ixc",
    name: "IXC Provedor",
    description: "Configurar host/user/pass/IDs para comodato via webservice/v1.",
    status: "DISPONIVEL",
    fields: [
      { id: "profileName", label: "Cliente", placeholder: "Lorenzo / Cliente A" },
      { id: "host", label: "URL do IXC", placeholder: "https://seu-ixc/webservice/v1" },
      { id: "user", label: "Usuario (Basic)", placeholder: "IXC_USER" },
      { id: "pass", label: "Senha (Basic)", placeholder: "IXC_PASS" },
      { id: "idUnidade", label: "ID unidade", placeholder: "1" },
      { id: "idAlmox", label: "ID almox", placeholder: "39" },
      { id: "filialId", label: "Filial ID", placeholder: "1" },
      { id: "valorUnitario", label: "Valor unitario", placeholder: "0.10" },
    ],
  },
];
