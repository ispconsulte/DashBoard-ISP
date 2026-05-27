import { describe, expect, it } from "vitest";
import { getTaskDatasetQueries } from "./taskDatasetQuery";

describe("getTaskDatasetQueries", () => {
  it("keeps result data filtered while loading stable filter options separately", () => {
    const queries = getTaskDatasetQueries({
      period: "custom",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-25",
      dateFilterMode: "created_date",
    });

    expect(queries.results).toEqual({
      period: "custom",
      dateFrom: "2026-05-01",
      dateTo: "2026-05-25",
      dateFilterMode: "created_date",
    });
    expect(queries.filterOptions).toEqual({
      period: "all",
      dateFrom: "",
      dateTo: "",
      dateFilterMode: "created_date",
    });
  });
});
