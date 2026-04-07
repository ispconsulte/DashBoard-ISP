// ── Sprint 6.0 — Admin form for Health Score weight configuration ───
import { useState, useEffect, useCallback } from "react";
import { supabaseExt, supabaseExt as supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, FlaskConical, Scale } from "lucide-react";

interface WeightsState {
  weight_ebitda: number;
  weight_churn: number;
  weight_nps: number;
}

const DEFAULTS: WeightsState = { weight_ebitda: 0.4, weight_churn: 0.3, weight_nps: 0.3 };

export function ManualHealthWeightsForm() {
  const [weights, setWeights] = useState<WeightsState>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("health_score_config" as any)
      .select("weight_ebitda, weight_churn, weight_nps")
      .limit(1)
      .maybeSingle();

    if (!error && data) {
      setWeights({
        weight_ebitda: Number((data as any).weight_ebitda) || 0.4,
        weight_churn: Number((data as any).weight_churn) || 0.3,
        weight_nps: Number((data as any).weight_nps) || 0.3,
      });
    } else if (error) {
      console.error(error);
      setWeights(DEFAULTS);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const total = weights.weight_ebitda + weights.weight_churn + weights.weight_nps;
  const isValid = Math.abs(total - 1) < 0.01;

  const handleSave = async () => {
    if (!isValid) {
      toast.error("A soma dos pesos deve ser igual a 100%");
      return;
    }
    setSaving(true);

    const { data: userData } = await supabaseExt.auth.getUser();
    const updatedBy = userData?.user?.email ?? "unknown";

    // Upsert the config row (handles both insert and update)
    const payload = {
      weight_ebitda: weights.weight_ebitda,
      weight_churn: weights.weight_churn,
      weight_nps: weights.weight_nps,
      updated_by: updatedBy,
    };

    // Try to get existing row first
    const { data: existing } = await supabase
      .from("health_score_config" as any)
      .select("id")
      .limit(1)
      .single() as any;

    let error: any;
    if (existing?.id) {
      const res = await supabase
        .from("health_score_config" as any)
        .update(payload as any)
        .eq("id", (existing as any).id);
      error = res.error;
    } else {
      const res = await supabase
        .from("health_score_config" as any)
        .insert(payload as any);
      error = res.error;
    }

    if (error) {
      toast.error("Erro ao salvar pesos");
      console.error(error);
    } else {
      toast.success("Pesos do Health Score atualizados");
    }
    setSaving(false);
  };

  const setWeight = (key: keyof WeightsState, pct: string) => {
    const val = Math.max(0, Math.min(100, Number(pct) || 0));
    setWeights((prev) => ({ ...prev, [key]: val / 100 }));
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Carregando configuração…</span>
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
          Pesos para cálculo do Health Score — impacta o Dashboard Saúde do Cliente
        </span>
      </div>

      <div className="rounded-xl border border-border/20 bg-card/50 p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Scale className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-medium text-foreground">Distribuição de Pesos</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <WeightField
            label="EBITDA"
            value={Math.round(weights.weight_ebitda * 100)}
            onChange={(v) => setWeight("weight_ebitda", v)}
          />
          <WeightField
            label="Churn"
            value={Math.round(weights.weight_churn * 100)}
            onChange={(v) => setWeight("weight_churn", v)}
          />
          <WeightField
            label="NPS"
            value={Math.round(weights.weight_nps * 100)}
            onChange={(v) => setWeight("weight_nps", v)}
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/10">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Total: <strong className={isValid ? "text-primary" : "text-destructive"}>{Math.round(total * 100)}%</strong>
            </span>
            {!isValid && (
              <span className="text-[10px] text-destructive">
                A soma deve ser 100%
              </span>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving || !isValid}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Save className="h-3.5 w-3.5" />
            )}
            Salvar
          </button>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground">
        <strong>Fórmula:</strong> Health Score = (EBITDA normalizado × peso) + (Churn invertido × peso) + (NPS normalizado × peso). Fallback: 40/30/30 se não configurado.
      </p>
    </div>
  );
}

function WeightField({ label, value, onChange }: { label: string; value: number; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label} (%)</label>
      <input
        type="number"
        min={0}
        max={100}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="w-full rounded-lg border border-border/30 bg-card/30 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 transition-colors"
      />
      <div className="h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <div
          className="h-full rounded-full bg-primary/50 transition-all duration-300"
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}
