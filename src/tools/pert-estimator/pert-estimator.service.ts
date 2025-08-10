import type { TimeUnit, TimeValue, TaskEstimate, PertCalculationResult, ProjectSummary, Task } from './pert-estimator.types';

const TIME_UNIT_TO_HOURS: Record<TimeUnit, number> = {
  minutes: 1 / 60,
  hours: 1,
  days: 8,
  weeks: 40,
};

export function convertToHours(timeValue: TimeValue): number {
  return timeValue.value * TIME_UNIT_TO_HOURS[timeValue.unit];
}

export function convertFromHours(hours: number, targetUnit: TimeUnit): number {
  return hours / TIME_UNIT_TO_HOURS[targetUnit];
}

export function validateEstimate(estimate: TaskEstimate): boolean {
  const optimisticHours = convertToHours(estimate.optimistic);
  const nominalHours = convertToHours(estimate.nominal);
  const pessimisticHours = convertToHours(estimate.pessimistic);

  return (
    optimisticHours > 0 &&
    nominalHours > 0 &&
    pessimisticHours > 0 &&
    optimisticHours <= nominalHours &&
    nominalHours <= pessimisticHours
  );
}

export function calculatePert(estimate: TaskEstimate): PertCalculationResult {
  if (!validateEstimate(estimate)) {
    throw new Error('Invalid estimate: optimistic ≤ nominal ≤ pessimistic and all values > 0');
  }

  const optimisticHours = convertToHours(estimate.optimistic);
  const nominalHours = convertToHours(estimate.nominal);
  const pessimisticHours = convertToHours(estimate.pessimistic);

  // PERT expected duration: (O + 4N + P) / 6
  const expectedDuration = (optimisticHours + 4 * nominalHours + pessimisticHours) / 6;

  // Standard deviation: (P - O) / 6
  const standardDeviation = (pessimisticHours - optimisticHours) / 6;

  // Variance: (standard deviation)²
  const variance = standardDeviation * standardDeviation;

  return {
    expectedDuration,
    standardDeviation,
    variance,
  };
}

export function createTask(
  name: string | undefined,
  estimate: TaskEstimate,
  id?: string
): Task {
  const calculation = calculatePert(estimate);

  return {
    id: id || crypto.randomUUID(),
    name,
    estimate,
    expectedDuration: calculation.expectedDuration,
    standardDeviation: calculation.standardDeviation,
    variance: calculation.variance,
  };
}

export function calculateProjectSummary(tasks: Task[]): ProjectSummary {
  if (tasks.length === 0) {
    return {
      totalExpectedDuration: 0,
      totalStandardDeviation: 0,
      totalVariance: 0,
      tasks: [],
    };
  }

  // Sum of expected durations
  const totalExpectedDuration = tasks.reduce((sum, task) => sum + task.expectedDuration, 0);

  // Sum of variances for independent tasks
  const totalVariance = tasks.reduce((sum, task) => sum + task.variance, 0);

  // Square root of total variance
  const totalStandardDeviation = Math.sqrt(totalVariance);

  return {
    totalExpectedDuration,
    totalStandardDeviation,
    totalVariance,
    tasks,
  };
}

export function formatDuration(hours: number, unit: TimeUnit): string {
  const convertedValue = convertFromHours(hours, unit);
  return `${convertedValue.toFixed(2)} ${unit}`;
}

export function getTimeUnitOptions(): Array<{ label: string; value: TimeUnit }> {
  return [
    { label: 'Minutes', value: 'minutes' },
    { label: 'Hours', value: 'hours' },
    { label: 'Days', value: 'days' },
    { label: 'Weeks', value: 'weeks' },
  ];
}