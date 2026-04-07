// ── Sprint 6.0 — Capacity: Project Load Donut ──────────────────────
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import type { CapacityProjectLoadItem } from "@/modules/sprint6/hooks/useCapacityData";
import { formatHoursHuman } from "@/modules/tasks/utils";

const COLORS = [
  "hsl(234 89% 64%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(280 70% 55%)",
  "hsl(0 72% 51%)",
  "hsl(200 70% 50%)",
  "hsl(330 70% 55%)",
  "hsl(215 20% 40%)",
];

interface Props {
  data: CapacityProjectLoadItem[];
  totalHours: number;
}

export function CapacityProjectDonut({ data, totalHours }: Props) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border/40 bg-muted/30 py-12 text-sm text-muted-foreground">
        Sem dados de carga por projeto
      </div>
    );
  }

  // Show top 7 + "Outros"
  const TOP_N = 7;
  const top = data.slice(0, TOP_N);
  const rest = data.slice(TOP_N);
  const chartData = [
    ...top.map((p, i) => ({
      name: p.projectName,
      value: p.totalHours,
      color: COLORS[i % COLORS.length],
    })),
    ...(rest.length > 0
      ? [{
          name: "Outros",
          value: Math.round(rest.reduce((s, p) => s + p.totalHours, 0) * 10) / 10,
          color: COLORS[TOP_N % COLORS.length],
        }]
      : []),
  ];

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative mx-auto aspect-square w-full max-w-[280px] sm:max-w-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="85%"
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatHoursHuman(value)}
              contentStyle={{
                background: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="px-4 text-center text-xl font-bold leading-tight text-foreground sm:text-2xl">
            {formatHoursHuman(totalHours)}
          </span>
          <span className="text-[0.65rem] text-muted-foreground">Total</span>
        </div>
      </div>

      <div className="text-center">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Distribuição</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Participação das horas por projeto no período selecionado.
        </p>
      </div>

      <div className="grid w-full grid-cols-1 gap-2 md:grid-cols-2">
        {chartData.map((d) => {
          const percent = totalHours > 0 ? Math.round((d.value / totalHours) * 100) : 0;

          return (
            <div
              key={d.name}
              className="min-w-0 overflow-hidden rounded-xl border border-border/15 bg-card/30 px-3 py-2.5"
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.color }} />
                <span className="text-xs text-muted-foreground break-words leading-snug">
                  {d.name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-xs font-semibold text-foreground">
                  {formatHoursHuman(d.value)}
                </span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${percent}%`, background: d.color }}
                  />
                </div>
                <span className="w-9 shrink-0 text-right text-[10px] text-muted-foreground">
                  {percent}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
