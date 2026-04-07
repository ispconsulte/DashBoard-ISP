import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function isBusinessDay(date: Date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

function isFirstBusinessDayOfMonth(date: Date) {
  const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
  while (!isBusinessDay(firstDay)) {
    firstDay.setDate(firstDay.getDate() + 1);
  }
  return date.toDateString() === firstDay.toDateString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const bitrixBaseUrl = Deno.env.get("BITRIX_BASE_URL") ?? "";
    const dashboardUrl = Deno.env.get("BONUS_DASHBOARD_URL") ?? "";

    const supabase = createClient(supabaseUrl, serviceRoleKey);
    const today = new Date();

    if (!isFirstBusinessDayOfMonth(today)) {
      return new Response(JSON.stringify({ ok: true, skipped: true, reason: "Hoje não é o primeiro dia útil do mês." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const periodMonth = today.getMonth() + 1;
    const periodYear = today.getFullYear();
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 18, 0, 0).toISOString();

    const { data: links, error } = await supabase
      .from("user_coordinator_links")
      .select("coordinator_user_id, subordinate_user_id")
      .limit(1000);

    if (error) throw error;

    const userIds = Array.from(new Set((links ?? []).flatMap((link: Record<string, string>) => [link.coordinator_user_id, link.subordinate_user_id])));
    const { data: users } = await supabase.from("users").select("id,name,bitrix_user_id").in("id", userIds);
    const usersById = new Map((users ?? []).map((user: Record<string, string | null>) => [user.id, user]));

    const created: unknown[] = [];

    for (const link of links ?? []) {
      const coordinator = usersById.get((link as Record<string, string>).coordinator_user_id);
      const subordinate = usersById.get((link as Record<string, string>).subordinate_user_id);

      if (!coordinator?.bitrix_user_id || !bitrixBaseUrl) continue;

      const alreadyExists = await supabase
        .from("bonus_evaluation_reminders")
        .select("id")
        .eq("coordinator_user_id", link.coordinator_user_id)
        .eq("subordinate_user_id", link.subordinate_user_id)
        .eq("period_month", periodMonth)
        .eq("period_year", periodYear)
        .limit(1);

      if ((alreadyExists.data ?? []).length > 0) continue;

      const body = new URLSearchParams();
      body.set("fields[TITLE]", `[Bonificação] Avaliação mensal de ${subordinate?.name ?? "Consultor"} — ${String(periodMonth).padStart(2, "0")}/${periodYear}`);
      body.set("fields[RESPONSIBLE_ID]", String(coordinator.bitrix_user_id));
      body.set("fields[DEADLINE]", endOfMonth);
      body.set("fields[DESCRIPTION]", `Acesse o dashboard de bonificação para preencher a avaliação mensal.\n${dashboardUrl}`);
      body.set("fields[TAGS][0]", "bonificacao");
      body.set("fields[TAGS][1]", "avaliacao-mensal");

      const bitrixRes = await fetch(new URL("tasks.task.add.json", bitrixBaseUrl), {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
      });

      const bitrixJson = await bitrixRes.json().catch(() => null);
      const bitrixTaskId = bitrixJson?.result?.task?.id ?? bitrixJson?.result?.id ?? null;

      await supabase.from("bonus_evaluation_reminders").insert({
        coordinator_user_id: link.coordinator_user_id,
        subordinate_user_id: link.subordinate_user_id,
        period_month: periodMonth,
        period_year: periodYear,
        bitrix_task_id: bitrixTaskId,
      });

      created.push({
        coordinator: coordinator?.name,
        subordinate: subordinate?.name,
        bitrixTaskId,
      });
    }

    return new Response(JSON.stringify({ ok: true, created }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Erro inesperado." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
