import { useState, useEffect, useMemo, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabaseExt } from "@/lib/supabase";
import { toast } from "sonner";
import { Save, Loader2, Search, FolderOpen, Building2, X } from "lucide-react";

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

const inputCls = "h-10 text-sm bg-white/[0.04] border-0 ring-0 focus-visible:ring-1 focus-visible:ring-primary/30 rounded-xl placeholder:text-muted-foreground/40 text-foreground";
const selectTriggerCls = "h-10 text-sm bg-white/[0.04] border-0 ring-0 focus:ring-1 focus:ring-primary/30 rounded-xl text-foreground [&>svg]:text-muted-foreground";

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

  const consumedPercent = useMemo(() => {
    const contracted = Number(horasContratadas) || 0;
    const consumed = Number(horasConsumidas) || 0;
    if (contracted <= 0) return 0;
    return Math.min(100, Math.round((consumed / contracted) * 100));
  }, [horasContratadas, horasConsumidas]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-[720px] max-h-[92vh] overflow-y-auto bg-[linear-gradient(180deg,hsl(222_40%_8%/0.97),hsl(228_38%_8%/0.94))] backdrop-blur-xl border-white/[0.06] rounded-2xl shadow-2xl shadow-black/40 p-0 sm:w-full">

        {/* ── Header: compact, balanced ── */}
        <div className="flex items-center gap-3.5 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.04]">
            {logoUrl ? (
              <img src={logoUrl} alt={nome || "Logo"} className="h-full w-full object-cover object-center" />
            ) : (
              <Building2 className="h-5 w-5 text-primary" />
            )}
          </div>
          <DialogHeader className="flex-1 min-w-0 space-y-0">
            <DialogTitle className="text-base font-semibold tracking-tight text-foreground truncate">
              {isEdit ? nome || "Editar Cliente" : "Novo Cliente"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground/60">
              {isEdit ? "Editar dados e projetos vinculados" : "Preencha os dados para cadastrar"}
            </p>
          </DialogHeader>
          {isEdit && (
            <Badge variant="outline" className={`shrink-0 mr-2 text-[10px] border-0 ${ativo ? "bg-emerald-500/12 text-emerald-400" : "bg-red-500/12 text-red-400"}`}>
              {ativo ? "Ativo" : "Inativo"}
            </Badge>
          )}
        </div>

        <div className="space-y-5 px-5 py-5 sm:px-6">

          {/* ── Section: Identificação ── */}
          <SectionLabel>Identificação</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldWrap label="Nome" required>
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

          {/* ── Section: Horas ── */}
          <SectionLabel>Horas</SectionLabel>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <FieldWrap label="Tipo de Horas" required>
              <Select value={tipoHoras} onValueChange={setTipoHoras}>
                <SelectTrigger className={selectTriggerCls}><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/[0.06]">
                  {TIPO_HORAS_OPTIONS.map((t) => (<SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </FieldWrap>
            <FieldWrap label="Horas Contratadas">
              <Input type="number" value={horasContratadas} onChange={(e) => setHorasContratadas(e.target.value)} className={inputCls} />
            </FieldWrap>
            <FieldWrap label="Horas Consumidas">
              <Input type="number" value={horasConsumidas} onChange={(e) => setHorasConsumidas(e.target.value)} className={inputCls} />
            </FieldWrap>
            <FieldWrap label="Horas HG Contratadas">
              <Input type="number" value={horasHgContratadas} onChange={(e) => setHorasHgContratadas(e.target.value)} placeholder="Opcional" className={inputCls} />
            </FieldWrap>
          </div>

          {/* Consumption bar — inline, compact */}
          {isEdit && (
            <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-2.5">
              <span className="text-xs text-muted-foreground/60 shrink-0">Consumo</span>
              <div className="flex-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full rounded-full bg-primary/70" style={{ width: `${consumedPercent}%` }} />
              </div>
              <span className="text-xs font-medium text-foreground tabular-nums">{consumedPercent}%</span>
            </div>
          )}

          {/* Ativo toggle — compact inline */}
          <div className="flex items-center gap-3 rounded-xl bg-white/[0.03] px-4 py-2.5">
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

          <div className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            {/* Search + actions row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                <Input
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                  placeholder="Buscar projetos..."
                  className={`${inputCls} pl-9 h-9 text-xs`}
                />
              </div>
              <Button
                type="button" variant="ghost" size="sm"
                className="h-9 px-3 text-[11px] text-muted-foreground/60 hover:text-foreground shrink-0"
                onClick={() => {
                  const ids = suggestedProjects.map((p) => p.id);
                  setLinkedProjectIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.add(id)); return next; });
                }}
              >
                Todos
              </Button>
              <Button
                type="button" variant="ghost" size="sm"
                className="h-9 px-3 text-[11px] text-muted-foreground/60 hover:text-foreground shrink-0"
                onClick={() => setLinkedProjectIds(new Set())}
              >
                Limpar
              </Button>
            </div>

            {loadingProjects ? (
              <div className="flex items-center justify-center py-8 text-muted-foreground text-xs gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando...
              </div>
            ) : (
              <div className="grid gap-3 lg:grid-cols-[1fr_220px]">
                {/* Available projects */}
                <ScrollArea className="h-[220px] rounded-lg border border-white/[0.04] bg-white/[0.02] lg:h-[240px]">
                  {suggestedProjects.length === 0 ? (
                    <p className="text-center text-xs text-muted-foreground py-8">Nenhum projeto encontrado.</p>
                  ) : (
                    <div className="p-1.5 space-y-0.5">
                      {suggestedProjects.map((p) => {
                        const checked = linkedProjectIds.has(p.id);
                        const projectType = normalizeProjectType(p);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2.5 rounded-lg px-3 h-9 text-xs cursor-pointer transition-colors ${
                              checked ? "bg-primary/8 text-foreground" : "hover:bg-white/[0.04] text-muted-foreground"
                            }`}
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => toggleProject(p.id)}
                              className="border-white/[0.1] data-[state=checked]:bg-primary data-[state=checked]:border-primary shrink-0"
                            />
                            <span className="min-w-0 flex-1 truncate">{p.name}</span>
                            <Badge variant="outline" className={`border text-[9px] font-medium shrink-0 leading-none py-0.5 px-1.5 ${getProjectTypeBadgeClass(projectType)}`}>
                              {projectType}
                            </Badge>
                            {p.cliente_id != null && p.cliente_id !== cliente?.cliente_id && (
                              <Badge variant="outline" className="border-white/[0.08] bg-white/[0.04] text-[9px] text-muted-foreground/50 shrink-0 leading-none py-0.5 px-1.5">
                                Outro
                              </Badge>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </ScrollArea>

                {/* Selected summary */}
                <ScrollArea className="h-[220px] rounded-lg border border-white/[0.06] bg-white/[0.03] lg:h-[240px]">
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
                </ScrollArea>
              </div>
            )}
          </div>

          {/* ── Footer actions ── */}
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] pt-4">
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

function FieldWrap({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[11px] text-muted-foreground/60 font-medium uppercase tracking-wider">
        {label}{required && <span className="text-primary ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
