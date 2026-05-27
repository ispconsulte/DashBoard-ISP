import {
  DEFAULT_TASK_DATE_FILTER_MODE,
  isTaskDateFilterMode,
  type TaskDateFilterMode,
} from "./taskDateFilter";

type TaskDatasetQueryInput = {
  period?: string;
  dateFrom?: string;
  dateTo?: string;
  dateFilterMode?: TaskDateFilterMode | string;
};

type TaskDatasetQuery = {
  period: string;
  dateFrom: string;
  dateTo: string;
  dateFilterMode: TaskDateFilterMode;
};

export const getTaskDatasetQueries = (filters: TaskDatasetQueryInput): {
  results: TaskDatasetQuery;
  filterOptions: TaskDatasetQuery;
} => ({
  results: {
    period: filters.period || "all",
    dateFrom: filters.dateFrom || "",
    dateTo: filters.dateTo || "",
    dateFilterMode: isTaskDateFilterMode(filters.dateFilterMode)
      ? filters.dateFilterMode
      : DEFAULT_TASK_DATE_FILTER_MODE,
  },
  filterOptions: {
    period: "all",
    dateFrom: "",
    dateTo: "",
    dateFilterMode: isTaskDateFilterMode(filters.dateFilterMode)
      ? filters.dateFilterMode
      : DEFAULT_TASK_DATE_FILTER_MODE,
  },
});
