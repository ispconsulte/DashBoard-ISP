// ── Sprint 6.0 — Manual Input: Project Financials Form ─────────────
// Admin-only form to set revenue, cost/hour, and estimated total cost per project.

import { useState, useEffect, useCallback } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, FlaskConical } from "lucide-react";

function FieldInput({ label, type, value, onChange, placeholder, step }: {
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

interface FinancialRow {
  id?: string;
  project_id: number;
  project_name: string;
  receita_projeto: number;
  custo_hora: number;
  custo_total_estimado: number;
  observacoes: string;
}

export function ManualProjectFinancialsForm() {
  const [rows, setRows] = useState<FinancialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, finRes] = await Promise.all([
        supabase.from("projects").select("id, name").eq("active", true).order("name"),
        supabase.from("project_financials").select("*"),
      ]);

      if (projRes.error) throw projRes.error;

      const missingFinancialTable =
        !!finRes.error &&
        String(finRes.error.message ?? "").toLowerCase().includes("project_financials") &&
        (String(finRes.error.message ?? "").toLowerCase().includes("does not exist") ||
          String(finRes.error.message ?? "").toLowerCase().includes("relation"));

      if (finRes.error && !missingFinancialTable) throw finRes.error;

      const projs = (projRes.data ?? []).map((p) => ({ id: p.id, name: p.name }));

      const finMap = new Map<number, any>();
      for (const r of finRes.data ?? []) {
        finMap.set(Number(r.project_id), r);
      }

      const merged: FinancialRow[] = projs.map((p) => {
        const fin = finMap.get(p.id);
        return {
          id: fin?.id,
          project_id: p.id,
          project_name: p.name,
          receita_projeto: Number(fin?.receita_projeto) || 0,
          custo_hora: Number(fin?.custo_hora) || 0,
          custo_total_estimado: Number(fin?.custo_total_estimado) || 0,
          observacoes: fin?.observacoes ?? "",
        };
      });
      setRows(merged);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao carregar dados financeiros");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (row: FinancialRow) => {
    setSaving(row.project_id);
    const payload = {
      project_id: row.project_id,
      receita_projeto: row.receita_projeto,
      custo_hora: row.custo_hora,
      custo_total_estimado: row.custo_total_estimado,
      observacoes: row.observacoes || null,
    };

    const { error } = await supabase
      .from("project_financials")
      .upsert(payload, { onConflict: "project_id" });

    if (error) {
      toast.error("Erro ao salvar dados financeiros");
      console.error(error);
    } else {
      toast.success(`Financeiro de "${row.project_name}" salvo`);
    }
    setSaving(null);
  };

  const updateRow = (projectId: number, field: keyof FinancialRow, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.project_id === projectId
          ? { ...r, [field]: field === "observacoes" ? value : (Number(value) || 0) }
          : r
      )
    );
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Carregando projetos…</span>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/40 bg-muted/30 py-8 text-center text-sm text-muted-foreground">
        Nenhum projeto ativo encontrado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">
          <FlaskConical className="h-3 w-3 mr-1" />
          Homologação
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          Dados financeiros para cálculo de ROI % no Dashboard ROI
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.project_id}
            className="rounded-xl border border-border/20 bg-card/50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-foreground truncate">{row.project_name}</p>
              <button
                onClick={() => handleSave(row)}
                disabled={saving === row.project_id}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
                title="Salvar"
              >
                {saving === row.project_id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FieldInput
                label="Receita (R$)"
                type="number"
                value={row.receita_projeto || ""}
                onChange={(v) => updateRow(row.project_id, "receita_projeto", v)}
                placeholder="0"
              />
              <FieldInput
                label="Custo/Hora (R$)"
                type="number"
                value={row.custo_hora || ""}
                onChange={(v) => updateRow(row.project_id, "custo_hora", v)}
                placeholder="0"
                step="0.01"
              />
              <FieldInput
                label="Custo Total Est. (R$)"
                type="number"
                value={row.custo_total_estimado || ""}
                onChange={(v) => updateRow(row.project_id, "custo_total_estimado", v)}
                placeholder="0"
              />
            </div>
            <FieldInput
              label="Observações"
              type="text"
              value={row.observacoes}
              onChange={(v) => updateRow(row.project_id, "observacoes", v)}
              placeholder="—"
            />
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        <strong>Lógica de ROI:</strong> Se custo/hora {'>'} 0, custo real = custo/hora × horas realizadas. Caso contrário, usa custo total estimado. ROI % = (receita - custo) / custo × 100.
      </p>
    </div>
  );
}
