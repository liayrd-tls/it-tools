import type { TimeUnit, TimeValue, TaskEstimate, PertCalculationResult, ProjectSummary, Task, ExportData, ImportResult, SavedProject } from './pert-estimator.types';

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

// Export functions
export function exportToCSV(tasks: Task[], projectName?: string): string {
  const headers = [
    'Task Name',
    'Optimistic Value',
    'Optimistic Unit',
    'Nominal Value', 
    'Nominal Unit',
    'Pessimistic Value',
    'Pessimistic Unit',
    'Expected Duration (hours)',
    'Standard Deviation (hours)'
  ];
  
  const rows = tasks.map((task, index) => [
    task.name || `Task ${index + 1}`,
    task.estimate.optimistic.value.toString(),
    task.estimate.optimistic.unit,
    task.estimate.nominal.value.toString(),
    task.estimate.nominal.unit,
    task.estimate.pessimistic.value.toString(),
    task.estimate.pessimistic.unit,
    task.expectedDuration.toFixed(2),
    task.standardDeviation.toFixed(2)
  ]);
  
  let csvContent = '';
  if (projectName) {
    csvContent += `"Project: ${projectName}"\n\n`;
  }
  
  csvContent += [headers, ...rows]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');
    
  return csvContent;
}

export function exportToMarkdown(tasks: Task[], projectSummary: ProjectSummary, projectName?: string): string {
  let markdown = `# ${projectName || 'PERT Project Estimation'}\n\n`;
  
  // Tasks table
  markdown += '## Tasks\n\n';
  markdown += '| Task Name | Optimistic | Nominal | Pessimistic | Expected | Std. Deviation |\n';
  markdown += '|-----------|------------|---------|-------------|----------|----------------|\n';
  
  tasks.forEach((task, index) => {
    const name = task.name || `Task ${index + 1}`;
    const opt = `${task.estimate.optimistic.value} ${task.estimate.optimistic.unit}`;
    const nom = `${task.estimate.nominal.value} ${task.estimate.nominal.unit}`;
    const pes = `${task.estimate.pessimistic.value} ${task.estimate.pessimistic.unit}`;
    const exp = `${task.expectedDuration.toFixed(2)} hours`;
    const std = `${task.standardDeviation.toFixed(2)} hours`;
    
    markdown += `| ${name} | ${opt} | ${nom} | ${pes} | ${exp} | ${std} |\n`;
  });
  
  // Project summary
  markdown += '\n## Project Summary\n\n';
  markdown += `- **Total Expected Duration**: ${projectSummary.totalExpectedDuration.toFixed(2)} hours\n`;
  markdown += `- **Total Standard Deviation**: ${projectSummary.totalStandardDeviation.toFixed(2)} hours\n`;
  markdown += `- **Total Variance**: ${projectSummary.totalVariance.toFixed(4)}\n\n`;
  
  // Different time units
  markdown += '### Converted Results\n\n';
  const units: TimeUnit[] = ['minutes', 'hours', 'days', 'weeks'];
  units.forEach(unit => {
    const converted = convertFromHours(projectSummary.totalExpectedDuration, unit);
    markdown += `- **Expected duration in ${unit}**: ${converted.toFixed(2)}\n`;
  });
  
  markdown += `\n*Generated on ${new Date().toLocaleString()}*\n`;
  
  return markdown;
}

export function exportToJSON(tasks: Task[], projectSummary: ProjectSummary, projectName?: string): string {
  const exportData: ExportData = {
    projectName,
    tasks,
    projectSummary,
    exportedAt: new Date().toISOString(),
    version: '1.0'
  };
  
  return JSON.stringify(exportData, null, 2);
}

