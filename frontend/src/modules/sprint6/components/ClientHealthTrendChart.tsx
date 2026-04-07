// ── Sprint 6.0 — Client Health: Trend Chart ───────────────────────
// Line chart showing EBITDA, Churn & NPS trends over months.

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { ClientKpiTrend } from "@/modules/sprint6/types";

interface Props {
  data: ClientKpiTrend[];
}

const MONTH_LABELS: Record<string, string> = {
  "01": "Jan", "02": "Fev", "03": "Mar", "04": "Abr",
  "05": "Mai", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Set", "10": "Out", "11": "Nov", "12": "Dez",
};

function formatMonth(m: string) {
  const [year, month] = m.split("-");
  return `${MONTH_LABELS[month] ?? month}/${year?.slice(2)}`;
}

export function ClientHealthTrendChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-border/40 bg-muted/30 py-12 text-sm text-muted-foreground">
        Não encontrado
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    EBITDA: d.ebitda != null ? Math.round(d.ebitda) : null,
    "Churn (%)": d.churn != null ? Math.round(d.churn * 10) / 10 : null,
    NPS: d.nps != null ? Math.round(d.nps) : null,
  }));

  return (
    <div className="w-full overflow-x-auto -mx-1 px-1">
      <div className="h-[280px]" style={{ minWidth: Math.max(350, chartData.length * 70) }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border) / 0.2)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={{ stroke: "hsl(var(--border) / 0.3)" }}
              tickLine={false}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `R$${(v / 1000).toFixed(0)}k`}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              domain={[-100, 100]}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border) / 0.3)",
                borderRadius: "8px",
                fontSize: "12px",
                color: "hsl(var(--foreground))",
              }}
              formatter={(value: number | null, name: string) => {
                if (value == null) return ["—", name];
                if (name === "EBITDA") return [`R$ ${value.toLocaleString("pt-BR")}`, name];
                if (name === "Churn (%)") return [`${value}%`, name];
                return [String(value), name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: "11px" }} />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="EBITDA"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="Churn (%)"
              stroke="hsl(0 72% 51%)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="NPS"
              stroke="hsl(160 84% 39%)"
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
