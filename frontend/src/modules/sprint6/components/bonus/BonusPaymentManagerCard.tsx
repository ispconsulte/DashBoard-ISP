import { useCallback, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Pencil, Save, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabaseRest, safeJson } from "@/modules/users/api/supabaseRest";
import { useAuth } from "@/modules/auth/hooks/useAuth";
import { supabaseExt } from "@/lib/supabase";

interface UserOption { id: string; name: string; email?: string; }

const taskSelectTriggerClass =
  "w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] px-3 py-2 text-xs text-[hsl(var(--task-text))] hover:border-[hsl(var(--task-yellow)/0.4)] focus:ring-0 focus:ring-offset-0 focus:outline-none h-9";
const taskSelectContentClass =
  "rounded-xl border border-[hsl(var(--task-border))] bg-[hsl(222_47%_11%)] shadow-2xl shadow-black/40 z-50";
const taskSelectItemClass =
  "text-xs text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))] hover:bg-white/[0.05] rounded-lg cursor-pointer focus:bg-white/[0.05] focus:text-[hsl(var(--task-text))]";

export function BonusPaymentManagerCard({ users }: { users: UserOption[] }) {
  const { session, refreshAuthContext } = useAuth() as { session: { accessToken?: string; role?: string } | null; refreshAuthContext: () => Promise<void> };
  const token = session?.accessToken;

  const [paymentManagerUserId, setPaymentManagerUserId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("none");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "ok" | "error"; msg: string } | null>(null);

  const loadPaymentManager = useCallback(() => {
    if (!token) return Promise.resolve();
    return supabaseRest("bonus_settings?key=eq.payment_manager_user_id&select=value&limit=1", token)
      .then(safeJson)
      .then((rows: { value?: string | null }[]) => {
        const val = rows?.[0]?.value ?? null;
        setPaymentManagerUserId(val);
        setDraft(val ?? "none");
      })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    void loadPaymentManager();
  }, [loadPaymentManager]);

  useEffect(() => {
    if (!token) return;
    const handleChanged = () => { void loadPaymentManager(); };
    window.addEventListener("bonus-settings-changed", handleChanged);
    const channel = supabaseExt
      .channel("bonus-payment-manager-card")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bonus_settings", filter: "key=eq.payment_manager_user_id" },
        handleChanged,
      )
      .subscribe();

    return () => {
      window.removeEventListener("bonus-settings-changed", handleChanged);
      supabaseExt.removeChannel(channel);
    };
  }, [token, loadPaymentManager]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      const newVal = draft === "none" ? null : draft;
      await supabaseRest("bonus_settings?key=eq.payment_manager_user_id", token, {
        method: "PATCH",
        body: JSON.stringify({ value: newVal, updated_at: new Date().toISOString() }),
      });
      setPaymentManagerUserId(newVal);
      await refreshAuthContext();
      window.dispatchEvent(new Event("bonus-settings-changed"));
      setFeedback({ type: "ok", msg: "Responsável pela bonificação atualizado." });
      setOpen(false);
    } catch (err) {
      setFeedback({ type: "error", msg: err instanceof Error ? err.message : "Falha ao salvar." });
    } finally {
      setSaving(false);
    }
  };

  if (session?.role !== "admin") return null;

  const managerName = paymentManagerUserId
    ? (users.find((u) => u.id === paymentManagerUserId)?.name ?? `ID ${paymentManagerUserId}`)
    : "Nenhum responsável definido";

  return (
    <div className="task-card p-4">
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`mb-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium ${
              feedback.type === "ok"
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
                : "border-red-500/20 bg-red-500/10 text-red-300"
            }`}
          >
            <span className="flex-1">{feedback.msg}</span>
            <button type="button" onClick={() => setFeedback(null)} className="text-white/30 hover:text-white/60">✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[hsl(var(--task-yellow)/0.12)]">
            <Shield className="h-4 w-4 text-[hsl(var(--task-yellow))]" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[hsl(var(--task-text))]">Responsável pela Bonificação</p>
            <p className="text-[11px] text-[hsl(var(--task-text-muted))] truncate">{managerName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setDraft(paymentManagerUserId ?? "none"); }}
          className="flex items-center gap-1.5 rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] px-3 py-1.5 text-xs font-medium text-[hsl(var(--task-text-muted))] hover:border-[hsl(var(--task-yellow)/0.4)] hover:text-[hsl(var(--task-yellow))] transition shrink-0"
        >
          <Pencil className="h-3 w-3" /> Alterar
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="mt-4 pt-4 border-t border-[hsl(var(--task-border))] space-y-3">
              <p className="text-[11px] text-[hsl(var(--task-text-muted))]">
                O responsável selecionado terá acesso total aos valores de pagamento/bonificação de todos os consultores.
              </p>
              <Select value={draft} onValueChange={setDraft}>
                <SelectTrigger className={taskSelectTriggerClass}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={taskSelectContentClass}>
                  <SelectItem value="none" className={taskSelectItemClass}>Nenhum responsável</SelectItem>
                  {users
                    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id} className={taskSelectItemClass}>
                        {u.name}{u.email ? ` — ${u.email}` : ""}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-[hsl(var(--task-border))] px-3 py-1.5 text-xs text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))] transition"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saving || draft === (paymentManagerUserId ?? "none")}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-4 py-1.5 text-xs font-semibold text-emerald-400 hover:bg-emerald-500/30 transition disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} Salvar
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