export function generateFileName(projectName: string | undefined, extension: string): string {
  const baseName = projectName 
    ? projectName.replace(/[^a-z0-9]/gi, '_').toLowerCase()
    : 'pert_tasks';
  
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${baseName}_${timestamp}.${extension}`;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import functions
export function importFromCSV(csvContent: string): ImportResult {
  const errors: string[] = [];
  const tasks: Task[] = [];
  let projectName: string | undefined;
  
  try {
    const lines = csvContent.trim().split('\n');
    if (lines.length < 2) {
      return { tasks: [], isValid: false, errors: ['CSV file is empty or has no data rows'] };
    }
    
    // Check if first line is a project name
    let startIndex = 0;
    if (lines[0].startsWith('"Project:')) {
      const projectMatch = lines[0].match(/^"Project:\s*(.+)"$/);
      if (projectMatch) {
        projectName = projectMatch[1];
        startIndex = 2; // Skip project line and empty line
      }
    }
    
    // Find header row and skip it
    let headerIndex = startIndex;
    for (let i = startIndex; i < lines.length; i++) {
      if (lines[i].includes('Task Name')) {
        headerIndex = i;
        break;
      }
    }
    
    const dataLines = lines.slice(headerIndex + 1);
    
    dataLines.forEach((line, index) => {
      try {
        // Parse CSV line (handle quoted values)
        const values = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
        const cleanValues = values.map(v => v.replace(/^"|"$/g, '').trim());
        
        if (cleanValues.length < 9) {
          errors.push(`Row ${index + 2}: Insufficient columns`);
          return;
        }
        
        const [name, optValue, optUnit, nomValue, nomUnit, pesValue, pesUnit] = cleanValues;
        
        // Validate and convert values
        const optimisticValue = parseFloat(optValue);
        const nominalValue = parseFloat(nomValue);
        const pessimisticValue = parseFloat(pesValue);
        
        if (isNaN(optimisticValue) || isNaN(nominalValue) || isNaN(pessimisticValue)) {
          errors.push(`Row ${index + 2}: Invalid numeric values`);
          return;
        }
        
        // Validate units
        const validUnits: TimeUnit[] = ['minutes', 'hours', 'days', 'weeks'];
        if (!validUnits.includes(optUnit as TimeUnit) || 
            !validUnits.includes(nomUnit as TimeUnit) || 
            !validUnits.includes(pesUnit as TimeUnit)) {
          errors.push(`Row ${index + 2}: Invalid time units`);
          return;
        }
        
        const estimate: TaskEstimate = {
          optimistic: { value: optimisticValue, unit: optUnit as TimeUnit },
          nominal: { value: nominalValue, unit: nomUnit as TimeUnit },
          pessimistic: { value: pessimisticValue, unit: pesUnit as TimeUnit }
        };
        
        // Validate PERT rules
        if (!validateEstimate(estimate)) {
          errors.push(`Row ${index + 2}: Invalid estimates (optimistic ≤ nominal ≤ pessimistic required)`);
          return;
        }
        
        const task = createTask(name || undefined, estimate);
        tasks.push(task);
        
      } catch (error) {
        errors.push(`Row ${index + 2}: Failed to parse - ${error}`);
      }
    });
    
  } catch (error) {
    errors.push(`CSV parsing failed: ${error}`);
  }
  
  return {
    projectName,
    tasks,
    isValid: errors.length === 0,
    errors
  };
}

export function importFromJSON(jsonContent: string): ImportResult {
  const errors: string[] = [];
  const tasks: Task[] = [];
  let projectName: string | undefined;
  
  try {
    const data = JSON.parse(jsonContent);
    
    // Check if it's our export format
    if (data.version && data.tasks && Array.isArray(data.tasks)) {
      projectName = data.projectName;
      // Import from our export format
      data.tasks.forEach((taskData: any, index: number) => {
        try {
          if (!validateImportTaskData(taskData)) {
            errors.push(`Task ${index + 1}: Invalid task structure`);
            return;
          }
          
          const estimate: TaskEstimate = taskData.estimate;
          if (!validateEstimate(estimate)) {
            errors.push(`Task ${index + 1}: Invalid estimates`);
            return;
          }
          
          const task = createTask(taskData.name, estimate, taskData.id);
          tasks.push(task);
          
        } catch (error) {
          errors.push(`Task ${index + 1}: ${error}`);
        }
      });
    } else if (Array.isArray(data)) {
      // Import from simple array format
      data.forEach((taskData: any, index: number) => {
        try {
          if (!validateImportTaskData(taskData)) {
            errors.push(`Task ${index + 1}: Invalid task structure`);
            return;
          }
          
          const estimate: TaskEstimate = taskData.estimate;
          if (!validateEstimate(estimate)) {
            errors.push(`Task ${index + 1}: Invalid estimates`);
            return;
          }
          
          const task = createTask(taskData.name, estimate);
          tasks.push(task);
          
        } catch (error) {
          errors.push(`Task ${index + 1}: ${error}`);
        }
      });
    } else {
      errors.push('Invalid JSON format: Expected tasks array or export data object');
    }
    
  } catch (error) {
    errors.push(`JSON parsing failed: ${error}`);
  }
  
  return {
    projectName,
    tasks,
    isValid: errors.length === 0,
    errors
  };
}

export function validateImportTaskData(taskData: any): boolean {
  return (
    taskData &&
    typeof taskData === 'object' &&
    taskData.estimate &&
    taskData.estimate.optimistic &&
    taskData.estimate.nominal &&
    taskData.estimate.pessimistic &&
    typeof taskData.estimate.optimistic.value === 'number' &&
    typeof taskData.estimate.nominal.value === 'number' &&
    typeof taskData.estimate.pessimistic.value === 'number' &&
    ['minutes', 'hours', 'days', 'weeks'].includes(taskData.estimate.optimistic.unit) &&
    ['minutes', 'hours', 'days', 'weeks'].includes(taskData.estimate.nominal.unit) &&
    ['minutes', 'hours', 'days', 'weeks'].includes(taskData.estimate.pessimistic.unit)
  );
}

// Project management functions
const PROJECTS_STORAGE_KEY = 'pert-estimator-projects';

export function saveProject(name: string, tasks: Task[]): SavedProject {
  const projects = getSavedProjects();
  const now = new Date().toISOString();
  
  const project: SavedProject = {
    id: crypto.randomUUID(),
    name,
    tasks: JSON.parse(JSON.stringify(tasks)), // Deep copy
    createdAt: now,
    updatedAt: now,
  };
  
  projects.push(project);
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  
  return project;
}

export function updateProject(projectId: string, name: string, tasks: Task[]): SavedProject | null {
  const projects = getSavedProjects();
  const projectIndex = projects.findIndex(p => p.id === projectId);
  
  if (projectIndex === -1) {
    return null;
  }
  
  projects[projectIndex] = {
    ...projects[projectIndex],
    name,
    tasks: JSON.parse(JSON.stringify(tasks)), // Deep copy
    updatedAt: new Date().toISOString(),
  };
  
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
  
  return projects[projectIndex];
}

export function getSavedProjects(): SavedProject[] {
  try {
    const stored = localStorage.getItem(PROJECTS_STORAGE_KEY);
    if (!stored) return [];
    
    const projects = JSON.parse(stored);
    return Array.isArray(projects) ? projects : [];
  } catch (error) {
    console.error('Error loading saved projects:', error);
    return [];
  }
}

export function deleteProject(projectId: string): boolean {
  const projects = getSavedProjects();
  const filteredProjects = projects.filter(p => p.id !== projectId);
  
  if (filteredProjects.length === projects.length) {
    return false; // Project not found
  }
  
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(filteredProjects));
  return true;
}

export function loadProject(projectId: string): SavedProject | null {
  const projects = getSavedProjects();
  return projects.find(p => p.id === projectId) || null;
}

export function duplicateProject(projectId: string): SavedProject | null {
  const originalProject = loadProject(projectId);
  if (!originalProject) {
    return null;
  }
  
  return saveProject(`${originalProject.name} (Copy)`, originalProject.tasks);
}