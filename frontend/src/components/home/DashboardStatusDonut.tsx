import { memo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Activity } from "lucide-react";

type Props = {
  done: number;
  pending: number;
  overdue: number;
  loading?: boolean;
};

const COLORS = {
  done: "hsl(160, 84%, 39%)",
  pending: "hsl(45, 93%, 58%)",
  overdue: "hsl(0, 84%, 60%)",
};

function DashboardStatusDonutInner({ done, pending, overdue, loading }: Props) {
  const total = done + pending + overdue;
  const data = [
    { name: "Concluídas", value: done, color: COLORS.done },
    { name: "Em Andamento", value: pending, color: COLORS.pending },
    { name: "Atrasadas", value: overdue, color: COLORS.overdue },
  ].filter((d) => d.value > 0);

  const completionPct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="rounded-2xl border border-border/12 bg-card/40 backdrop-blur-sm overflow-hidden h-full">
      <div className="flex items-center gap-2.5 border-b border-border/8 px-4 py-3">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
          <Activity className="h-3.5 w-3.5 text-primary" />
        </div>
        <h3 className="text-sm font-semibold text-foreground">Status das Tarefas</h3>
      </div>
      <div className="p-4 sm:p-5">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <div className="h-32 w-32 rounded-full bg-white/[0.04] animate-pulse" />
          </div>
        ) : total === 0 ? (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            Sem dados no período
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="relative h-48 w-48">
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <PieChart>
                  <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={80}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {data.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "hsl(234 45% 12%)",
                      border: "1px solid hsl(0 0% 100% / 0.1)",
                      borderRadius: "12px",
                      fontSize: "12px",
                      color: "white",
                    }}
                    formatter={(value: number, name: string) => [`${value} tarefas`, name]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white/90">{completionPct}%</span>
                <span className="text-[10px] text-white/40">concluídas</span>
              </div>
            </div>
            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-4">
              {data.map((d) => (
                <div key={d.name} className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ background: d.color }} />
                  <span className="text-[11px] text-white/50">{d.name}</span>
                  <span className="text-[11px] font-semibold text-white/70">{d.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(DashboardStatusDonutInner);
