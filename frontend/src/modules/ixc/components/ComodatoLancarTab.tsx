import { useState } from "react";
import { todayLocalIso } from "@/modules/tasks/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Loader2, AlertCircle, X, FileText, Hash, Box,
  Wifi, Package, DollarSign, Calendar, RefreshCw, CheckCircle2,
  ClipboardCopy, Check,
} from "lucide-react";
import { lancarComodato } from "../client";
import type { ComodatoLaunchResult } from "../types";
import { useScrollLock } from "@/hooks/useScrollLock";

const formatJson = (obj: unknown) => {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
};

export default function ComodatoLancarTab({ auditUser }: { auditUser: string }) {
  const [form, setForm] = useState({
    contratoId: "",
    numeroSerie: "",
    numeroPatrimonial: "",
    descricao: "",
    valorUnitario: "0.10",
    mac: "",
    data: todayLocalIso(),
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComodatoLaunchResult | null>(null);
  const [error, setError] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  useScrollLock(confirmOpen);

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleLancar = () => {
    if (!form.contratoId.trim()) { setError("Informe o ID do contrato."); return; }
    if (!form.numeroSerie.trim()) { setError("Informe o número de série."); return; }
    setConfirmOpen(true);
  };

  const confirmLancar = async () => {
    setConfirmOpen(false);
    setError("");
    setResult(null);
    setLoading(true);
    const res = await lancarComodato({
      contratoId: form.contratoId.trim(),
      numeroSerie: form.numeroSerie.trim(),
      numeroPatrimonial: form.numeroPatrimonial.trim() || undefined,
      descricao: form.descricao.trim() || undefined,
      valorUnitario: form.valorUnitario.trim() || undefined,
      mac: form.mac.trim() || undefined,
      data: form.data || undefined,
      auditUser,
    });
    setLoading(false);
    if (res.ok && res.data) {
      setResult(res.data);
    } else {
      setError(res.error || "Falha ao lançar comodato.");
    }
  };

  const resetForm = () => {
    setForm({ contratoId: "", numeroSerie: "", numeroPatrimonial: "", descricao: "", valorUnitario: "0.10", mac: "", data: todayLocalIso() });
    setResult(null);
    setError("");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="task-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-[hsl(var(--task-text))] flex items-center gap-2">
          <Send className="h-4 w-4 text-[hsl(var(--task-purple))]" />
          Lançar Comodato Manual
        </h3>
        <p className="text-[11px] text-[hsl(var(--task-text-muted))]">
          Preencha os dados do contrato e equipamento para lançar um comodato diretamente no IXC.
        </p>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field icon={FileText} label="ID do Contrato *" value={form.contratoId} onChange={(v) => update("contratoId", v)} placeholder="Ex: 12345" />
          <Field icon={Hash} label="Número de Série *" value={form.numeroSerie} onChange={(v) => update("numeroSerie", v)} placeholder="SN do equipamento" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field icon={Box} label="Nº Patrimonial" value={form.numeroPatrimonial} onChange={(v) => update("numeroPatrimonial", v)} placeholder="Patrimônio (opcional)" />
          <Field icon={Wifi} label="MAC Address" value={form.mac} onChange={(v) => update("mac", v)} placeholder="AA:BB:CC:DD:EE:FF" />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field icon={Package} label="Descrição" value={form.descricao} onChange={(v) => update("descricao", v)} placeholder="Roteador / ONU..." />
          <Field icon={DollarSign} label="Valor Unitário" value={form.valorUnitario} onChange={(v) => update("valorUnitario", v)} placeholder="0.10" />
          <Field icon={Calendar} label="Data" value={form.data} onChange={(v) => update("data", v)} placeholder="AAAA-MM-DD" type="date" />
        </div>

        <div className="flex justify-end gap-2">
          <button onClick={resetForm}
            className="flex items-center gap-1 rounded-lg border border-[hsl(var(--task-border))] px-4 py-2 text-xs font-medium text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))] transition">
            <RefreshCw className="h-3.5 w-3.5" /> Limpar
          </button>
          <button onClick={handleLancar} disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-[hsl(262_83%_58%/0.3)] transition hover:shadow-[hsl(262_83%_58%/0.5)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
            Lançar
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      <AnimatePresence>
        {confirmOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setConfirmOpen(false)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              className="task-card p-6 max-w-md w-full space-y-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-sm font-bold text-[hsl(var(--task-text))]">Confirmar Lançamento</h3>
              <p className="text-xs text-[hsl(var(--task-text-muted))]">
                Contrato <strong className="text-[hsl(var(--task-text))]">#{form.contratoId}</strong> / Série <strong className="text-[hsl(var(--task-text))]">{form.numeroSerie}</strong>. Continuar?
              </p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setConfirmOpen(false)}
                  className="rounded-lg border border-[hsl(var(--task-border))] px-4 py-2 text-xs font-medium text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))] transition">
                  Cancelar
                </button>
                <button onClick={confirmLancar}
                  className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] px-4 py-2 text-xs font-semibold text-white transition hover:shadow-lg">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Confirmar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button onClick={() => setError("")}><X className="h-3.5 w-3.5 text-white/30 hover:text-white/60" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Result */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="task-card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <h4 className="text-sm font-bold text-emerald-300">
              {result.status === "already_exists" ? "Comodato já existente" : "Comodato lançado com sucesso!"}
            </h4>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div><span className="text-[hsl(var(--task-text-muted))]">Contrato:</span> <span className="text-[hsl(var(--task-text))] font-medium">#{result.contratoId}</span></div>
            <div><span className="text-[hsl(var(--task-text-muted))]">Série:</span> <span className="text-[hsl(var(--task-text))] font-medium">{result.numeroSerie}</span></div>
          </div>
          <JsonBlock data={result.respostaIXC} label="Resposta do IXC" />
        </motion.div>
      )}
    </motion.div>
  );
}

function Field({ icon: Icon, label, value, onChange, placeholder, type = "text" }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold flex items-center gap-1">
        <Icon className="h-3 w-3" /> {label}
      </label>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} type={type}
        className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]" />
    </div>
  );
}

function JsonBlock({ data, label }: { data: unknown; label: string }) {
  const [copied, setCopied] = useState(false);
  const text = formatJson(data);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="rounded-lg border border-[hsl(var(--task-border)/0.4)] bg-[hsl(var(--task-bg)/0.5)] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[hsl(var(--task-border)/0.3)]">
        <span className="text-[10px] font-semibold text-[hsl(var(--task-text-muted))]">{label}</span>
        <button onClick={handleCopy} className="text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-purple))] transition">
          {copied ? <Check className="h-3 w-3 text-emerald-400" /> : <ClipboardCopy className="h-3 w-3" />}
        </button>
      </div>
      <pre className="p-3 text-[10px] leading-relaxed text-[hsl(var(--task-text-muted)/0.8)] overflow-x-auto max-h-48 styled-scrollbar">
        {text}
      </pre>
    </div>
  );
}
