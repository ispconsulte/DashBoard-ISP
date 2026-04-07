// ── Sprint 6.0 — Hours Bar Chart (redesigned) ──────────────────────
import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useIsMobile } from "@/hooks/use-mobile";
import type { RoiProjectData } from "@/modules/sprint6/types";

interface Props {
  projects: RoiProjectData[];
}

function truncate(str: string, max: number) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}

export function RoiHoursChart({ projects }: Props) {
  const isMobile = useIsMobile();
  const maxItems = isMobile ? 6 : 15;

  const data = useMemo(() => {
    return projects
      .filter((p) => p.hoursContracted > 0 || p.hoursUsed > 0)
      .slice(0, maxItems)
      .map((p) => ({
        name: truncate(p.projectName, isMobile ? 12 : 18),
        fullName: p.projectName,
        "Orçadas": Math.round(p.hoursContracted * 10) / 10,
        "Realizadas": Math.round(p.hoursUsed * 10) / 10,
      }));
  }, [projects, maxItems, isMobile]);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
        Sem dados de comparação neste período
      </div>
    );
  }

  const chartHeight = Math.max(220, Math.min(380, data.length * 32 + 60));

  return (
    <div className="w-full overflow-x-auto -mx-1 px-1">
      <div style={{ height: chartHeight, minWidth: isMobile ? 320 : Math.max(400, data.length * 50) }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 4, right: 12, bottom: 4, left: 0 }}
            barGap={1}
            barCategoryGap="22%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(0 0% 100% / 0.06)"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.4)" }}
              axisLine={false}
              tickLine={false}
              angle={data.length > 6 ? -30 : 0}
              textAnchor={data.length > 6 ? "end" : "middle"}
              height={data.length > 6 ? 50 : 30}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "hsl(0 0% 100% / 0.35)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v}h`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "hsl(234 45% 12%)",
                border: "1px solid hsl(0 0% 100% / 0.1)",
                borderRadius: "12px",
                fontSize: "12px",
                color: "white",
              }}
              formatter={(value: number, name: string) => [`${value}h`, name]}
              labelFormatter={(_: string, payload: any[]) => payload?.[0]?.payload?.fullName ?? _}
            />
            <Legend
              wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
              iconType="circle"
              iconSize={8}
            />
            <Bar
              dataKey="Orçadas"
              fill="hsl(262 83% 58% / 0.35)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
            <Bar
              dataKey="Realizadas"
              fill="hsl(262 83% 58%)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
