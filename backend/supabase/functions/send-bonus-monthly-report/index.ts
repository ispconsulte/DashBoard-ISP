import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Max-Age": "86400",
};

function monthLabel(month: number, year: number) {
  return `${String(month).padStart(2, "0")}/${year}`;
}

function money(value: number | null | undefined) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value ?? 0));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const resendApiKey = Deno.env.get("RESEND_API_KEY") ?? "";
    const fromEmail = Deno.env.get("BONUS_REPORT_FROM_EMAIL") ?? "bonificacao@ispconsulle.com.br";

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const token = authHeader.replace("Bearer ", "");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: authData } = await userClient.auth.getUser(token);
    const senderAuthUserId = authData.user?.id ?? null;
    if (!senderAuthUserId) {
      return new Response(JSON.stringify({ error: "Sessão inválida." }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { consultantId, month, year, coordinatorMessage, recipientEmail } = await req.json();
    const periodKey = `${year}-${String(month).padStart(2, "0")}`;

    const [{ data: consultant }, { data: sender }, { data: snapshotRows }, { data: evaluationRows }, { data: pmSetting }] = await Promise.all([
      supabase.from("users").select("id,name,email,role,seniority").eq("id", consultantId).single(),
      supabase.from("users").select("id,name,role").eq("auth_user_id", senderAuthUserId).single(),
      supabase.from("bonus_score_snapshots").select("*").eq("snapshot_kind", "consultant_monthly").eq("period_key", periodKey).eq("user_id", consultantId).limit(1),
      supabase.from("bonus_internal_evaluations").select("*").eq("evaluation_scope", "consultant").eq("user_id", consultantId).eq("period_month", month).eq("period_year", year).order("category").order("subtopic"),
      supabase.from("bonus_settings").select("value").eq("key", "payment_manager_user_id").limit(1),
    ]);

    // Enforce monetary visibility server-side: only payment_manager or admin sees payout values
    const pmUserId = pmSetting?.[0]?.value ?? null;
    const senderIsPaymentManager = pmUserId !== null && String(sender?.id) === String(pmUserId);
    const senderIsAdmin = sender?.role === "admin";
    const hideMonetary = !senderIsPaymentManager && !senderIsAdmin;

    const snapshot = snapshotRows?.[0] ?? null;
    const evalList = evaluationRows ?? [];
    const evalWithScores = evalList.filter((r: Record<string, unknown>) => r.score_1_10 !== null && r.score_1_10 !== undefined);
    const coordinatorScore = evalWithScores.length > 0
      ? Math.round(evalWithScores.reduce((sum: number, r: Record<string, unknown>) => sum + Number(r.score_1_10 ?? 0), 0) / evalWithScores.length * 10)
      : null;

    const evaluationBlocks = evalList.map((row: Record<string, unknown>) => `
      <li style="margin-bottom:12px;">
        <strong>${String(row.category ?? "categoria")} · ${String(row.subtopic ?? "subtópico")}</strong><br />
        Nota: ${Number(row.score_1_10 ?? 0)}/10<br />
        ${row.justificativa ? `Justificativa: ${String(row.justificativa)}<br />` : ""}
        ${row.pontos_de_melhoria ? `Pontos de melhoria: ${String(row.pontos_de_melhoria)}` : ""}
      </li>
    `).join("");

    const html = `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#142033;">
        <h2>Relatório de Bonificação — ${consultant?.name ?? "Consultor"} — ${monthLabel(Number(month), Number(year))}</h2>
        <p><strong>Score do Sistema:</strong> ${snapshot?.score ?? 0}%</p>
        ${coordinatorScore !== null ? `<p><strong>Score do Coordenador:</strong> ${coordinatorScore}%</p>` : ""}
        ${hideMonetary ? "" : `<p><strong>Payout calculado:</strong> ${money(snapshot?.payout_amount)}</p>`}
        <p><strong>Avaliações registradas:</strong></p>
        <ul>${evaluationBlocks || "<li>Sem avaliações submetidas neste período.</li>"}</ul>
        ${coordinatorMessage ? `<p><strong>Mensagem do coordenador:</strong><br />${String(coordinatorMessage).replace(/\n/g, "<br />")}</p>` : ""}
      </div>
    `;

    if (!resendApiKey) {
      return new Response(JSON.stringify({ error: "RESEND_API_KEY não configurada." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [recipientEmail],
        subject: `Relatório de Bonificação — ${consultant?.name ?? "Consultor"} — ${monthLabel(Number(month), Number(year))}`,
        html,
      }),
    });

    if (!emailRes.ok) {
      const details = await emailRes.text();
      return new Response(JSON.stringify({ error: "Falha ao enviar e-mail.", details }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    await supabase.from("bonus_report_emails").insert({
      consultant_user_id: consultantId,
      sent_by_user_id: sender?.id,
      period_month: month,
      period_year: year,
      recipient_email: recipientEmail,
      coordinator_message: coordinatorMessage ?? null,
    });

    return new Response(JSON.stringify({ ok: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
