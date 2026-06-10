import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { supabaseExt } from "@/lib/supabase";
import { toast } from "sonner";
import { Save, Loader2, Search, FolderOpen, Building2, X, Trash2 } from "lucide-react";

interface Cliente {
  cliente_id: number;
  nome: string;
  tipo_horas: string;
  horas_hg_contratadas: number | null;
  Ativo: boolean;
  horas_contratadas: number;
  horas_consumidas: number;
  logo_url: string | null;
  cidade: string | null;
  projetos_quantidade: number;
  status: string | null;
}

interface ProjectRow {
  id: number;
  name: string;
  cliente_id: number | null;
  type?: string | null;
  project?: boolean | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: Cliente | null;
  onSaved: () => void | Promise<void>;
}

const STATUS_OPTIONS = ["Ativo", "Inativo", "Suspenso", "Cancelado"];
const TIPO_HORAS_OPTIONS = [
  { value: "HG", label: "Hora Garantida (HG)" },
  { value: "HP", label: "Hora Projeto (HP)" },
];

const inputCls = "h-10 rounded-xl border border-white/[0.06] bg-white/[0.045] text-sm text-foreground shadow-inner shadow-black/10 ring-0 placeholder:text-muted-foreground/35 transition-colors focus-visible:border-primary/35 focus-visible:ring-1 focus-visible:ring-primary/25";
const numberInputCls = `${inputCls} [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`;
const selectTriggerCls = "h-10 rounded-xl border border-white/[0.06] bg-white/[0.045] text-sm text-foreground shadow-inner shadow-black/10 ring-0 transition-colors focus:border-primary/35 focus:ring-1 focus:ring-primary/25 [&>svg]:text-muted-foreground";

