// ── Sprint 6.0 — Monthly Trend Chart (redesigned) ──────────────────
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RoiMonthlyTrend } from "@/modules/sprint6/types";

interface Props {
  data: RoiMonthlyTrend[];
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

export function RoiTrendChart({ data }: Props) {
  const isMobile = useIsMobile();

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Série histórica insuficiente
      </div>
    );
  }

  const chartData = data.map((d) => ({
    month: formatMonth(d.month),
    hours: d.hoursUsed,
  }));

  // Calculate delta for subtitle
  const lastTwo = chartData.slice(-2);
  const delta =
    lastTwo.length === 2 && lastTwo[0].hours > 0
      ? Math.round(((lastTwo[1].hours - lastTwo[0].hours) / lastTwo[0].hours) * 100)
      : null;

  return (
    <div className="space-y-2">
      {delta !== null && (
        <div className="flex items-center gap-1.5">
          <span className={`text-[11px] font-medium ${delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-white/40"}`}>
            {delta > 0 ? "+" : ""}{delta}%
          </span>
          <span className="text-[10px] text-white/30">vs mês anterior</span>
        </div>
      )}
      <div className={isMobile ? "h-[200px]" : "h-[260px]"} style={{ width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <defs>
              <linearGradient id="roiTrendGradV2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(262, 83%, 58%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(0 0% 100% / 0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.4)" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.35)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}h`}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(234 45% 12%)",
                border: "1px solid hsl(0 0% 100% / 0.1)",
                borderRadius: "12px",
                fontSize: "12px",
                color: "white",
              }}
              formatter={(value: number) => [`${value}h`, "Realizadas"]}
            />
            <Area
              type="monotone"
              dataKey="hours"
              stroke="hsl(262, 83%, 58%)"
              strokeWidth={2}
              fill="url(#roiTrendGradV2)"
              name="Horas Realizadas"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
