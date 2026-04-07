import { memo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const data = [
  { month: "Jan", atual: 4200, anterior: 3100 },
  { month: "Fev", atual: 3800, anterior: 3400 },
  { month: "Mar", atual: 5100, anterior: 3600 },
  { month: "Abr", atual: 4600, anterior: 4200 },
  { month: "Mai", atual: 6800, anterior: 4800 },
  { month: "Jun", atual: 5900, anterior: 5100 },
  { month: "Jul", atual: 7200, anterior: 5600 },
  { month: "Ago", atual: 6100, anterior: 5300 },
  { month: "Set", atual: 6900, anterior: 5700 },
  { month: "Out", atual: 7400, anterior: 5800 },
  { month: "Nov", atual: 7800, anterior: 6200 },
  { month: "Dez", atual: 8200, anterior: 6500 },
];

function RevenueChartInner() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-5">
      <div className="mb-1 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground">
            Atendimentos Mensais
          </h3>
          <p className="text-xs text-muted-foreground">
            Comparativo ano atual vs. anterior
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-primary" /> Ano Atual
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-muted-foreground/40" /> Ano Anterior
          </span>
        </div>
      </div>

      <div className="mt-4 h-[280px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPrimary" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(234 89% 64%)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(234 89% 64%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gradMuted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(215 20% 60%)" stopOpacity={0.12} />
                <stop offset="100%" stopColor="hsl(215 20% 60%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(222 25% 16%)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: "hsl(215 20% 60%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: "hsl(215 20% 60%)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(222 40% 8%)",
                border: "1px solid hsl(222 25% 16%)",
                borderRadius: 8,
                fontSize: 12,
                color: "hsl(210 40% 96%)",
              }}
            />
            <Area
              type="monotone"
              dataKey="anterior"
              stroke="hsl(215 20% 45%)"
              strokeWidth={1.5}
              fill="url(#gradMuted)"
            />
            <Area
              type="monotone"
              dataKey="atual"
              stroke="hsl(234 89% 64%)"
              strokeWidth={2}
              fill="url(#gradPrimary)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export default memo(RevenueChartInner);
