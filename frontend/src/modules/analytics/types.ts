export type ProjectAnalytics = {
  projectId: number;
  projectName: string;
  clientId: number;
  clientName: string;
  hoursUsed: number;
  hoursContracted: number;
  isActive: boolean;
  isFavorite: boolean;
  tasksDone: number;
  tasksPending: number;
  tasksOverdue: number;
  performance: "good" | "neutral" | "bad";
};

export type AnalyticsKpi = {
  label: string;
  value: string;
  change?: string;
  trend?: "up" | "down" | "flat";
};
