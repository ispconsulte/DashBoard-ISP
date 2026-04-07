import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, AlertCircle, X, Wifi, Hash, Info,
  FileText, Box, Package, Check, ClipboardCopy, Eye, Code,
  Filter,
} from "lucide-react";
import { consultarComodato } from "../client";
import type { ComodatoStatus } from "../types";

const formatJson = (obj: unknown) => {
  try { return JSON.stringify(obj, null, 2); } catch { return String(obj); }
};

const LINE_SEP = "─".repeat(50);

const hasValue = (v: unknown) => {
  if (v === null || v === undefined) return false;
  const t = String(v).trim();
  return t !== "" && t !== "0000-00-00";
};

const dumpDict = (data: Record<string, unknown>, prefix = "") =>
  Object.keys(data).sort().filter((k) => hasValue(data[k])).map((k) => `${prefix}${k}: ${typeof data[k] === "object" ? JSON.stringify(data[k]) : String(data[k])}`);

const renderVisual = (result: ComodatoStatus, query: { pppoe: string; serial: string }) => {
  const lines: string[] = [];
  const contrato = (result.contrato ?? {}) as Record<string, unknown>;
  const radusuario = (result.radusuario ?? {}) as Record<string, unknown>;
  const comodatos = result.comodatos ?? [];
  const patrimonio = (result.patrimonio ?? null) as Record<string, unknown> | null;

  lines.push(`PPPoE: ${query.pppoe || radusuario["pppoe"] || radusuario["login"] || "—"}`);
  lines.push(`Contrato: ${result.contratoId || contrato["id"] || "—"} | Status: ${contrato["status"] ?? "—"} | Ativação: ${contrato["data_ativacao"] ?? "—"}`);
  lines.push(`Comodatos encontrados: ${comodatos.length}`);
  lines.push(`Patrimônio: ${patrimonio ? "Sim" : "Não"}`);
  lines.push(LINE_SEP);

  if (result.messages?.length) {
    lines.push("Mensagens:");
    result.messages.forEach((m) => lines.push(`  • ${m}`));
    lines.push(LINE_SEP);
  }
  if (Object.keys(contrato).length) {
    lines.push("[CONTRATO]");
    lines.push(...dumpDict(contrato, "  "));
    lines.push(LINE_SEP);
  }
  if (Object.keys(radusuario).length) {
    lines.push("[RADUSUÁRIO]");
    lines.push(...dumpDict(radusuario, "  "));
    lines.push(LINE_SEP);
  }
  if (comodatos.length) {
    lines.push(`[COMODATOS] (${comodatos.length})`);
    comodatos.forEach((c, i) => {
      lines.push(`  (# ${i + 1})`);
      lines.push(...dumpDict(c as Record<string, unknown>, "    "));
    });
    lines.push(LINE_SEP);
  }
  if (patrimonio && Object.keys(patrimonio).length) {
    lines.push("[PATRIMÔNIO]");
    lines.push(...dumpDict(patrimonio, "  "));
  }
  return lines.join("\n");
};

