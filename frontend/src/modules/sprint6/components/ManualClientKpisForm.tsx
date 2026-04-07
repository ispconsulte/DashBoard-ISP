// ── Sprint 6.0 — Manual Input: Client KPIs Form ───────────────────
// Admin-only form for manual input of EBITDA, Churn, NPS per client/month.
// TEMPORARY: For testing/homologation. Will be replaced by ERP/CRM integrations.

import { useState, useEffect, useCallback } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, Plus, Trash2, FlaskConical } from "lucide-react";

interface KpiRow {
  id?: string;
  cliente_id?: number | null;
  cliente_name: string;
  month: string;
  ebitda: number | null;
  churn: number | null;
  nps: number | null;
}

interface BenchmarkRow {
  id?: string;
  ebitda_avg: number | null;
  churn_avg: number | null;
  nps_avg: number | null;
}

function FormField({ label, type, value, onChange, placeholder, step }: {
  label: string;
  type: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  step?: string;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        step={step}
        className="w-full rounded-lg border border-border/30 bg-card/30 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 transition-colors"
      />
    </div>
  );
}

export function ManualClientKpisForm() {
  const [rows, setRows] = useState<KpiRow[]>([]);
  const [clientes, setClientes] = useState<{ id: number; nome: string }[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkRow>({
    ebitda_avg: null,
    churn_avg: null,
    nps_avg: null,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [kpiRes, benchRes, clientesRes] = await Promise.all([
        supabase
          .from("client_kpis")
          .select("id, cliente_name, month, ebitda, churn, nps")
          .eq("month", month)
          .order("cliente_name") as any,
        supabase.from("client_benchmarks").select("*").limit(1) as any,
        supabase.from("clientes").select("cliente_id, nome").eq("Ativo", true).order("nome") as any,
      ]);

      if (kpiRes.error) throw kpiRes.error;
      if (benchRes.error) throw benchRes.error;
      if (clientesRes.error) throw clientesRes.error;

      if (kpiRes.data) setRows(kpiRes.data);
      if (benchRes.data?.[0]) setBenchmark(benchRes.data[0]);
      if (clientesRes.data) {
        setClientes(
          clientesRes.data.map((cliente: { cliente_id: number; nome: string }) => ({
            id: Number(cliente.cliente_id),
            nome: cliente.nome,
          })),
        );
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao carregar KPIs de clientes");
      setRows([]);
      setClientes([]);
    }
    setLoading(false);
  }, [month]);

  useEffect(() => { loadData(); }, [loadData]);

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { cliente_id: null, cliente_name: "", month, ebitda: null, churn: null, nps: null },
    ]);
  };

  const updateRow = (index: number, field: keyof KpiRow, value: string) => {
    setRows((prev) =>
      prev.map((r, i) =>
        i === index
          ? { ...r, [field]: field === "cliente_name" ? value : (value === "" ? null : Number(value)) }
          : r
      )
    );
  };

  const deleteRow = async (index: number) => {
    const row = rows[index];
    if (row.id) {
      await supabase.from("client_kpis").delete().eq("id", row.id);
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
    toast.success("Registro removido");
  };

  const updateClientSelection = (index: number, value: string) => {
    const selectedId = value ? Number(value) : null;
    const selectedClient = clientes.find((cliente) => cliente.id === selectedId);
    setRows((prev) =>
      prev.map((row, rowIndex) =>
        rowIndex === index
          ? {
              ...row,
              cliente_id: selectedId,
              cliente_name: selectedClient?.nome ?? row.cliente_name,
            }
          : row,
      ),
    );
  };

  const saveAll = async () => {
    setSaving(true);
    const valid = rows.filter((r) => r.cliente_name.trim());

    try {
      for (const row of valid) {
        const selectedClient = row.cliente_id != null
          ? clientes.find((cliente) => cliente.id === row.cliente_id)
          : null;
        const clientName = selectedClient?.nome ?? row.cliente_name.trim();
        const payload = {
          cliente_id: row.cliente_id ?? null,
          cliente_name: clientName,
          month,
          ebitda: row.ebitda,
          churn: row.churn,
          nps: row.nps,
        };

        const persistWithFallback = async () => {
          if (row.id) {
            const updateRes = await supabase.from("client_kpis").update(payload as any).eq("id", row.id);
            if (!updateRes.error) return;

            const message = String(updateRes.error.message ?? "").toLowerCase();
            const missingClientId = message.includes("cliente_id") && (message.includes("column") || message.includes("does not exist"));
            if (!missingClientId) throw updateRes.error;

            const legacyPayload = {
              cliente_name: clientName,
              month,
              ebitda: row.ebitda,
              churn: row.churn,
              nps: row.nps,
            };
            const legacyUpdate = await supabase.from("client_kpis").update(legacyPayload as any).eq("id", row.id);
            if (legacyUpdate.error) throw legacyUpdate.error;
            return;
          }

          const upsertRes = await supabase.from("client_kpis").upsert(payload as any, { onConflict: "cliente_name,month" });
          if (!upsertRes.error) return;

          const message = String(upsertRes.error.message ?? "").toLowerCase();
          const missingClientId = message.includes("cliente_id") && (message.includes("column") || message.includes("does not exist"));
          if (!missingClientId) throw upsertRes.error;

          const legacyPayload = {
            cliente_name: clientName,
            month,
            ebitda: row.ebitda,
            churn: row.churn,
            nps: row.nps,
          };
          const legacyUpsert = await supabase.from("client_kpis").upsert(legacyPayload as any, { onConflict: "cliente_name,month" });
          if (legacyUpsert.error) throw legacyUpsert.error;
        };

        await persistWithFallback();
      }

      // Save benchmarks
      if (benchmark.id) {
        const updateRes = await supabase.from("client_benchmarks").update({
          ebitda_avg: benchmark.ebitda_avg,
          churn_avg: benchmark.churn_avg,
          nps_avg: benchmark.nps_avg,
        } as any).eq("id", benchmark.id);
        if (updateRes.error) throw updateRes.error;
      } else {
        const insertRes = await supabase.from("client_benchmarks").insert({
          ebitda_avg: benchmark.ebitda_avg,
          churn_avg: benchmark.churn_avg,
          nps_avg: benchmark.nps_avg,
        } as any);
        if (insertRes.error) throw insertRes.error;
      }

      toast.success("Dados salvos com sucesso");
      loadData();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao salvar KPIs de clientes");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Carregando KPIs…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">
            <FlaskConical className="h-3 w-3 mr-1" />
            Homologação
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            Input manual para testes — será substituído por integração
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Mês:</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-border/30 bg-card/30 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      {/* KPI Rows — card-based on mobile */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-foreground">KPIs por Cliente</h4>
        {rows.map((row, i) => (
          <div
            key={row.id ?? `new-${i}`}
            className="rounded-xl border border-border/20 bg-card/50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="grid flex-1 min-w-0 gap-3 sm:grid-cols-[1.2fr_1fr]">
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Cliente da base</label>
                  <select
                    value={row.cliente_id ?? ""}
                    onChange={(e) => updateClientSelection(i, e.target.value)}
                    className="mt-1 w-full rounded-lg border border-border/30 bg-card/30 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 transition-colors"
                  >
                    <option value="">Selecionar cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={cliente.id}>
                        {cliente.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Nome exibido</label>
                  <input
                    value={row.cliente_name}
                    onChange={(e) => updateRow(i, "cliente_name", e.target.value)}
                    placeholder="Nome do cliente"
                    className="mt-1 w-full rounded-lg border border-border/30 bg-card/30 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 transition-colors"
                  />
                </div>
              </div>
              <button
                onClick={() => deleteRow(i)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shrink-0 mt-4"
                title="Remover"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField
                label="EBITDA (R$)"
                type="number"
                value={row.ebitda ?? ""}
                onChange={(v) => updateRow(i, "ebitda", v)}
                placeholder="0"
              />
              <FormField
                label="Churn (%)"
                type="number"
                value={row.churn ?? ""}
                onChange={(v) => updateRow(i, "churn", v)}
                placeholder="0"
                step="0.1"
              />
              <FormField
                label="NPS"
                type="number"
                value={row.nps ?? ""}
                onChange={(v) => updateRow(i, "nps", v)}
                placeholder="0"
              />
            </div>
          </div>
        ))}
        <button
          onClick={addRow}
          className="flex items-center gap-1.5 rounded-xl border border-dashed border-border/40 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-full justify-center"
        >
          <Plus className="h-3.5 w-3.5" /> Adicionar cliente
        </button>
      </div>

      {/* Benchmarks */}
      <div className="space-y-3">
        <h4 className="text-xs font-medium text-foreground">Benchmarks Setoriais</h4>
        <div className="rounded-xl border border-border/20 bg-card/50 p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField
              label="EBITDA Médio (R$)"
              type="number"
              value={benchmark.ebitda_avg ?? ""}
              onChange={(v) =>
                setBenchmark((b) => ({ ...b, ebitda_avg: v === "" ? null : Number(v) }))
              }
              placeholder="0"
            />
            <FormField
              label="Churn Médio (%)"
              type="number"
              value={benchmark.churn_avg ?? ""}
              onChange={(v) =>
                setBenchmark((b) => ({ ...b, churn_avg: v === "" ? null : Number(v) }))
              }
              placeholder="0"
              step="0.1"
            />
            <FormField
              label="NPS Médio"
              type="number"
              value={benchmark.nps_avg ?? ""}
              onChange={(v) =>
                setBenchmark((b) => ({ ...b, nps_avg: v === "" ? null : Number(v) }))
              }
              placeholder="0"
            />
          </div>
        </div>
      </div>

      {/* Save button */}
      <div className="flex justify-end">
        <button
          onClick={saveAll}
          disabled={saving}
          className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar tudo
        </button>
      </div>
    </div>
  );
}
