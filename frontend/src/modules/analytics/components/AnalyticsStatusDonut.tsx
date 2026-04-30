import { memo, useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";

type Props = {
  done: number;
  pending: number;
  overdue: number;
};

const COLORS = [
  "hsl(160 84% 39%)",  // done - green
  "hsl(262 83% 58%)",  // pending - purple
  "hsl(0 84% 60%)",    // overdue - red
];

function AnalyticsStatusDonutInner({ done, pending, overdue }: Props) {
  const total = done + pending + overdue;

  const data = useMemo(() => {
    if (total === 0) return [{ name: "Aguardando dados", value: 1 }];
    return [
      { name: "Concluídas", value: done },
      { name: "Em andamento", value: pending },
      { name: "Atrasadas", value: overdue },
    ].filter((d) => d.value > 0);
  }, [done, pending, overdue, total]);

  const pctDone = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="rounded-2xl border border-white/[0.06] p-6 transition-all hover:border-white/[0.10] flex flex-col items-center justify-center"
      style={{ background: "linear-gradient(145deg, hsl(270 50% 14% / 0.8), hsl(234 45% 10% / 0.6))" }}
    >
      <h3 className="text-sm font-bold text-white/70 mb-1 self-start">Distribuição de Status</h3>
      <p className="text-[10px] text-white/30 mb-4 self-start">Proporção entre concluídas, em andamento e atrasadas — identifique gargalos rapidamente</p>

      <div className="relative h-[180px] w-[180px]">
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
              stroke="none"
            >
              {data.map((_, i) => (
                <Cell key={i} fill={total === 0 ? "hsl(270 10% 20%)" : COLORS[i % COLORS.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white/90">{pctDone}%</span>
          <span className="text-[9px] text-white/30 uppercase tracking-wider">concluído</span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3">
        {[
          { label: "Concluídas", value: done, color: COLORS[0] },
          { label: "Andamento", value: pending, color: COLORS[1] },
          { label: "Atrasadas", value: overdue, color: COLORS[2] },
        ].map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <div className="h-2 w-2 rounded-full" style={{ background: item.color }} />
            <span className="text-[10px] text-white/40">{item.label}</span>
            <span className="text-[10px] font-bold text-white/60">{item.value}</span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default memo(AnalyticsStatusDonutInner);
