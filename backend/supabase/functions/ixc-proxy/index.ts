import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const EXT_URL = "https://stubkeeuttixteqckshd.supabase.co";
const EXT_ANON =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN0dWJrZWV1dHRpeHRlcWNrc2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc0NjQ0OTIsImV4cCI6MjA3MzA0MDQ5Mn0.YcpSKrTSb1P1REC8lgkdduDITX52h_z7ArPD6XIkrlU";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function errRes(message: string, status = 400) {
  return jsonRes({ ok: false, error: message }, status);
}

/* ── IXC helper ── */
async function ixcRequest(
  host: string,
  endpoint: string,
  user: string,
  pass: string,
  body: Record<string, unknown>,
  method = "POST"
) {
  const url = `${host.replace(/\/+$/, "")}/${endpoint.replace(/^\/+/, "")}`;
  const auth = btoa(`${user}:${pass}`);

  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${auth}`,
      ixcsoft: "listar",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text, status: res.status };
  }
}

/* ── Consultar ── */
async function handleConsultar(
  config: Record<string, string>,
  pppoe: string,
  serial?: string
) {
  const { host, user, pass } = config;

  // 1. Find radusuario by pppoe
  const radRes = await ixcRequest(host, "radusuarios", user, pass, {
    qtype: "login",
    query: pppoe,
    ession: 1,
    grid_param: JSON.stringify([
      { TB: "radusuarios.*" },
    ]),
  });

  const radList = radRes?.registros ? Object.values(radRes.registros).filter((r: unknown) => typeof r === "object" && r !== null) : [];
  const radusuario = (radList[0] ?? {}) as Record<string, unknown>;
  const contratoId = String(radusuario?.id_contrato ?? "");

  if (!contratoId) {
    return { ok: true, data: { contratoId: "", contrato: {}, radusuario, comodatos: [], patrimonio: null, messages: ["PPPoE não encontrado ou sem contrato."] } };
  }

  // 2. Get contrato
  const contratoRes = await ixcRequest(host, "cliente_contrato", user, pass, {
    qtype: "cliente_contrato.id",
    query: contratoId,
    oper: "=",
    grid_param: JSON.stringify([{ TB: "cliente_contrato.*" }]),
  });
  const contratoList = contratoRes?.registros ? Object.values(contratoRes.registros).filter((r: unknown) => typeof r === "object" && r !== null) : [];
  const contrato = (contratoList[0] ?? {}) as Record<string, unknown>;

  // 3. Get comodatos
  const comodatoRes = await ixcRequest(host, "v_comodato", user, pass, {
    qtype: "v_comodato.id_contrato",
    query: contratoId,
    oper: "=",
    grid_param: JSON.stringify([{ TB: "v_comodato.*" }]),
  });
  const comodatos = comodatoRes?.registros
    ? Object.values(comodatoRes.registros).filter((r: unknown) => typeof r === "object" && r !== null)
    : [];

  // 4. Get patrimonio by serial (if provided)
  let patrimonio: Record<string, unknown> | null = null;
  const serialToSearch = serial || (radusuario?.mac as string) || "";
  if (serialToSearch) {
    const patriRes = await ixcRequest(host, "patrimonio", user, pass, {
      qtype: "patrimonio.numero_serie",
      query: serialToSearch,
      oper: "=",
      grid_param: JSON.stringify([{ TB: "patrimonio.*" }]),
    });
    const patriList = patriRes?.registros ? Object.values(patriRes.registros).filter((r: unknown) => typeof r === "object" && r !== null) : [];
    patrimonio = (patriList[0] as Record<string, unknown>) ?? null;
  }

  const messages: string[] = [];
  if (comodatos.length > 0) messages.push(`${comodatos.length} comodato(s) encontrado(s).`);
  if (patrimonio) messages.push("Patrimônio localizado.");
  if (!patrimonio && serialToSearch) messages.push("Patrimônio não localizado para o serial informado.");

  return {
    ok: true,
    data: { contratoId, contrato, radusuario, comodatos, patrimonio, messages },
  };
}

/* ── Lançar ── */
async function handleLancar(
  config: Record<string, string>,
  payload: Record<string, unknown>
) {
  const { host, user, pass } = config;
  const contratoId = String(payload.contratoId ?? "");
  const numeroSerie = String(payload.numeroSerie ?? "");

  if (!contratoId || !numeroSerie) {
    return { ok: false, error: "contratoId e numeroSerie são obrigatórios." };
  }

  // Check if already exists
  const checkRes = await ixcRequest(host, "v_comodato", user, pass, {
    qtype: "v_comodato.id_contrato",
    query: contratoId,
    oper: "=",
    grid_param: JSON.stringify([{ TB: "v_comodato.*" }]),
  });
  const existingList = checkRes?.registros
    ? Object.values(checkRes.registros).filter((r: unknown) => {
        if (typeof r !== "object" || r === null) return false;
        const rec = r as Record<string, unknown>;
        return String(rec.numero_serie ?? "").toLowerCase() === numeroSerie.toLowerCase();
      })
    : [];

  if (existingList.length > 0) {
    return {
      ok: true,
      data: {
        status: "already_exists",
        contratoId,
        numeroSerie,
        payloadEnviado: payload,
        patrimonioUsado: {},
        respostaIXC: existingList[0] as Record<string, unknown>,
      },
    };
  }

  // Build comodato payload
  const now = new Date().toISOString().slice(0, 10);
  const comodatoPayload: Record<string, unknown> = {
    id_contrato: contratoId,
    numero_serie: numeroSerie,
    numero_patrimonial: payload.numeroPatrimonial ?? "",
    descricao: payload.descricao ?? "Equipamento",
    valor_unitario: payload.valorUnitario ?? config.valorUnitario ?? "0.10",
    id_patrimonio: payload.idPatrimonio ?? "",
    mac: payload.mac ?? "",
    qtde: payload.qtde ?? 1,
    data: payload.data ?? now,
    id_unidade: config.idUnidade ?? "1",
    id_almox: config.idAlmox ?? "39",
    filial_id: config.filialId ?? "1",
  };

  const launchRes = await ixcRequest(host, "v_comodato", user, pass, comodatoPayload);

  return {
    ok: true,
    data: {
      status: "inserted",
      contratoId,
      numeroSerie,
      payloadEnviado: comodatoPayload,
      patrimonioUsado: { id: payload.idPatrimonio },
      respostaIXC: launchRes,
    },
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth validation: require valid Bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errRes("Não autorizado.", 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const callerClient = createClient(EXT_URL, EXT_ANON, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return errRes("Token inválido.", 401);
    }

    const body = await req.json();
    const { action, config, ...rest } = body;

    if (!config?.host || !config?.user || !config?.pass) {
      return errRes("Configuração IXC incompleta. Configure a integração IXC primeiro.");
    }

    if (action === "consultar") {
      const result = await handleConsultar(config, rest.pppoe, rest.serial);
      return jsonRes(result);
    }

    if (action === "lancar") {
      const result = await handleLancar(config, rest);
      return jsonRes(result);
    }

    return errRes("Ação inválida. Use 'consultar' ou 'lancar'.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno";
    return errRes(message, 500);
  }
});