export default function ComodatoConsultaTab({ auditUser }: { auditUser: string }) {
  const [pppoe, setPppoe] = useState("");
  const [serial, setSerial] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ComodatoStatus | null>(null);
  const [error, setError] = useState("");
  const [viewMode, setViewMode] = useState<"visual" | "json">("visual");
  const [filterText, setFilterText] = useState("");
  const [lastQuery, setLastQuery] = useState({ pppoe: "", serial: "" });
  const [copied, setCopied] = useState(false);

  const handleConsulta = async () => {
    if (!pppoe.trim()) { setError("Informe o login PPPoE."); return; }
    setError("");
    setResult(null);
    setLoading(true);
    setLastQuery({ pppoe: pppoe.trim(), serial: serial.trim() });
    const res = await consultarComodato({ pppoe: pppoe.trim(), serial: serial.trim() || undefined, auditUser });
    setLoading(false);
    if (res.ok && res.data) {
      setResult(res.data);
    } else {
      setError(res.error || "Falha na consulta.");
    }
  };

  const visualText = useMemo(() => result ? renderVisual(result, lastQuery) : "", [result, lastQuery]);
  const jsonText = useMemo(() => result ? formatJson(result) : "", [result]);

  const displayText = useMemo(() => {
    const raw = viewMode === "visual" ? visualText : jsonText;
    if (!filterText.trim()) return raw;
    return raw.split("\n").filter((l) => l.toLowerCase().includes(filterText.trim().toLowerCase())).join("\n");
  }, [viewMode, visualText, jsonText, filterText]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Search form */}
      <div className="task-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-[hsl(var(--task-text))] flex items-center gap-2">
          <Search className="h-4 w-4 text-[hsl(var(--task-purple))]" />
          Consultar Comodato
        </h3>
        <p className="text-[11px] text-[hsl(var(--task-text-muted))]">
          Busque pelo login PPPoE para ver contrato, comodatos e patrimônio associados no IXC.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold flex items-center gap-1">
              <Wifi className="h-3 w-3" /> Login PPPoE *
            </label>
            <input value={pppoe} onChange={(e) => setPppoe(e.target.value)} placeholder="cliente@pppoe"
              onKeyDown={(e) => e.key === "Enter" && handleConsulta()}
              className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]" />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold flex items-center gap-1">
              <Hash className="h-3 w-3" /> Nº Série (opcional)
            </label>
            <input value={serial} onChange={(e) => setSerial(e.target.value)} placeholder="SN do equipamento"
              onKeyDown={(e) => e.key === "Enter" && handleConsulta()}
              className="h-9 w-full rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-xs text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]" />
          </div>
        </div>
        <div className="flex justify-end">
          <button onClick={handleConsulta} disabled={loading}
            className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-[hsl(262_83%_58%/0.3)] transition hover:shadow-[hsl(262_83%_58%/0.5)] hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Consultar
          </button>
        </div>
      </div>

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
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="task-card p-5 space-y-4">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h4 className="text-xs font-semibold text-[hsl(var(--task-text))] flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-[hsl(var(--task-purple))]" />
              Contrato #{result.contratoId} — {result.comodatos.length} comodato(s)
              {result.patrimonio && <span className="text-emerald-400 ml-1">• Patrimônio encontrado</span>}
            </h4>
            <div className="flex gap-1.5">
              <button onClick={() => setViewMode("visual")}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition ${viewMode === "visual" ? "border-[hsl(var(--task-purple)/0.5)] bg-[hsl(var(--task-purple)/0.15)] text-[hsl(var(--task-purple))]" : "border-[hsl(var(--task-border))] text-[hsl(var(--task-text-muted))]"}`}>
                <Eye className="h-3 w-3 inline mr-1" />Visual
              </button>
              <button onClick={() => setViewMode("json")}
                className={`rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition ${viewMode === "json" ? "border-[hsl(var(--task-purple)/0.5)] bg-[hsl(var(--task-purple)/0.15)] text-[hsl(var(--task-purple))]" : "border-[hsl(var(--task-border))] text-[hsl(var(--task-text-muted))]"}`}>
                <Code className="h-3 w-3 inline mr-1" />JSON
              </button>
              <button onClick={handleCopy} className="rounded-lg border border-[hsl(var(--task-border))] px-2.5 py-1 text-[10px] font-semibold text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-purple))] transition">
                {copied ? <Check className="h-3 w-3 inline text-emerald-400" /> : <ClipboardCopy className="h-3 w-3 inline" />}
              </button>
            </div>
          </div>

          {/* Messages */}
          {result.messages && result.messages.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {result.messages.map((msg, i) => (
                <span key={i} className="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] text-emerald-300">
                  <Info className="h-3 w-3 mr-1" /> {msg}
                </span>
              ))}
            </div>
          )}

          {/* Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-3.5 w-3.5 text-[hsl(var(--task-text-muted))]" />
            <input value={filterText} onChange={(e) => setFilterText(e.target.value)} placeholder="Filtrar no resultado..."
              className="h-8 flex-1 rounded-lg border border-[hsl(var(--task-border))] bg-[hsl(var(--task-bg))] px-3 text-[11px] text-[hsl(var(--task-text))] outline-none focus:border-[hsl(var(--task-purple)/0.5)] placeholder:text-[hsl(var(--task-text-muted)/0.4)]" />
          </div>

          {/* Content */}
          <pre className="max-h-[500px] overflow-auto styled-scrollbar rounded-lg border border-[hsl(var(--task-border)/0.4)] bg-[hsl(var(--task-bg)/0.5)] p-4 text-[11px] leading-relaxed text-[hsl(var(--task-text-muted)/0.8)] whitespace-pre-wrap">
            {displayText || "Nenhum dado encontrado para o filtro atual."}
          </pre>
        </motion.div>
      )}
    </motion.div>
  );
}
