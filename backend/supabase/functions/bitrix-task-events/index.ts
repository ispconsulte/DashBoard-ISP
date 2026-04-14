import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-bitrix-event-token",
};

const EXT_URL = "https://stubkeeuttixteqckshd.supabase.co";

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function validateBigintId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseDate(value: unknown) {
  if (!value) return null;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function readPayload(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return await req.json().catch(() => ({}));
  }

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data") ||
    contentType.includes("text/plain")
  ) {
    const form = await req.formData().catch(() => null);
    if (!form) return {};
    const result: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      const rawValue = typeof value === "string" ? value : value.name;
      const segments = key.split(/\[|\]/).filter(Boolean);

      if (!segments.length) {
        result[key] = rawValue;
        continue;
      }

      let current: Record<string, unknown> = result;
      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index];
        const isLast = index === segments.length - 1;
        if (isLast) {
          current[segment] = rawValue;
          continue;
        }
        const next = current[segment];
        if (!next || typeof next !== "object" || Array.isArray(next)) {
          current[segment] = {};
        }
        current = current[segment] as Record<string, unknown>;
      }
    }
    return result;
  }

  return {};
}

function extractEventName(payload: Record<string, unknown>) {
  return String(
    payload.event ??
      payload.EVENT ??
      payload.event_name ??
      payload.EVENT_NAME ??
      "",
  ).trim();
}

function getRecord(value: unknown) {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function extractTaskId(payload: Record<string, unknown>) {
  const data = getRecord(payload.data);
  const fieldsBefore = getRecord(data.FIELDS_BEFORE);
  const auth = getRecord(payload.auth);

  return (
    validateBigintId(payload.task_id) ??
    validateBigintId(payload.TASK_ID) ??
    validateBigintId(payload.id) ??
    validateBigintId(payload.ID) ??
    validateBigintId(data.task_id) ??
    validateBigintId(data.TASK_ID) ??
    validateBigintId(fieldsBefore.ID) ??
    validateBigintId(auth.task_id) ??
    null
  );
}

function extractDeletedAt(payload: Record<string, unknown>) {
  const data = getRecord(payload.data);
  const auth = getRecord(payload.auth);
  return (
    parseDate(payload.deleted_at) ??
    parseDate(payload.ts) ??
    parseDate(payload.event_ts) ??
    parseDate(data.deleted_at) ??
    parseDate(data.EVENT_TS) ??
    parseDate(auth.date) ??
    new Date().toISOString()
  );
}

function isAuthorized(req: Request, payload: Record<string, unknown>) {
  const expectedSecret = Deno.env.get("BITRIX_EVENT_SECRET")?.trim();
  if (!expectedSecret) {
    console.warn("[bitrix-task-events] BITRIX_EVENT_SECRET nao configurado. Aceitando webhook sem validacao explicita.");
    return true;
  }

  const headerSecret = req.headers.get("x-bitrix-event-token")?.trim();
  const auth = getRecord(payload.auth);
  const payloadSecret = String(auth.application_token ?? payload.application_token ?? "").trim();

  return headerSecret === expectedSecret || payloadSecret === expectedSecret;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonRes({ ok: false, error: "Metodo nao suportado." }, 405);
  }

  try {
    const serviceRoleKey = Deno.env.get("EXT_SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return jsonRes({ ok: false, error: "Configuracao do servidor incompleta." }, 500);
    }

    const payload = (await readPayload(req)) as Record<string, unknown>;
    const eventName = extractEventName(payload);
    const normalizedEvent = normalizeText(eventName);

    if (!isAuthorized(req, payload)) {
      console.warn("[bitrix-task-events] Requisicao rejeitada por token invalido.", { eventName, payload });
      return jsonRes({ ok: false, error: "Nao autorizado." }, 401);
    }

    if (normalizedEvent !== "ontaskdelete") {
      console.log("[bitrix-task-events] Evento ignorado.", { eventName, keys: Object.keys(payload) });
      return jsonRes({ ok: true, ignored: true, reason: "Evento nao tratado." });
    }

    const taskId = extractTaskId(payload);
    if (!taskId) {
      console.warn("[bitrix-task-events] OnTaskDelete recebido sem task_id valido.", payload);
      return jsonRes({ ok: false, error: "task_id nao identificado no payload." }, 400);
    }

    const deletedAt = extractDeletedAt(payload);
    const adminClient = createClient(EXT_URL, serviceRoleKey);

    const { error } = await adminClient
      .from("bitrix_task_delete_events")
      .upsert(
        {
          task_id: taskId,
          event_name: "OnTaskDelete",
          deleted_at: deletedAt,
          raw_payload: payload,
          received_at: new Date().toISOString(),
          source: "bitrix_webhook",
        },
        { onConflict: "task_id" },
      );

    if (error) {
      console.error("[bitrix-task-events] Falha ao persistir evento OnTaskDelete.", {
        taskId,
        deletedAt,
        error: error.message,
      });
      return jsonRes({ ok: false, error: `Falha ao salvar evento: ${error.message}` }, 500);
    }

    console.log("[bitrix-task-events] Evento OnTaskDelete registrado com sucesso.", {
      taskId,
      deletedAt,
    });

    return jsonRes({
      ok: true,
      task_id: taskId,
      deleted_at: deletedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[bitrix-task-events] Erro inesperado.", { message });
    return jsonRes({ ok: false, error: message || "Falha inesperada." }, 500);
  }
});
