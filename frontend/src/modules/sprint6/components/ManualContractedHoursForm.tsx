// ── Sprint 6.0 — Manual Input: Contracted Hours per Project ─────────
import { useState, useEffect, useCallback } from "react";
import { supabaseExt, supabaseExt as supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, FlaskConical, Clock } from "lucide-react";

interface HoursRow {
  project_id: number;
  project_name: string;
  contracted_hours: number;
  notes: string;
  hasRecord: boolean;
}

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

export function ManualContractedHoursForm() {
  const [rows, setRows] = useState<HoursRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, hoursRes] = await Promise.all([
        supabase.from("projects").select("id, name").eq("active", true).order("name"),
        supabase.from("project_contracted_hours").select("*"),
      ]);

      if (projRes.error) throw projRes.error;

      const missingHoursTable =
        !!hoursRes.error &&
        String(hoursRes.error.message ?? "").toLowerCase().includes("project_contracted_hours") &&
        (String(hoursRes.error.message ?? "").toLowerCase().includes("does not exist") ||
          String(hoursRes.error.message ?? "").toLowerCase().includes("relation"));

      if (hoursRes.error && !missingHoursTable) throw hoursRes.error;

      const projs = (projRes.data ?? []).map((p) => ({ id: p.id, name: p.name }));
      const hoursMap = new Map<number, any>();
      for (const r of hoursRes.data ?? []) {
        hoursMap.set(Number(r.project_id), r);
      }

      const merged: HoursRow[] = projs.map((p) => {
        const h = hoursMap.get(p.id);
        return {
          project_id: p.id,
          project_name: p.name,
          contracted_hours: Number(h?.contracted_hours) || 0,
          notes: h?.notes ?? "",
          hasRecord: !!h,
        };
      });
      setRows(merged);
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Erro ao carregar horas contratadas");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSave = async (row: HoursRow) => {
    if (row.contracted_hours <= 0) {
      toast.error("Informe um valor de horas maior que zero");
      return;
    }

    setSaving(row.project_id);

    const { data: userData } = await supabaseExt.auth.getUser();
    const updatedBy = userData?.user?.email ?? "unknown";

    const payload = {
      project_id: row.project_id,
      contracted_hours: row.contracted_hours,
      notes: row.notes || null,
      updated_by: updatedBy,
    };

    const { error } = await supabase
      .from("project_contracted_hours")
      .upsert(payload, { onConflict: "project_id" });

    if (error) {
      toast.error("Erro ao salvar horas contratadas");
      console.error(error);
    } else {
      toast.success(`Horas de "${row.project_name}" salvas`);
      setRows((prev) =>
        prev.map((r) => r.project_id === row.project_id ? { ...r, hasRecord: true } : r)
      );
    }
    setSaving(null);
  };

  const updateRow = (projectId: number, field: keyof HoursRow, value: string) => {
    setRows((prev) =>
      prev.map((r) =>
        r.project_id === projectId
          ? { ...r, [field]: field === "notes" ? value : (Number(value) || 0) }
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
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">
          <FlaskConical className="h-3 w-3 mr-1" />
          Homologação
        </Badge>
        <span className="text-[10px] text-muted-foreground">
          Horas contratadas por projeto — alimenta o Dashboard ROI (orçado vs realizado)
        </span>
      </div>

      <div className="space-y-3">
        {rows.map((row) => (
          <div
            key={row.project_id}
            className="rounded-xl border border-border/20 bg-card/50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Clock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-sm font-medium text-foreground truncate">{row.project_name}</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {row.hasRecord && (
                  <Badge variant="outline" className="text-[9px] bg-accent/10 text-accent-foreground">
                    Cadastrado
                  </Badge>
                )}
                <button
                  onClick={() => handleSave(row)}
                  disabled={saving === row.project_id}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                  title="Salvar"
                >
                  {saving === row.project_id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldInput
                label="Horas Contratadas"
                type="number"
                value={row.contracted_hours || ""}
                onChange={(v) => updateRow(row.project_id, "contracted_hours", v)}
                placeholder="160"
                step="1"
              />
              <FieldInput
                label="Observações"
                type="text"
                value={row.notes}
                onChange={(v) => updateRow(row.project_id, "notes", v)}
                placeholder="Ex: contrato mensal 160h"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        <strong>Consumo:</strong> O Dashboard ROI usa esses dados para calcular a variância entre horas orçadas (contratadas) e horas realizadas (Bitrix).
      </p>
    </div>
  );
}
