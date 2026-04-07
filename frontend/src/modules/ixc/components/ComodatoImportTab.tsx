import { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, Search, Send, AlertCircle, X, Loader2,
  Download, Box, CheckCircle2, AlertTriangle, XCircle, Info,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { parseTxtComodato, type ParsedComodatoItem, type ParsedComodatoSummary } from "../parseTxt";
import { consultarComodato, lancarComodato } from "../client";
import type { ComodatoStatus } from "../types";

/* ── Types ── */
export type RowStatus = "todo" | "ready" | "has" | "dup" | "warn" | "dead" | "error";

export type RowInfo = {
  status: RowStatus;
  message?: string;
  contratoId?: string;
  numeroPatrimonial?: string;
  idPatrimonio?: string;
  raw?: ComodatoStatus;
  launched?: boolean;
  launchMessage?: string;
};

const STATUS_META: Record<RowStatus, { color: string; label: string; icon: React.ReactNode }> = {
  todo: { color: "text-[hsl(var(--task-text-muted))]", label: "Aguardando", icon: <Info className="h-3 w-3" /> },
  ready: { color: "text-emerald-400", label: "Pronto", icon: <CheckCircle2 className="h-3 w-3" /> },
  has: { color: "text-sky-400", label: "Já possui", icon: <Box className="h-3 w-3" /> },
  dup: { color: "text-amber-400", label: "Duplicado", icon: <AlertTriangle className="h-3 w-3" /> },
  warn: { color: "text-yellow-400", label: "Atenção", icon: <AlertTriangle className="h-3 w-3" /> },
  dead: { color: "text-rose-400", label: "Inativo", icon: <XCircle className="h-3 w-3" /> },
  error: { color: "text-red-400", label: "Erro", icon: <XCircle className="h-3 w-3" /> },
};

const DEAD_KEYWORDS = [
  "contrato inativo", "contrato cancelado", "contrato desativado",
  "status do contrato deve ser", "patrimônio já está em comodato",
  "sem saldo", "almoxarifado",
];
const hasDeadKeyword = (t: string) => DEAD_KEYWORDS.some((w) => t.toLowerCase().includes(w));
const isContratoDead = (s: unknown) => {
  const t = String(s ?? "").trim().toLowerCase();
  return ["i", "c", "d", "s", "cancelado", "inativo", "desativado"].includes(t);
};

const rowKey = (item: ParsedComodatoItem) =>
  `${item.pppoe}|${item.serial ?? ""}|${item.modelo ?? ""}`.toLowerCase();

export default function ComodatoImportTab({ auditUser }: { auditUser: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [parsed, setParsed] = useState<ParsedComodatoSummary | null>(null);
  const [parsedFiles, setParsedFiles] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [parseError, setParseError] = useState("");

  const [rowResults, setRowResults] = useState<Record<string, RowInfo>>({});
  const [consultingKey, setConsultingKey] = useState<string | null>(null);
  const [batchBusy, setBatchBusy] = useState(false);
  const [launchBusy, setLaunchBusy] = useState(false);
  const [batchFeedback, setBatchFeedback] = useState("");
  const [logsOpen, setLogsOpen] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const pushLog = (msg: string) => {
    setLogs((p) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...p].slice(0, 300));
  };

  /* ── Import TXT ── */
  const handleFiles = async (fileList: FileList | null) => {
    if (!fileList?.length) return;
    setParsing(true);
    setParseError("");
    setParsed(null);
    setRowResults({});
    setSelected(new Set());
    setBatchFeedback("");
    try {
      const files = await Promise.all(
        Array.from(fileList).map(async (f) => ({ name: f.name, text: await f.text() }))
      );
      const summary = parseTxtComodato(files);
      setParsed(summary);
      setParsedFiles(files.map((f) => f.name));
      pushLog(`TXT importado: ${summary.items.length} válidos, ${summary.pendentes.length} pendentes, ${summary.totalLinhas} linhas.`);

      // Auto-consult all valid items after import
      if (summary.items.length > 0) {
        pushLog("Iniciando consulta automática...");
        autoConsultRef.current = true;
      }
    } catch (e) {
      setParseError(e instanceof Error ? e.message : "Falha ao ler TXT.");
    } finally {
      setParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Auto-consult after parse completes
  const autoConsultRef = useRef(false);
  useEffect(() => {
    if (autoConsultRef.current && parsed && !batchBusy) {
      autoConsultRef.current = false;
      handlePrepareAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed]);

  /* ── Table data ── */
  const tableRows = useMemo<ParsedComodatoItem[]>(() => {
    if (!parsed) return [];
    return [...parsed.items, ...parsed.pendentes];
  }, [parsed]);

  const resolveStatus = (item: ParsedComodatoItem): RowInfo => {
    const existing = rowResults[rowKey(item)];
    if (existing) return existing;
    if (item.status === "ok") return { status: "todo", message: "Aguardando consulta IXC" };
    if (item.status === "pendente") return { status: "warn", message: item.reason || "Pendente" };
    return { status: "warn", message: item.reason || "Inconsistência" };
  };

  const counts = useMemo(() => {
    const c = { total: tableRows.length, ready: 0, has: 0, warn: 0, dead: 0, error: 0, todo: 0 };
    for (const item of tableRows) {
      const s = resolveStatus(item).status;
      if (s in c) (c as Record<string, number>)[s] += 1;
    }
    return c;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tableRows, rowResults]);

  /* ── Consultar individual ── */
  const handleConsultarOne = async (item: ParsedComodatoItem) => {
    const key = rowKey(item);
    setConsultingKey(key);
    pushLog(`Consultando PPPoE ${item.pppoe}...`);
    const res = await consultarComodato({ pppoe: item.pppoe, serial: item.serial ?? undefined, auditUser });
    if (!res.ok || !res.data) {
      const err = res.error ?? "Falha";
      setRowResults((p) => ({ ...p, [key]: { status: hasDeadKeyword(err) ? "dead" : "error", message: err } }));
      pushLog(`Falha ${item.pppoe}: ${err}`);
    } else {
      const info = deriveStatus(res.data, item);
      setRowResults((p) => ({ ...p, [key]: info }));
      if (info.status === "ready") setSelected((p) => new Set(p).add(key));
      pushLog(`${item.pppoe}: ${info.message}`);
    }
    setConsultingKey(null);
  };

  /* ── Preparar todos ── */
  const handlePrepareAll = async () => {
    setBatchBusy(true);
    setBatchFeedback("");
    pushLog("Iniciando consulta em lote...");
    for (const item of tableRows) {
      if (item.status !== "ok") continue;
      const key = rowKey(item);
      if (rowResults[key]) continue;
      setConsultingKey(key);
      const res = await consultarComodato({ pppoe: item.pppoe, serial: item.serial ?? undefined, auditUser });
      if (!res.ok || !res.data) {
        const err = res.error ?? "Falha";
        setRowResults((p) => ({ ...p, [key]: { status: hasDeadKeyword(err) ? "dead" : "error", message: err } }));
      } else {
        const info = deriveStatus(res.data, item);
        setRowResults((p) => ({ ...p, [key]: info }));
        if (info.status === "ready") setSelected((p) => new Set(p).add(key));
      }
    }
    setConsultingKey(null);
    setBatchBusy(false);
    pushLog("Consulta em lote concluída.");
  };

  /* ── Lançar selecionados ── */
  const handleLaunchSelected = async () => {
    const readyItems = tableRows.filter((item) => {
      const key = rowKey(item);
      return selected.has(key) && rowResults[key]?.status === "ready";
    });
    if (!readyItems.length) return;
    setLaunchBusy(true);
    setBatchFeedback("");
    let inserted = 0, already = 0, failed = 0;
    const baseId = crypto.randomUUID?.() ?? `idem-${Date.now()}`;
    pushLog(`Lançando ${readyItems.length} comodato(s)...`);
    for (const item of readyItems) {
      const key = rowKey(item);
      const prep = rowResults[key];
      if (!prep?.contratoId) continue;
      const res = await lancarComodato({
        contratoId: prep.contratoId,
        numeroSerie: item.serial ?? "",
        numeroPatrimonial: prep.numeroPatrimonial,
        idPatrimonio: prep.idPatrimonio,
        descricao: item.modelo ?? "Equipamento",
        idempotencyKey: `${baseId}:${key}`,
        auditUser,
      });
      if (res.ok) {
        if (res.data?.status === "already_exists") already++;
        else inserted++;
        setRowResults((p) => ({ ...p, [key]: { ...p[key], status: "has", launched: true, launchMessage: res.data?.status === "already_exists" ? "Já existente" : "Lançado com sucesso" } }));
      } else {
        failed++;
        setRowResults((p) => ({ ...p, [key]: { ...p[key], launchMessage: res.error ?? "Falha ao lançar" } }));
      }
    }
    setLaunchBusy(false);
    const msg = `Lote: ${inserted} inseridos, ${already} já existentes, ${failed} falhas.`;
    setBatchFeedback(msg);
    pushLog(msg);
  };

  /* ── Export CSV ── */
  const handleExportCsv = (filter: string) => {
    if (!parsed) return;
    let rows = tableRows;
    if (filter === "ready") rows = rows.filter((r) => resolveStatus(r).status === "ready");
    else if (filter === "dead") rows = rows.filter((r) => resolveStatus(r).status === "dead");
    else if (filter === "warn") rows = rows.filter((r) => resolveStatus(r).status === "warn");
    const csv = ["PPPoE;Serial;Modelo;Status", ...rows.map((r) => `${r.pppoe};${r.serial ?? ""};${r.modelo ?? ""};${resolveStatus(r).status}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comodato-${filter}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
  };

  const toggleSelect = (key: string) => {
    setSelected((p) => {
      const n = new Set(p);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  };

  const selectAllReady = () => {
    const keys = tableRows.filter((r) => resolveStatus(r).status === "ready").map(rowKey);
    setSelected(new Set(keys));
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Upload area */}
      <div className="task-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-[hsl(var(--task-text))] flex items-center gap-2">
          <Upload className="h-4 w-4 text-[hsl(var(--task-purple))]" />
          Importar Arquivo TXT
        </h3>
        <p className="text-[11px] text-[hsl(var(--task-text-muted))]">
          Carregue o(s) arquivo(s) TXT exportados do OLT para extrair PPPoE, serial e modelo dos equipamentos.
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="flex cursor-pointer items-center gap-1.5 rounded-xl bg-gradient-to-r from-[hsl(262_83%_58%)] to-[hsl(234_89%_64%)] px-5 py-2.5 text-xs font-semibold text-white shadow-lg shadow-[hsl(262_83%_58%/0.3)] transition hover:shadow-[hsl(262_83%_58%/0.5)] hover:scale-[1.02] active:scale-[0.98]">
            <input ref={fileInputRef} type="file" accept=".txt" multiple onChange={(e) => handleFiles(e.target.files)} className="hidden" />
            {parsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {parsing ? "Processando..." : "Selecionar TXT"}
          </label>
          {parsed && (
            <>
              <button onClick={handlePrepareAll} disabled={batchBusy}
                className="flex items-center gap-1.5 rounded-xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] px-4 py-2 text-xs font-semibold text-[hsl(var(--task-text))] transition hover:border-[hsl(var(--task-purple)/0.5)] disabled:opacity-50">
                {batchBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
                Preparar Todos (Consultar IXC)
              </button>
              <button onClick={() => setExportOpen(!exportOpen)}
                className="flex items-center gap-1.5 rounded-xl border border-[hsl(var(--task-border))] bg-[hsl(var(--task-surface))] px-4 py-2 text-xs font-semibold text-[hsl(var(--task-text))] transition hover:border-[hsl(var(--task-purple)/0.5)]">
                <Download className="h-3.5 w-3.5" /> Exportar CSV
              </button>
            </>
          )}
        </div>

        {/* Export dropdown */}
        <AnimatePresence>
          {exportOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
              className="flex flex-wrap gap-2">
              {[
                { key: "all", label: "Todos" },
                { key: "ready", label: "Prontos" },
                { key: "dead", label: "Inativos" },
                { key: "warn", label: "Com atenção" },
              ].map((opt) => (
                <button key={opt.key} onClick={() => handleExportCsv(opt.key)}
                  className="rounded-lg border border-[hsl(var(--task-border))] px-3 py-1.5 text-[10px] font-semibold text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))] hover:border-[hsl(var(--task-purple)/0.5)] transition">
                  {opt.label}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      <AnimatePresence>
        {parseError && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="flex-1">{parseError}</span>
            <button onClick={() => setParseError("")}><X className="h-3.5 w-3.5 text-white/30 hover:text-white/60" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Summary cards */}
      {parsed && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* File info + counters */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            <CountCard label="Arquivos" value={parsedFiles.length} sub={parsedFiles.join(", ")} />
            <CountCard label="Linhas" value={parsed.totalLinhas} />
            <CountCard label="Total" value={counts.total} accent="purple" />
            <CountCard label="Prontos" value={counts.ready} accent="emerald" />
            <CountCard label="Já possui" value={counts.has} accent="sky" />
            <CountCard label="Atenção" value={counts.warn} accent="yellow" />
            <CountCard label="Inativos" value={counts.dead + counts.error} accent="rose" />
          </div>

          {/* Batch feedback */}
          {batchFeedback && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              {batchFeedback}
            </div>
          )}

          {/* Launch bar */}
          {counts.ready > 0 && (
            <div className="task-card p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <button onClick={selectAllReady} className="text-[10px] font-semibold text-[hsl(var(--task-purple))] hover:underline">
                  Selecionar todos prontos ({counts.ready})
                </button>
                <span className="text-[10px] text-[hsl(var(--task-text-muted))]">
                  {selected.size} selecionado(s)
                </span>
              </div>
              <button onClick={handleLaunchSelected} disabled={launchBusy || selected.size === 0}
                className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-emerald-600/30 transition hover:shadow-emerald-600/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
                {launchBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Lançar Selecionados
              </button>
            </div>
          )}

          {/* Table */}
          <div className="task-card overflow-hidden">
            <div className="overflow-x-auto styled-scrollbar">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="border-b border-[hsl(var(--task-border))] text-left">
                    <th className="px-3 py-2.5 font-semibold text-[hsl(var(--task-text-muted))]">Sel</th>
                    <th className="px-3 py-2.5 font-semibold text-[hsl(var(--task-text-muted))]">PPPoE</th>
                    <th className="px-3 py-2.5 font-semibold text-[hsl(var(--task-text-muted))]">Serial</th>
                    <th className="px-3 py-2.5 font-semibold text-[hsl(var(--task-text-muted))]">Modelo</th>
                    <th className="px-3 py-2.5 font-semibold text-[hsl(var(--task-text-muted))]">Origem</th>
                    <th className="px-3 py-2.5 font-semibold text-[hsl(var(--task-text-muted))]">Status</th>
                    <th className="px-3 py-2.5 font-semibold text-[hsl(var(--task-text-muted))]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((item) => {
                    const key = rowKey(item);
                    const info = resolveStatus(item);
                    const meta = STATUS_META[info.status];
                    const isConsulting = consultingKey === key;
                    return (
                      <tr key={key} className="border-b border-[hsl(var(--task-border)/0.3)] hover:bg-[hsl(var(--task-surface)/0.5)] transition">
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={selected.has(key)} onChange={() => toggleSelect(key)}
                            disabled={info.status !== "ready"}
                            className="h-3.5 w-3.5 rounded accent-[hsl(var(--task-purple))]" />
                        </td>
                        <td className="px-3 py-2 font-mono text-[hsl(var(--task-text))]">{item.pppoe}</td>
                        <td className="px-3 py-2 font-mono text-[hsl(var(--task-text-muted))]">{item.serial ?? "—"}</td>
                        <td className="px-3 py-2 text-[hsl(var(--task-text-muted))]">{item.modelo ?? "—"}</td>
                        <td className="px-3 py-2 text-[hsl(var(--task-text-muted))]">{item.origin}</td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${meta.color}`}>
                            {meta.icon} {meta.label}
                          </span>
                          {info.message && <p className="text-[9px] text-[hsl(var(--task-text-muted)/0.6)] mt-0.5 max-w-[200px] truncate">{info.message}</p>}
                          {info.launchMessage && <p className="text-[9px] text-emerald-400/80 mt-0.5">{info.launchMessage}</p>}
                        </td>
                        <td className="px-3 py-2">
                          {item.status === "ok" && info.status !== "has" && (
                            <button onClick={() => handleConsultarOne(item)} disabled={isConsulting || batchBusy}
                              className="flex items-center gap-1 rounded-lg border border-[hsl(var(--task-border))] px-2 py-1 text-[10px] font-semibold text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-purple))] hover:border-[hsl(var(--task-purple)/0.5)] transition disabled:opacity-40">
                              {isConsulting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Search className="h-3 w-3" />}
                              Consultar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {tableRows.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-[hsl(var(--task-text-muted))]">
                <FileText className="h-8 w-8 mb-2 opacity-30" />
                <p className="text-xs">Nenhum item carregado. Importe um arquivo TXT para começar.</p>
              </div>
            )}
          </div>

          {/* Logs */}
          <div className="task-card overflow-hidden">
            <button onClick={() => setLogsOpen(!logsOpen)}
              className="flex w-full items-center justify-between px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--task-text-muted))] hover:text-[hsl(var(--task-text))] transition">
              <span>Log de Operações ({logs.length})</span>
              {logsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
            <AnimatePresence>
              {logsOpen && (
                <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                  <div className="max-h-48 overflow-y-auto styled-scrollbar border-t border-[hsl(var(--task-border)/0.3)] px-4 py-2">
                    {logs.length === 0 ? (
                      <p className="text-[10px] text-[hsl(var(--task-text-muted)/0.5)] py-2">Nenhum log ainda.</p>
                    ) : (
                      logs.map((l, i) => (
                        <p key={i} className="text-[10px] text-[hsl(var(--task-text-muted)/0.7)] font-mono leading-relaxed">{l}</p>
                      ))
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

/* ── Helper ── */
function deriveStatus(data: ComodatoStatus, item: ParsedComodatoItem): RowInfo {
  if (data.comodatos?.length) return { status: "has", message: "Já possui comodato", raw: data };
  const contratoStatus = (data.contrato as Record<string, unknown>)?.status;
  if (isContratoDead(contratoStatus)) {
    return { status: "dead", message: `Contrato inativo (${String(contratoStatus)})`, raw: data };
  }
  const contratoId = data.contratoId;
  if (!contratoId) return { status: "dead", message: "Contrato não encontrado", raw: data };
  const patrimonio = data.patrimonio;
  if (!patrimonio || !Object.keys(patrimonio).length || !(patrimonio as { id?: unknown }).id) {
    return { status: "warn", message: "Patrimônio não localizado no IXC", contratoId, raw: data };
  }
  return {
    status: "ready",
    message: "Pronto para lançar",
    contratoId,
    numeroPatrimonial:
      (patrimonio as Record<string, string>).numero_patrimonial ||
      (patrimonio as Record<string, string>).n_patrimonial ||
      item.serial || "",
    idPatrimonio: String((patrimonio as Record<string, unknown>).id ?? ""),
    raw: data,
  };
}

function CountCard({ label, value, sub, accent }: { label: string; value: number; sub?: string; accent?: string }) {
  const colorMap: Record<string, string> = {
    purple: "text-[hsl(var(--task-purple))]",
    emerald: "text-emerald-400",
    sky: "text-sky-400",
    yellow: "text-yellow-400",
    rose: "text-rose-400",
  };
  return (
    <div className="task-card p-3 space-y-1">
      <p className="text-[9px] uppercase tracking-wider text-[hsl(var(--task-text-muted))] font-semibold">{label}</p>
      <p className={`text-lg font-bold ${accent ? colorMap[accent] ?? "text-[hsl(var(--task-text))]" : "text-[hsl(var(--task-text))]"}`}>{value}</p>
      {sub && <p className="text-[9px] text-[hsl(var(--task-text-muted)/0.5)] truncate">{sub}</p>}
    </div>
  );
}
