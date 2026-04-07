// ── Sprint 6.0 — Test Section Placeholder ──────────────────────────
// Reusable wrapper for each test section inside the Área de Testes page.

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ModuleStatus } from "@/modules/sprint6/types";

const statusConfig: Record<ModuleStatus, { label: string; className: string }> = {
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  parcial: { label: "Parcial", className: "bg-yellow-500/20 text-yellow-400" },
  pronto: { label: "Pronto", className: "bg-green-500/20 text-green-400" },
};

interface TestSectionProps {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  status: ModuleStatus;
  /** Optional list of missing backend dependencies to display */
  missingDeps?: string[];
  children?: ReactNode;
}

export function TestSection({ title, description, icon: Icon, status, missingDeps, children }: TestSectionProps) {
  const cfg = statusConfig[status];

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <CardDescription className="text-xs mt-0.5">{description}</CardDescription>
            </div>
          </div>
          <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Render actual widget content when available */}
        {children ?? (
          <div className="flex items-center justify-center rounded-lg border border-dashed border-border/40 bg-muted/30 py-12 text-sm text-muted-foreground">
            Aguardando implementação
          </div>
        )}

        {/* Missing dependencies notice */}
        {missingDeps && missingDeps.length > 0 && (
          <div className="rounded-lg bg-accent/30 border border-accent/40 p-3 text-xs text-accent-foreground/80 space-y-1">
            <p className="font-medium text-accent-foreground">Dependências pendentes:</p>
            {missingDeps.map((dep) => (
              <p key={dep}>• {dep}</p>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
