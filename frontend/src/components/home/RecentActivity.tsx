const rows = [
  { id: 1, cliente: "Carlos M.", tipo: "Instalação", status: "Concluído", data: "12/02" },
  { id: 2, cliente: "Ana P.", tipo: "Manutenção", status: "Em andamento", data: "12/02" },
  { id: 3, cliente: "Pedro S.", tipo: "Comodato", status: "Cancelado", data: "11/02" },
  { id: 4, cliente: "Julia R.", tipo: "Suporte", status: "Concluído", data: "11/02" },
  { id: 5, cliente: "Roberto F.", tipo: "Instalação", status: "Em andamento", data: "10/02" },
];

const statusStyle: Record<string, string> = {
  "Concluído": "bg-emerald-500/15 text-emerald-400",
  "Em andamento": "bg-amber-500/15 text-amber-400",
  "Cancelado": "bg-destructive/15 text-destructive",
};

export default function RecentActivity() {
  return (
    <div className="rounded-xl border border-border/50 bg-card/80 p-5">
      <h3 className="text-base font-semibold text-foreground">Atividade Recente</h3>
      <p className="text-xs text-muted-foreground">Últimas movimentações registradas</p>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/50 text-muted-foreground">
              <th className="pb-2 font-medium">Cliente</th>
              <th className="pb-2 font-medium">Tipo</th>
              <th className="pb-2 font-medium">Status</th>
              <th className="pb-2 font-medium text-right">Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/30 last:border-0">
                <td className="py-2.5 font-medium text-foreground">{r.cliente}</td>
                <td className="py-2.5 text-muted-foreground">{r.tipo}</td>
                <td className="py-2.5">
                  <span className={`inline-block rounded-full px-2 py-0.5 text-[0.65rem] font-semibold ${statusStyle[r.status]}`}>
                    {r.status}
                  </span>
                </td>
                <td className="py-2.5 text-right text-muted-foreground">{r.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
