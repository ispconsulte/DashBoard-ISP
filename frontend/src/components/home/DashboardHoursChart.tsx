import { memo, useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Clock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import type { ProjectAnalytics } from "@/modules/analytics/types";

type Props = {
  projects: ProjectAnalytics[];
  loading?: boolean;
};

const ACCENT = "hsl(262, 83%, 58%)";
const ACCENT_HOVER = "hsl(262, 83%, 68%)";

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

function DashboardHoursChartInner({ projects, loading }: Props) {
  const isMobile = useIsMobile();
  const maxItems = isMobile ? 5 : 8;

  const data = useMemo(
    () =>
      projects
        .filter((p) => p.hoursUsed > 0)
        .slice(0, maxItems)
        .map((p) => ({
          name: truncate(p.projectName, isMobile ? 12 : 22),
          hours: Math.round(p.hoursUsed * 10) / 10,
          fullName: p.projectName,
        })),
    [projects, maxItems, isMobile]
  );

  return (
    <div className="rounded-2xl border border-border/12 bg-card/40 backdrop-blur-sm overflow-hidden h-full">
      <div className="flex items-center justify-between gap-2 border-b border-border/8 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
            <Clock className="h-3.5 w-3.5 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground">Horas por Projeto</h3>
        </div>
        {data.length > 0 && (
          <span className="text-[10px] text-muted-foreground">Top {data.length}</span>
        )}
      </div>
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-3 w-20 rounded bg-white/[0.04] animate-pulse" />
                <div className="h-5 rounded bg-white/[0.04] animate-pulse" style={{ width: `${60 - i * 8}%` }} />
              </div>
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Sem registro de horas
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 36 + 20)}>
            <BarChart data={data} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 4 }}>
              <XAxis
                type="number"
                tick={{ fill: "hsl(0 0% 100% / 0.35)", fontSize: 10 }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v) => `${v}h`}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={isMobile ? 80 : 140}
                tick={{ fill: "hsl(0 0% 100% / 0.5)", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(234 45% 12%)",
                  border: "1px solid hsl(0 0% 100% / 0.1)",
                  borderRadius: "12px",
                  fontSize: "12px",
                  color: "white",
                }}
                formatter={(value: number) => [`${value}h`, "Horas"]}
                labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullName ?? label}
              />
              <Bar dataKey="hours" radius={[0, 6, 6, 0]} maxBarSize={20}>
                {data.map((_, idx) => (
                  <Cell key={idx} fill={ACCENT} className="transition-colors hover:fill-[hsl(262,83%,68%)]" />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

export default memo(DashboardHoursChartInner);
