import { toast } from "sonner";

/**
 * Camada global de erros amigáveis.
 *
 * Objetivo: uma única fonte de mensagens em PT-BR para os tipos de falha mais
 * comuns (HTTP 4xx/5xx, rede/offline, timeout, banco, sincronização, PDF, e-mail).
 * Os detalhes técnicos continuam disponíveis apenas para log/debug — nunca como
 * texto principal exibido ao usuário.
 *
 * Uso típico:
 *   import { notifyError } from "@/lib/friendlyError";
 *   try { ... } catch (e) { notifyError(e, { context: "salvar-usuario" }); }
 *
 * Ou apenas para obter a mensagem:
 *   toast.error(friendlyErrorMessage(e, "pdf"));
 */

/** Categorias de falha conhecidas. */
export type FriendlyErrorKind =
  | "validation"      // 400
  | "unauthorized"    // 401
  | "forbidden"       // 403
  | "notFound"        // 404
  | "timeout"         // 408 / abort
  | "server"          // 500
  | "unavailable"     // 503 / API fora do ar
  | "database"        // falha de conexão com o banco
  | "network"         // rede/offline
  | "sync"            // sincronização (ex.: Bitrix)
  | "save"            // falha ao salvar/atualizar
  | "pdf"             // geração de PDF
  | "email"           // envio de e-mail
  | "unknown";        // runtime inesperado

/** Mensagens PT-BR padronizadas (UTF-8, sem entidades HTML). */
const MESSAGES: Record<FriendlyErrorKind, string> = {
  validation: "Não foi possível concluir: revise os dados informados e tente novamente.",
  unauthorized: "Sua sessão expirou. Faça login novamente para continuar.",
  forbidden: "Você não tem permissão para realizar esta ação.",
  notFound: "Não encontramos o que você procura. Atualize a página e tente novamente.",
  timeout: "A operação demorou mais que o esperado. Verifique sua conexão e tente novamente.",
  server: "Estamos passando por uma instabilidade interna. Tente novamente em alguns instantes ou acione o time responsável.",
  unavailable: "A integração está temporariamente indisponível. Os dados locais continuam disponíveis quando aplicável.",
  database: "Não foi possível conectar ao banco de dados no momento. Tente novamente em breve ou acione o time de desenvolvimento.",
  network: "Você parece estar sem conexão. Verifique sua internet e tente novamente.",
  sync: "Não foi possível sincronizar agora. Os dados locais continuam disponíveis. Tente novamente em instantes.",
  save: "Não foi possível salvar as alterações agora. Tente novamente em instantes.",
  pdf: "Não foi possível gerar o PDF agora. Tente novamente ou acione o suporte.",
  email: "Não foi possível enviar o e-mail no momento. Baixe o PDF e envie manualmente, ou acione o time responsável.",
  unknown: "Estamos passando por uma instabilidade interna. Tente novamente em alguns instantes ou acione o time responsável.",
};

/** Texto técnico bruto de um erro desconhecido, sem lançar. */
export function rawErrorText(error: unknown): string {
  if (error == null) return "";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const msg = obj.message ?? obj.error ?? obj.error_description ?? obj.details;
    if (typeof msg === "string") return msg;
    try { return JSON.stringify(error); } catch { return String(error); }
  }
  return String(error);
}

/** Extrai um código HTTP do erro (objeto .status/.code ou mensagem "HTTP 404"). */
function extractHttpStatus(error: unknown, text: string): number | null {
  if (error && typeof error === "object") {
    const obj = error as Record<string, unknown>;
    const candidate = obj.status ?? obj.statusCode ?? obj.code;
    const n = typeof candidate === "number" ? candidate : Number(candidate);
    if (Number.isInteger(n) && n >= 400 && n <= 599) return n;
  }
  const match = text.match(/\b(4\d{2}|5\d{2})\b/);
  if (match) {
    const n = Number(match[1]);
    if (n >= 400 && n <= 599) return n;
  }
  return null;
}

