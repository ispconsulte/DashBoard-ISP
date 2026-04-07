import type { TaskRecord } from "@/modules/tasks/types";

type TaskTableProps = {
  items: TaskRecord[];
};

const formatValue = (value: unknown) => {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

export function TaskTable({ items }: TaskTableProps) {
  if (!items.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-800 bg-slate-900/40 px-6 py-10 text-center text-slate-400">
        Nenhuma tarefa encontrada.
      </div>
    );
  }

  const columns = Object.keys(items[0]);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-800">
      <table className="min-w-full divide-y divide-slate-800">
        <thead className="bg-slate-900/60">
          <tr>
            {columns.map((col) => (
              <th
                key={col}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-300"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800 bg-slate-900/30">
          {items.map((task, idx) => (
            <tr key={idx} className="hover:bg-slate-900/50">
              {columns.map((col) => (
                <td key={col} className="px-4 py-3 text-sm text-slate-200">
                  {formatValue(task[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
