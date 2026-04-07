// ── Sprint 6.0 — Manual Input: User Capacity Form ──────────────────
// Admin-only form to set available hours, department, and seniority per user.
// TEMPORARY: For testing/homologation only. Will be replaced by integrations.

import { useState, useEffect } from "react";
import { supabaseExt as supabase } from "@/lib/supabase";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Save, Loader2, FlaskConical } from "lucide-react";

interface UserRow {
  id: string;
  name: string;
  email: string;
  department: string | null;
  seniority_level: string | null;
}

const SENIORITY_OPTIONS = ["junior", "pleno", "senior"] as const;
const DEPARTMENT_OPTIONS = ["Engenharia", "Suporte", "Comercial", "Administrativo", "Operações"];

function FormSelect({ label, value, onChange, options, disabled }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-lg border border-border/30 bg-card/30 px-3 py-1.5 text-xs text-foreground outline-none cursor-pointer focus:border-primary/40 transition-colors disabled:opacity-50"
      >
        <option value="">—</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function ManualUserCapacityForm() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [capacityMonth, setCapacityMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [capacityMap, setCapacityMap] = useState<Record<string, number>>({});

  // Load users
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("users")
          .select("id, name, email, department, seniority_level")
          .eq("active", true)
          .order("name");
        if (error) throw error;
        setUsers((data as unknown as UserRow[]) ?? []);
      } catch (error) {
        toast.error("Erro ao carregar usuários");
        console.error(error);
        setUsers([]);
      }
      setLoading(false);
    })();
  }, []);

  // Load capacity for selected month
  useEffect(() => {
    if (!users.length) return;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("user_capacity")
          .select("user_id, available_hours")
          .eq("month", capacityMonth);
        if (error) throw error;
        const map: Record<string, number> = {};
        (data ?? []).forEach((row: any) => {
          map[row.user_id] = Number(row.available_hours);
        });
        setCapacityMap(map);
      } catch (error) {
        console.error(error);
        setCapacityMap({});
      }
    })();
  }, [users, capacityMonth]);

  const handleUpdateUser = async (userId: string, field: "department" | "seniority_level", value: string | null) => {
    setSaving(userId);
    const { error } = await supabase
      .from("users")
      .update({ [field]: value || null } as any)
      .eq("id", userId);
    if (error) {
      toast.error(`Erro ao salvar ${field}`);
    } else {
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, [field]: value || null } : u)));
      toast.success("Salvo");
    }
    setSaving(null);
  };

  const handleUpdateCapacity = async (userId: string, hours: number) => {
    setSaving(userId);
    const { error } = await supabase
      .from("user_capacity")
      .upsert(
        { user_id: userId, month: capacityMonth, available_hours: hours } as any,
        { onConflict: "user_id,month" }
      );
    if (error) {
      toast.error("Erro ao salvar horas");
      console.error(error);
    } else {
      setCapacityMap((prev) => ({ ...prev, [userId]: hours }));
      toast.success("Horas salvas");
    }
    setSaving(null);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">Carregando usuários…</span>
      </div>
    );
  }

  if (!users.length) {
    return (
      <div className="rounded-lg border border-dashed border-border/40 bg-muted/30 py-8 text-center text-sm text-muted-foreground">
        Nenhum usuário ativo encontrado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary text-[10px]">
            <FlaskConical className="h-3 w-3 mr-1" />
            Homologação
          </Badge>
          <span className="text-[10px] text-muted-foreground">
            Dados temporários para testes internos
          </span>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Mês:</label>
          <input
            type="month"
            value={capacityMonth}
            onChange={(e) => setCapacityMonth(e.target.value)}
            className="rounded-lg border border-border/30 bg-card/30 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 transition-colors"
          />
        </div>
      </div>

      <div className="space-y-3">
        {users.map((user) => (
          <div
            key={user.id}
            className="rounded-xl border border-border/20 bg-card/50 p-4 space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
                <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
              </div>
              <button
                onClick={() => handleUpdateCapacity(user.id, capacityMap[user.id] ?? 160)}
                disabled={saving === user.id}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
                title="Salvar"
              >
                {saving === user.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormSelect
                label="Departamento"
                value={user.department ?? ""}
                onChange={(v) => handleUpdateUser(user.id, "department", v)}
                options={DEPARTMENT_OPTIONS.map((d) => ({ value: d, label: d }))}
                disabled={saving === user.id}
              />
              <FormSelect
                label="Senioridade"
                value={user.seniority_level ?? ""}
                onChange={(v) => handleUpdateUser(user.id, "seniority_level", v)}
                options={SENIORITY_OPTIONS.map((s) => ({
                  value: s,
                  label: s === "junior" ? "Júnior" : s === "pleno" ? "Pleno" : "Sênior",
                }))}
                disabled={saving === user.id}
              />
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">Horas/Mês</label>
                <input
                  type="number"
                  min={0}
                  max={744}
                  value={capacityMap[user.id] ?? 160}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(744, Number(e.target.value) || 0));
                    setCapacityMap((prev) => ({ ...prev, [user.id]: v }));
                  }}
                  className="w-full rounded-lg border border-border/30 bg-card/30 px-3 py-1.5 text-xs text-foreground outline-none focus:border-primary/40 transition-colors"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