/**
 * Classifica um erro desconhecido numa categoria amigável.
 * `hint` permite forçar o domínio quando o chamador já sabe o contexto
 * (ex.: "pdf", "email", "sync", "save").
 */
export function classifyError(error: unknown, hint?: FriendlyErrorKind): FriendlyErrorKind {
  // Offline é detectável de forma confiável pelo navegador.
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "network";

  const text = rawErrorText(error).toLowerCase();

  // Erros de rede do fetch e abortos/timeout independem de status.
  if (/failed to fetch|networkerror|network request failed|load failed|err_network|connection refused/.test(text)) {
    return "network";
  }
  if (error instanceof Error && error.name === "AbortError") return "timeout";
  if (/timed? ?out|timeout|etimedout|deadline exceeded/.test(text)) return "timeout";

  const status = extractHttpStatus(error, text);
  if (status === 400 || status === 422) return "validation";
  if (status === 401) return "unauthorized";
  if (status === 403) return "forbidden";
  if (status === 404) return "notFound";
  if (status === 408) return "timeout";
  if (status === 503) return "unavailable";
  if (status === 500 || status === 502 || status === 504) return "server";

  // Sinais textuais de sessão/permissão/banco mesmo sem status numérico.
  if (/jwt|token|unauthorized|not authenticated|sess(ã|a)o|auth/.test(text)) return "unauthorized";
  if (/permission|forbidden|not allowed|rls|row-level security|policy/.test(text)) return "forbidden";
  if (/(database|postgres|connection|ecconn|econnrefused|pool|relation .* does not exist)/.test(text)) return "database";

  // Caso o chamador conheça o domínio, usa como último recurso antes de "unknown".
  if (hint) return hint;

  return "unknown";
}

/** Retorna a mensagem amigável PT-BR para um erro desconhecido. */
export function friendlyErrorMessage(error: unknown, hint?: FriendlyErrorKind): string {
  return MESSAGES[classifyError(error, hint)];
}

/** Acesso direto à mensagem padrão de uma categoria. */
export function friendlyMessageFor(kind: FriendlyErrorKind): string {
  return MESSAGES[kind];
}

/* ── Anti-flood: evita repetir o mesmo log/toast em rajada ─────────────── */
const recentLogs = new Map<string, number>();
const FLOOD_WINDOW_MS = 4000;

function shouldEmit(key: string): boolean {
  const now = Date.now();
  const last = recentLogs.get(key);
  if (last && now - last < FLOOD_WINDOW_MS) return false;
  recentLogs.set(key, now);
  // Limpeza leve para não crescer indefinidamente.
  if (recentLogs.size > 50) {
    for (const [k, t] of recentLogs) {
      if (now - t > FLOOD_WINDOW_MS) recentLogs.delete(k);
    }
  }
  return true;
}

export type NotifyOptions = {
  /** Rótulo de contexto para o log (ex.: "salvar-usuario"). */
  context?: string;
  /** Força a categoria quando o chamador já conhece o domínio. */
  hint?: FriendlyErrorKind;
  /** Mensagem amigável customizada (sobrepõe o mapeamento). */
  message?: string;
  /** Exibe toast (padrão: true). */
  toast?: boolean;
  /** Duração do toast em ms. */
  duration?: number;
};

/**
 * Loga o detalhe técnico uma única vez (com proteção anti-flood) e exibe um
 * toast amigável em PT-BR. Retorna a mensagem exibida.
 */
export function notifyError(error: unknown, options: NotifyOptions = {}): string {
  const kind = options.hint && classifyError(error, options.hint) === "unknown"
    ? options.hint
    : classifyError(error, options.hint);
  const message = options.message ?? MESSAGES[kind];
  const context = options.context ?? "app";
  const detail = rawErrorText(error);

  // Anti-flood por contexto + categoria + detalhe.
  const key = `${context}:${kind}:${detail}`;
  if (shouldEmit(key)) {
    console.warn(`[${context}] (${kind}) ${detail || "erro sem detalhe"}`);
    if (options.toast !== false) {
      toast.error(message, { duration: options.duration ?? 6000 });
    }
  }
  return message;
}
