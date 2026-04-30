import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";

const data = [
  { name: "Fibra", value: 57, color: "hsl(234 89% 64%)" },
  { name: "Rádio", value: 18, color: "hsl(160 84% 39%)" },
  { name: "Cabo", value: 9, color: "hsl(38 92% 50%)" },
  { name: "Satélite", value: 7, color: "hsl(280 70% 55%)" },
  { name: "Outros", value: 9, color: "hsl(215 20% 40%)" },
];

export default function OverviewDonut() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-semibold text-foreground">
          Distribuição de Planos
        </h3>
      </div>

      <div className="mt-2 flex items-center justify-center">
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
                strokeWidth={0}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">100%</span>
            <span className="text-[0.65rem] text-muted-foreground">Total</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ background: d.color }}
              />
              <span className="text-muted-foreground">{d.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-semibold text-foreground">{d.value}%</span>
              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${d.value}%`, background: d.color }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
