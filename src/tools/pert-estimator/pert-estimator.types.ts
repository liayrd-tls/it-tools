export type TimeUnit = 'minutes' | 'hours' | 'days' | 'weeks';

export interface TimeValue {
  value: number;
  unit: TimeUnit;
}

export interface TaskEstimate {
  optimistic: TimeValue;
  nominal: TimeValue;
  pessimistic: TimeValue;
}

export interface Task {
  id: string;
  name?: string;
  estimate: TaskEstimate;
  expectedDuration: number;
  standardDeviation: number;
  variance: number;
}

export interface ProjectSummary {
  totalExpectedDuration: number;
  totalStandardDeviation: number;
  totalVariance: number;
  tasks: Task[];
}

export interface PertCalculationResult {
  expectedDuration: number;
  standardDeviation: number;
  variance: number;
}

export interface ExportData {
  projectName?: string;
  tasks: Task[];
  projectSummary: ProjectSummary;
  exportedAt: string;
  version: string;
}

export interface ImportResult {
  projectName?: string;
  tasks: Task[];
  isValid: boolean;
  errors: string[];
}

export interface SavedProject {
  id: string;
  name: string;
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}