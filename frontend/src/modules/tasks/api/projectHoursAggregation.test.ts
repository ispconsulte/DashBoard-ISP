import { describe, expect, it } from "vitest";
import { buildProjectHoursFromElapsedRows } from "./projectHoursAggregation";

describe("buildProjectHoursFromElapsedRows", () => {
  it("soma horas por projeto usando elapsed seconds e reference_date, ignorando changed_date/time_spent_in_logs", () => {
    const result = buildProjectHoursFromElapsedRows({
      elapsedRows: [
        { task_id: 10, user_id: 46, seconds: 1800, reference_date: "2026-05-10T12:00:00.000Z" },
        { task_id: 10, user_id: 46, seconds: 900, reference_date: "2026-05-11T12:00:00.000Z" },
        { task_id: 11, user_id: 47, seconds: 7200, reference_date: "2026-04-30T12:00:00.000Z" },
      ],
      taskRows: [
        {
          task_id: 10,
          title: "Tarefa com apontamento",
          project_id: 100,
          group_name: "Fallback",
          responsible_name: "Janete",
          time_spent_in_logs: 999999,
          changed_date: "2025-01-01T00:00:00.000Z",
          projects: { name: "Projeto Real", cliente_id: 7 },
        },
        {
          task_id: 11,
          title: "Fora do periodo",
          project_id: 100,
          group_name: "Fallback",
          responsible_name: "Alex",
          time_spent_in_logs: 7200,
          changed_date: "2026-05-10T00:00:00.000Z",
          projects: { name: "Projeto Real", cliente_id: 7 },
        },
      ],
      clientNameById: new Map([[7, "Cliente Real"]]),
      startIso: "2026-05-01T00:00:00.000Z",
      endIso: "2026-05-31T23:59:59.999Z",
    });

    expect(result.data).toEqual([
      {
        projectId: 100,
        projectName: "Projeto Real",
        clientId: 7,
        clientName: "Cliente Real",
        hours: 0.75,
        seconds: 2700,
        elapsedSeconds: 2700,
        diffSeconds: 0,
        hasHourMismatch: false,
      },
    ]);
    expect(result.mismatches[0]).toMatchObject({
      taskId: "10",
      timeSpentSeconds: 999999,
      elapsedSeconds: 2700,
    });
  });

  it("aplica filtros de projeto, cliente e consultor sobre os apontamentos", () => {
    const result = buildProjectHoursFromElapsedRows({
      elapsedRows: [
        { task_id: 10, user_id: 46, seconds: 3600, reference_date: "2026-05-10T12:00:00.000Z" },
        { task_id: 10, user_id: 47, seconds: 3600, reference_date: "2026-05-10T12:00:00.000Z" },
        { task_id: 20, user_id: 46, seconds: 3600, reference_date: "2026-05-10T12:00:00.000Z" },
      ],
      taskRows: [
        { task_id: 10, title: "A", project_id: 100, group_name: null, responsible_name: "Janete", projects: { name: "Projeto A", cliente_id: 7 } },
        { task_id: 20, title: "B", project_id: 200, group_name: null, responsible_name: "Janete", projects: { name: "Projeto B", cliente_id: 8 } },
      ],
      clientNameById: new Map([[7, "Cliente A"], [8, "Cliente B"]]),
      startIso: "2026-05-01T00:00:00.000Z",
      endIso: "2026-05-31T23:59:59.999Z",
      projectId: 100,
      clientId: 7,
      userId: 46,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ projectId: 100, seconds: 3600, hours: 1 });
  });
});
