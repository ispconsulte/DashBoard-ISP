import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const EXT_URL = Deno.env.get("EXT_SUPABASE_URL")
  ?? Deno.env.get("SUPABASE_URL")
  ?? "https://stubkeeuttixteqckshd.supabase.co";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceRoleKey = Deno.env.get("EXT_SUPABASE_SERVICE_ROLE_KEY")
      ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Missing service role key" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ext = createClient(EXT_URL, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { cliente_id, project_ids } = await req.json();

    if (cliente_id == null) {
      return new Response(JSON.stringify({ error: "cliente_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedClienteId = Number(cliente_id);
    if (!Number.isFinite(normalizedClienteId)) {
      return new Response(JSON.stringify({ error: "cliente_id must be a valid number" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const selectedIds = Array.isArray(project_ids)
      ? [...new Set(
          project_ids
            .map((value) => Number(value))
            .filter((value) => Number.isFinite(value)),
        )]
      : [];

    const { data: previousProjects, error: previousProjectsError } = await ext
      .from("projects")
      .select("id")
      .eq("cliente_id", normalizedClienteId);

    if (previousProjectsError) {
      console.error("Load previous links error:", previousProjectsError);
      return new Response(JSON.stringify({ error: previousProjectsError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const previousProjectIds = (previousProjects ?? [])
      .map((project) => Number(project.id))
      .filter((value) => Number.isFinite(value));

    const { error: unlinkErr } = await ext
      .from("projects")
      .update({ cliente_id: null })
      .eq("cliente_id", normalizedClienteId);

    if (unlinkErr) {
      console.error("Unlink error:", unlinkErr);
      return new Response(JSON.stringify({ error: unlinkErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (selectedIds.length > 0) {
      const { error: linkErr } = await ext
        .from("projects")
        .update({ cliente_id: normalizedClienteId })
        .in("id", selectedIds);

      if (linkErr) {
        console.error("Link error:", linkErr);

        if (previousProjectIds.length > 0) {
          const { error: rollbackErr } = await ext
            .from("projects")
            .update({ cliente_id: normalizedClienteId })
            .in("id", previousProjectIds);

          if (rollbackErr) {
            console.error("Rollback error:", rollbackErr);
          }
        }

        return new Response(JSON.stringify({ error: linkErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        cliente_id: normalizedClienteId,
        linked: selectedIds.length,
        unlinked: previousProjectIds.filter((projectId) => !selectedIds.includes(projectId)).length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Unexpected error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