function normalizeProjectType(project: Pick<ProjectRow, "type" | "project" | "name">) {
  const rawType = String(project.type ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const rawName = String(project.name ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (rawType.includes("collab")) return "Collab";
  if (rawType.includes("grupo")) return "Grupo de Trabalho";
  if (rawType.includes("projeto")) return "Projeto";
  if (rawName.includes("grupo de trabalho") || rawName.startsWith("gt -") || rawName.startsWith("gt-") || rawName.startsWith("departamento") || rawName.startsWith("revops") || rawName.includes("projetos internos")) return "Grupo de Trabalho";
  if (rawName.includes("collab") || rawName.includes("<>")) return "Collab";
  if (project.project === true) return "Projeto";
  return "Projeto";
}

function getProjectTypeBadgeClass(projectType: string) {
  if (projectType === "Collab") return "bg-cyan-500/12 text-cyan-300 border-cyan-500/20";
  if (projectType === "Grupo de Trabalho") return "bg-amber-500/12 text-amber-300 border-amber-500/20";
  return "bg-emerald-500/12 text-emerald-300 border-emerald-500/20";
}

export default function ClienteEditModal({ open, onOpenChange, cliente, onSaved }: Props) {
  const isEdit = !!cliente;

  const [nome, setNome] = useState("");
  const [cidade, setCidade] = useState("");
  const [status, setStatus] = useState("Ativo");
  const [tipoHoras, setTipoHoras] = useState("HG");
  const [horasContratadas, setHorasContratadas] = useState("0");
  const [horasConsumidas, setHorasConsumidas] = useState("0");
  const [horasHgContratadas, setHorasHgContratadas] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const [allProjects, setAllProjects] = useState<ProjectRow[]>([]);
  const [linkedProjectIds, setLinkedProjectIds] = useState<Set<number>>(new Set());
  const [projectSearch, setProjectSearch] = useState("");
  const [loadingProjects, setLoadingProjects] = useState(false);
  const selectedProjects = useMemo(
    () => allProjects.filter((project) => linkedProjectIds.has(project.id)),
    [allProjects, linkedProjectIds],
  );

  useEffect(() => {
    if (open && cliente) {
      setNome(cliente.nome);
      setCidade(cliente.cidade || "");
      setStatus(cliente.status || "Ativo");
      setTipoHoras((cliente.tipo_horas || "HG").trim());
      setHorasContratadas(String(cliente.horas_contratadas));
      setHorasConsumidas(String(cliente.horas_consumidas));
      setHorasHgContratadas(cliente.horas_hg_contratadas != null ? String(cliente.horas_hg_contratadas) : "");
      setLogoUrl(cliente.logo_url || "");
      setAtivo(cliente.Ativo);
    } else if (open && !cliente) {
      setNome(""); setCidade(""); setStatus("Ativo"); setTipoHoras("HG");
      setHorasContratadas("0"); setHorasConsumidas("0"); setHorasHgContratadas("");
      setLogoUrl(""); setAtivo(true);
    }
  }, [open, cliente]);

  useEffect(() => {
    if (!open) return;
    (async () => {
      setLoadingProjects(true);
      try {
        const primary = await (supabaseExt as any)
          .from("projects").select("id, name, cliente_id, type, project").eq("active", true).order("name", { ascending: true });
        let data = primary.data ?? [];
        if (primary.error) {
          const message = String(primary.error.message ?? "").toLowerCase();
          const missingProjectType =
            (message.includes("type") || message.includes("project")) &&
            (message.includes("does not exist") || message.includes("column"));
          if (!missingProjectType) throw primary.error;
          const legacy = await (supabaseExt as any)
            .from("projects").select("id, name, cliente_id").eq("active", true).order("name", { ascending: true });
          if (legacy.error) throw legacy.error;
          data = legacy.data ?? [];
        }
        setAllProjects(data ?? []);
        if (cliente) {
          const linked = (data ?? []).filter((p: ProjectRow) => p.cliente_id === cliente.cliente_id).map((p: ProjectRow) => p.id);
          setLinkedProjectIds(new Set(linked));
        } else {
          setLinkedProjectIds(new Set());
        }
      } catch (e: any) {
        console.error("Erro ao carregar projetos:", e);
      } finally {
        setLoadingProjects(false);
      }
    })();
  }, [open, cliente]);

  const suggestedProjects = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (q) return allProjects.filter((p) => p.name.toLowerCase().includes(q));
    if (nome.trim()) {
      const fullName = nome.trim().toLowerCase();
      return allProjects.filter((p) => {
        if (cliente && p.cliente_id === cliente.cliente_id) return true;
        const pLower = p.name.toLowerCase();
        return pLower.includes(fullName) || fullName.includes(pLower);
      });
    }
    return allProjects;
  }, [allProjects, projectSearch, nome, cliente]);

  const toggleProject = useCallback((projectId: number) => {
    setLinkedProjectIds((prev) => {
      const next = new Set(prev);
      next.has(projectId) ? next.delete(projectId) : next.add(projectId);
      return next;
    });
  }, []);

  const handleSave = async () => {
    if (!nome.trim()) { toast.error("O nome do cliente é obrigatório."); return; }
    setSaving(true);
    try {
      const payload: Record<string, any> = {
        nome: nome.trim(), cidade: cidade.trim() || null, status, tipo_horas: tipoHoras,
        horas_contratadas: Number(horasContratadas) || 0, horas_consumidas: Number(horasConsumidas) || 0,
        horas_hg_contratadas: horasHgContratadas ? Number(horasHgContratadas) : null,
        logo_url: logoUrl.trim() || null, Ativo: ativo,
      };
      let clienteId: number | null = null;
      let createdClienteId: number | null = null;
      if (isEdit && cliente) {
        const { error } = await (supabaseExt as any).from("clientes").update(payload).eq("cliente_id", cliente.cliente_id);
        if (error) throw error;
        clienteId = cliente.cliente_id;
      } else {
        const { data: inserted, error } = await (supabaseExt as any).from("clientes").insert(payload).select("cliente_id").single();
        if (error) throw error;
        clienteId = inserted?.cliente_id ?? null;
        createdClienteId = clienteId;
      }
      if (clienteId != null) {
        const selectedProjectIds = Array.from(linkedProjectIds).sort((a, b) => a - b);
        const { data: fnData, error: fnError } = await supabaseExt.functions.invoke(
          "update-project-cliente",
          { body: { cliente_id: clienteId, project_ids: selectedProjectIds } }
        );
        const functionErrorMessage = fnError?.message || fnData?.error;
        if (functionErrorMessage) {
          if (createdClienteId != null) {
            await (supabaseExt as any).from("clientes").delete().eq("cliente_id", createdClienteId);
          }
          throw new Error(functionErrorMessage);
        }
      }
      toast.success(isEdit ? "Cliente atualizado com sucesso!" : "Cliente criado com sucesso!");
      await Promise.resolve(onSaved());
      onOpenChange(false);
    } catch (e: any) {
      console.error("Erro ao salvar cliente:", e);
      toast.error(e.message || "Erro ao salvar cliente e projetos.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!cliente) return;
    const confirmed = window.confirm(`Excluir o cliente "${cliente.nome}"? Os projetos vinculados ficarão sem cliente associado.`);
    if (!confirmed) return;
    setSaving(true);
    try {
      const { data: fnData, error: fnError } = await supabaseExt.functions.invoke(
        "update-project-cliente",
        { body: { cliente_id: cliente.cliente_id, project_ids: [] } }
      );
      const functionErrorMessage = fnError?.message || fnData?.error;
      if (functionErrorMessage) throw new Error(functionErrorMessage);

      const { error } = await (supabaseExt as any)
        .from("clientes")
        .delete()
        .eq("cliente_id", cliente.cliente_id);
      if (error) throw error;

      toast.success("Cliente excluído com sucesso!");
      await Promise.resolve(onSaved());
      onOpenChange(false);
    } catch (e: any) {
      console.error("Erro ao excluir cliente:", e);
      toast.error(e.message || "Erro ao excluir cliente.");
    } finally {
      setSaving(false);
    }
  };

  const consumedPercent = useMemo(() => {
    const contracted = Number(horasContratadas) || 0;
    const consumed = Number(horasConsumidas) || 0;
    if (contracted <= 0) return 0;
    return Math.min(100, Math.round((consumed / contracted) * 100));
  }, [horasContratadas, horasConsumidas]);

  return (
    <Dialog modal={false} open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[94vh] w-[calc(100vw-1rem)] max-w-[920px] flex-col gap-0 overflow-hidden rounded-2xl border-white/[0.08] bg-[linear-gradient(180deg,hsl(224_42%_9%/0.98),hsl(228_38%_7%/0.96))] p-0 shadow-2xl shadow-black/50 backdrop-blur-xl sm:w-full">

        {/* ── Header: compact, balanced ── */}
        <div className="relative overflow-hidden border-b border-white/[0.08] bg-[linear-gradient(135deg,hsl(234_42%_14%/0.85),hsl(222_38%_9%/0.92)_48%,hsl(200_52%_10%/0.68))] px-5 py-4 sm:px-6 sm:py-5">
          <div className="pointer-events-none absolute right-16 top-0 h-24 w-24 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex items-center gap-4 pr-8">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.10] bg-white/[0.06] shadow-lg shadow-black/25">
            {logoUrl ? (
              <img src={logoUrl} alt={nome || "Logo"} className="h-full w-full object-cover object-center" />
            ) : (
              <Building2 className="h-5 w-5 text-primary" />
            )}
          </div>
          <DialogHeader className="min-w-0 flex-1 space-y-1">
            <DialogTitle className="truncate text-lg font-bold tracking-tight text-foreground">
              {isEdit ? nome || "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground/60">
              {isEdit ? "Editar dados e projetos vinculados" : "Preencha os dados para cadastrar"}
            </DialogDescription>
          </DialogHeader>
          {isEdit && (
            <Badge variant="outline" className={`mr-2 shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold ${ativo ? "border-emerald-500/20 bg-emerald-500/12 text-emerald-300" : "border-red-500/20 bg-red-500/12 text-red-300"}`}>
              {ativo ? "Ativo" : "Inativo"}
            </Badge>
          )}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 pt-5 pb-6 sm:px-6 sm:pt-6">

          {/* ── Section: Identificação ── */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 shadow-sm shadow-black/10">
          <SectionLabel>Identificação</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldWrap label="Nome" required className="sm:col-span-1">
              <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Info Online" className={inputCls} />
            </FieldWrap>
            <FieldWrap label="Cidade">
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex: São Paulo" className={inputCls} />
            </FieldWrap>
            <FieldWrap label="Status">
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className={selectTriggerCls}><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/[0.06]">
                  {STATUS_OPTIONS.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                </SelectContent>
              </Select>
            </FieldWrap>
            <FieldWrap label="URL do Logo">
              <Input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." className={inputCls} />
            </FieldWrap>
          </div>
          </div>

          {/* ── Section: Horas ── */}
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 shadow-sm shadow-black/10">
          <SectionLabel>Horas</SectionLabel>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <FieldWrap label="Tipo de Horas" required>
              <Select value={tipoHoras} onValueChange={setTipoHoras}>
                <SelectTrigger className={selectTriggerCls}><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/[0.06]">
                  {TIPO_HORAS_OPTIONS.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </FieldWrap>
            <FieldWrap label="Horas Contratadas">
              <Input type="number" value={horasContratadas} onChange={(e) => setHorasContratadas(e.target.value)} className={numberInputCls} />
            </FieldWrap>
            <FieldWrap label="Horas Consumidas">
              <Input type="number" value={horasConsumidas} onChange={(e) => setHorasConsumidas(e.target.value)} className={numberInputCls} />
            </FieldWrap>
            <FieldWrap label="Horas HG Contratadas">
              <Input type="number" value={horasHgContratadas} onChange={(e) => setHorasHgContratadas(e.target.value)} placeholder="Opcional" className={numberInputCls} />
            </FieldWrap>
          </div>

          {/* Consumption bar — inline, compact */}
          {isEdit && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-white/[0.05] bg-white/[0.035] px-4 py-3">
              <span className="shrink-0 text-xs font-medium text-muted-foreground/70">Consumo</span>
              <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-[linear-gradient(90deg,hsl(var(--primary)),hsl(200_75%_50%))]" style={{ width: `${consumedPercent}%` }} />
              </div>
              <span className="text-xs font-medium text-foreground tabular-nums">{consumedPercent}%</span>
            </div>
          )}
          </div>

          {/* Ativo toggle — compact inline */}
          <div className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] px-4 py-3">
            <Checkbox checked={ativo} onCheckedChange={(v) => setAtivo(!!v)} id="ativo-check" className="border-white/[0.1] data-[state=checked]:bg-primary data-[state=checked]:border-primary" />
            <label htmlFor="ativo-check" className="cursor-pointer select-none text-sm text-foreground flex-1">
              Cliente {ativo ? "ativo" : "inativo"}
            </label>
          </div>

          {/* ── Section: Projetos Associados ── */}
          <SectionLabel>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderOpen className="h-3.5 w-3.5 text-primary" />
                <span>Projetos Associados</span>
              </div>
              <span className="text-[10px] font-normal text-primary/70">{linkedProjectIds.size} selecionados</span>
            </div>
          </SectionLabel>

          <div className="space-y-3 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-4 shadow-sm shadow-black/10">
            {/* Search + actions row */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                <Input
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Buscar projetos..."
                  className={`${inputCls} pl-9 h-9 text-xs`}
                />
              </div>
              <div className="flex shrink-0 gap-2">
                <Button
                  type="button" variant="ghost" size="sm"
                  className="h-9 px-3 text-[11px] text-muted-foreground/60 hover:text-foreground"
                  onClick={() => {
                    const ids = suggestedProjects.map((p) => p.id);
                    setLinkedProjectIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
                  }}
                >
                  Todos
                </Button>
                <Button
                  type="button" variant="ghost" size="sm"
                  className="h-9 px-3 text-[11px] text-muted-foreground/60 hover:text-foreground"
                  onClick={() => setLinkedProjectIds(new Set())}
                >
                  Limpar
                </Button>
              </div>
            </div>

            {loadingProjects ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_300px]">
                {/* Available projects — scroll nativo (custom-scrollbar) para a barra
                    ocupar espaco proprio e nunca cobrir os badges. */}
                <div className="custom-scrollbar h-[250px] overflow-y-auto rounded-xl border border-white/[0.05] bg-white/[0.02] xl:h-[280px]">
                  {suggestedProjects.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">Nenhum projeto encontrado.</p>
                  ) : (
                    <div className="p-1.5 space-y-0.5">
                      {suggestedProjects.map((p) => {
                        const checked = linkedProjectIds.has(p.id);
                        const projectType = normalizeProjectType(p);
                        const isOther = p.cliente_id != null && p.cliente_id !== cliente?.cliente_id;
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2 rounded-lg px-2.5 min-h-9 py-1.5 text-xs cursor-pointer transition-colors ${
                              checked ? "bg-primary/8 text-foreground" : "hover:bg-white/[0.04] text-muted-foreground"
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleProject(p.id)}
                              className="border-white/[0.1] data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                            />
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            <span className="flex shrink-0 items-center gap-1">
                              <Badge variant="outline" title={projectType} className={`border text-[9px] font-medium whitespace-nowrap leading-none py-0.5 px-1.5 ${getProjectTypeBadgeClass(projectType)}`}>
                                {projectType === "Grupo de Trabalho" ? "Grupo" : projectType}
                              </Badge>
                              {isOther && (
                                <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-[9px] text-muted-foreground/50 whitespace-nowrap leading-none py-0.5 px-1.5">
                                  Outro
                                </Badge>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Selected summary */}
                <div className="custom-scrollbar h-[210px] overflow-y-auto rounded-xl border border-white/[0.06] bg-white/[0.035] xl:h-[280px]">
                  <div className="p-3">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40 mb-2.5">Selecionados</p>
                    {selectedProjects.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground/50 py-4 text-center">Nenhum selecionado</p>
                    ) : (
                      <div className="space-y-1">
                        {selectedProjects.map((project) => (
                          <div key={project.id} className="flex items-center gap-2 rounded-lg bg-white/[0.04] px-2.5 h-8">
                            <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground">{project.name}</span>
                            <button
                              type="button"
                              onClick={() => toggleProject(project.id)}
                              className="shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-foreground transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div className="-mx-5 mt-6 flex flex-col gap-2 border-t border-white/[0.06] bg-[hsl(228_38%_7%/0.92)] px-5 pt-4 pb-1 backdrop-blur-xl sm:-mx-6 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            {isEdit ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                disabled={saving}
                className="h-9 gap-2 justify-center rounded-xl text-red-300 hover:bg-red-500/10 hover:text-red-200"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Excluir
              </Button>
            ) : <div />}
            <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)} disabled={saving}
              className="h-9 text-muted-foreground hover:text-foreground hover:bg-white/[0.04]">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="h-9 gap-2 rounded-xl px-5">
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {isEdit ? "Salvar" : "Criar"}
            </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/50">
      {children}
    </div>
  );
}

function FieldWrap({ label, required, children, className = "" }: { label: string; required?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label className="text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wider">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
