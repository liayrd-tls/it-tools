<script setup lang="ts">
import type { Task, TaskEstimate, TimeUnit, ProjectSummary, SavedProject } from './pert-estimator.types';
import { 
  createTask, 
  calculateProjectSummary, 
  formatDuration, 
  getTimeUnitOptions,
  convertFromHours,
  validateEstimate,
  exportToCSV,
  exportToMarkdown,
  exportToJSON,
  downloadFile,
  importFromCSV,
  importFromJSON,
  generateFileName,
  saveProject,
  updateProject,
  getSavedProjects,
  deleteProject,
  loadProject,
  duplicateProject,
} from './pert-estimator.service';
import { translate } from '@/plugins/i18n.plugin';

const tasks = ref<Task[]>([]);
const projectName = ref('');

// Project management
const savedProjects = ref<SavedProject[]>(getSavedProjects());
const currentProjectId = ref<string>('');
const newProjectName = ref('');

// Modal states
const showRenameModal = ref(false);
const renameProjectId = ref('');
const renameProjectName = ref('');

const newTaskName = ref('');
const optimisticValue = ref<number>();
const optimisticUnit = ref<TimeUnit>('hours');
const nominalValue = ref<number>();
const nominalUnit = ref<TimeUnit>('hours');
const pessimisticValue = ref<number>();
const pessimisticUnit = ref<TimeUnit>('hours');

const projectSummary = computed<ProjectSummary>(() => 
  calculateProjectSummary(tasks.value)
);

const timeUnitOptions = getTimeUnitOptions();

const isValidForm = computed(() => {
  if (!optimisticValue.value || !nominalValue.value || !pessimisticValue.value) {
    return false;
  }

  const estimate: TaskEstimate = {
    optimistic: { value: optimisticValue.value, unit: optimisticUnit.value },
    nominal: { value: nominalValue.value, unit: nominalUnit.value },
    pessimistic: { value: pessimisticValue.value, unit: pessimisticUnit.value },
  };

  return validateEstimate(estimate);
});

function addTask() {
  if (!isValidForm.value) return;

  const estimate: TaskEstimate = {
    optimistic: { value: optimisticValue.value!, unit: optimisticUnit.value },
    nominal: { value: nominalValue.value!, unit: nominalUnit.value },
    pessimistic: { value: pessimisticValue.value!, unit: pessimisticUnit.value },
  };

  const task = createTask(newTaskName.value || undefined, estimate);
  tasks.value.push(task);

  // Reset form
  newTaskName.value = '';
  optimisticValue.value = undefined;
  nominalValue.value = undefined;
  pessimisticValue.value = undefined;
}

function removeTask(taskId: string) {
  tasks.value = tasks.value.filter(task => task.id !== taskId);
}

function clearAllTasks() {
  tasks.value = [];
}

function getTaskDisplayName(task: Task, index: number): string {
  return task.name || `Task ${index + 1}`;
}

// Import/Export state
const importError = ref('');
const importSuccess = ref(false);

// Import functions
async function handleImportFile(options: { file: { file?: File } }) {
  const file = options.file.file;
  if (!file) return;

  importError.value = '';
  importSuccess.value = false;

  try {
    const content = await file.text();
    const extension = file.name.toLowerCase().split('.').pop();
    
    let result;
    if (extension === 'csv') {
      result = importFromCSV(content);
    } else if (extension === 'json') {
      result = importFromJSON(content);
    } else {
      importError.value = translate('tools.pert-estimator.invalidFormat');
      return;
    }

    if (!result.isValid) {
      importError.value = result.errors.join('; ');
      return;
    }

    // Import project name if available
    if (result.projectName) {
      projectName.value = result.projectName;
    }

    // Ask user if they want to replace or append
    if (tasks.value.length > 0) {
      const replace = confirm('Replace existing tasks or add to current tasks? (OK = Replace, Cancel = Add)');
      if (replace) {
        tasks.value = result.tasks;
      } else {
        tasks.value.push(...result.tasks);
      }
    } else {
      tasks.value = result.tasks;
    }

    importSuccess.value = true;
    setTimeout(() => importSuccess.value = false, 3000);

  } catch (error) {
    importError.value = `Import failed: ${error}`;
  }
}

// Export functions  
function exportToCSVFile() {
  const csv = exportToCSV(tasks.value, projectName.value || undefined);
  const filename = generateFileName(projectName.value, 'csv');
  downloadFile(csv, filename, 'text/csv');
}

async function copyMarkdownTable() {
  const markdown = exportToMarkdown(tasks.value, projectSummary.value, projectName.value || undefined);
  try {
    await navigator.clipboard.writeText(markdown);
    // Could show success message here
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
  }
}

function exportToJSONFile() {
  const json = exportToJSON(tasks.value, projectSummary.value, projectName.value || undefined);
  const filename = generateFileName(projectName.value, 'json');
  downloadFile(json, filename, 'application/json');
}

// Project management functions
function saveCurrentProject() {
  if (!newProjectName.value.trim()) return;
  
  const project = saveProject(newProjectName.value.trim(), tasks.value);
  savedProjects.value = getSavedProjects();
  currentProjectId.value = project.id;
  projectName.value = project.name;
  newProjectName.value = '';
}

function loadSavedProject(projectId: string) {
  const project = loadProject(projectId);
  if (!project) return;
  
  tasks.value = JSON.parse(JSON.stringify(project.tasks)); // Deep copy
  projectName.value = project.name;
  currentProjectId.value = project.id;
}

function updateCurrentProject() {
  if (!currentProjectId.value || !projectName.value) return;
  
  updateProject(currentProjectId.value, projectName.value, tasks.value);
  savedProjects.value = getSavedProjects();
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getProjectActions(project: SavedProject) {
  return [
    {
      label: translate('tools.pert-estimator.rename'),
      key: 'rename',
      props: { 'data-project-id': project.id }
    },
    {
      label: translate('tools.pert-estimator.exportProject'),
      key: 'export',
      props: { 'data-project-id': project.id }
    },
    {
      label: translate('tools.pert-estimator.duplicate'),
      key: 'duplicate',
      props: { 'data-project-id': project.id }
    },
    {
      type: 'divider',
      key: 'divider'
    },
    {
      label: translate('tools.pert-estimator.delete'),
      key: 'delete',
      props: { 'data-project-id': project.id }
    }
  ];
}

function handleProjectAction(key: string, option: any) {
  const projectId = option.props['data-project-id'];
  
  if (key === 'rename') {
    const project = loadProject(projectId);
    if (project) {
      renameProjectId.value = projectId;
      renameProjectName.value = project.name;
      showRenameModal.value = true;
    }
  } else if (key === 'export') {
    exportSelectedProject(projectId);
  } else if (key === 'duplicate') {
    const newProject = duplicateProject(projectId);
    if (newProject) {
      savedProjects.value = getSavedProjects();
    }
  } else if (key === 'delete') {
    if (confirm(translate('tools.pert-estimator.confirmDelete'))) {
      deleteProject(projectId);
      savedProjects.value = getSavedProjects();
      if (currentProjectId.value === projectId) {
        currentProjectId.value = '';
        projectName.value = '';
        tasks.value = [];
      }
    }
  }
}

function confirmRename() {
  if (!renameProjectName.value.trim()) return;
  
  const project = loadProject(renameProjectId.value);
  if (!project) return;
  
  updateProject(renameProjectId.value, renameProjectName.value.trim(), project.tasks);
  savedProjects.value = getSavedProjects();
  
  // Update current project name if it's the active project
  if (currentProjectId.value === renameProjectId.value) {
    projectName.value = renameProjectName.value.trim();
  }
  
  showRenameModal.value = false;
  renameProjectId.value = '';
  renameProjectName.value = '';
}

function cancelRename() {
  showRenameModal.value = false;
  renameProjectId.value = '';
  renameProjectName.value = '';
}

function exportSelectedProject(projectId: string) {
  const project = loadProject(projectId);
  if (!project) return;
  
  const projectSummary = calculateProjectSummary(project.tasks);
  const json = exportToJSON(project.tasks, projectSummary, project.name);
  const filename = generateFileName(project.name, 'json');
  downloadFile(json, filename, 'application/json');
}

// Project import state
const projectImportError = ref('');
const projectImportSuccess = ref(false);

async function handleProjectImportFile(options: { file: { file?: File } }) {
  const file = options.file.file;
  if (!file) return;

  projectImportError.value = '';
  projectImportSuccess.value = false;

  try {
    const content = await file.text();
    const extension = file.name.toLowerCase().split('.').pop();
    
    if (extension !== 'json') {
      projectImportError.value = translate('tools.pert-estimator.onlyJsonSupported');
      return;
    }

    const result = importFromJSON(content);

    if (!result.isValid) {
      projectImportError.value = result.errors.join('; ');
      return;
    }

    // Create new project from imported data
    const projectName = result.projectName || 'Imported Project';
    const newProject = saveProject(projectName, result.tasks);
    savedProjects.value = getSavedProjects();
    
    // Load the imported project
    loadSavedProject(newProject.id);
    
    projectImportSuccess.value = true;
    setTimeout(() => projectImportSuccess.value = false, 3000);

  } catch (error) {
    projectImportError.value = `Import failed: ${error}`;
  }
}

// Watch for changes to auto-save current project
watch([tasks, projectName], () => {
  if (currentProjectId.value && projectName.value) {
    updateCurrentProject();
  }
}, { deep: true });
</script>

<style scoped>
.project-item {
  transition: all 0.2s ease;
}

.project-item:hover {
  background-color: var(--n-color-hover);
}

.project-item.active {
  background-color: var(--n-color-pressed);
  border-color: var(--n-color-primary);
}
</style>

<template>
  <div style="flex: 0 0 100%">
    <div style="display: flex; gap: 20px; max-width: 1200px; margin: 0 auto;">
      <!-- Projects Sidebar -->
      <div style="width: 300px; flex-shrink: 0;">
        <c-card>
          <h3 mb-3>{{ translate('tools.pert-estimator.savedProjects') }}</h3>
          
          <!-- New Project Input -->
          <div mb-4>
            <n-input-group>
              <n-input 
                v-model:value="newProjectName"
                :placeholder="translate('tools.pert-estimator.newProjectName')"
                @keyup.enter="saveCurrentProject"
              />
              <n-button 
                type="primary" 
                @click="saveCurrentProject"
                :disabled="!newProjectName.trim()"
              >
                {{ translate('tools.pert-estimator.save') }}
              </n-button>
            </n-input-group>
          </div>

          <!-- Projects List -->
          <div v-if="savedProjects.length === 0" text-center py-4 text-sm opacity-70>
            {{ translate('tools.pert-estimator.noSavedProjects') }}
          </div>
          
          <div v-else>
            <div 
              v-for="project in savedProjects" 
              :key="project.id"
              class="project-item"
              :class="{ active: currentProjectId === project.id }"
              mb-2 p-2 border rounded cursor-pointer
              @click="loadSavedProject(project.id)"
            >
              <div flex justify-between items-center>
                <div flex-1>
                  <div font-medium>{{ project.name }}</div>
                  <div text-sm opacity-70>
                    {{ project.tasks.length }} tasks
                  </div>
                  <div text-xs opacity-50>
                    {{ formatDate(project.updatedAt) }}
                  </div>
                </div>
                
                <n-dropdown :options="getProjectActions(project)" @select="handleProjectAction">
                  <n-button size="small" tertiary circle>
                    <template #icon>
                      <n-icon>⋮</n-icon>
                    </template>
                  </n-button>
                </n-dropdown>
              </div>
            </div>
          </div>
          
          <!-- Project Import Section -->
          <div mt-4 pt-4 border-t>
            <h4 mb-3 text-sm font-medium opacity-70>{{ translate('tools.pert-estimator.importProject') }}</h4>
            <n-upload
              :file-list="[]"
              @change="handleProjectImportFile"
              accept=".json"
              :show-file-list="false"
            >
              <n-button size="small" block>
                {{ translate('tools.pert-estimator.chooseProjectFile') }}
              </n-button>
            </n-upload>
            <div mt-2 text-xs opacity-50>
              {{ translate('tools.pert-estimator.onlyJsonSupported') }}
            </div>
            <n-alert v-if="projectImportError" type="error" size="small" mt-2 closable @close="projectImportError = ''">
              {{ projectImportError }}
            </n-alert>
            <n-alert v-if="projectImportSuccess" type="success" size="small" mt-2 closable @close="projectImportSuccess = false">
              {{ translate('tools.pert-estimator.projectImportSuccess') }}
            </n-alert>
          </div>
        </c-card>
      </div>

      <!-- Main Content -->
      <div style="flex: 1; min-width: 0;">
      <!-- Task Input Form -->
      <c-card mb-4>
        <div mb-4>
          <h3 mb-3>{{ translate('tools.pert-estimator.addTask') }}</h3>
          
          <n-form-item :label="translate('tools.pert-estimator.taskName')" label-placement="left" mb-3>
            <n-input 
              v-model:value="newTaskName" 
              :placeholder="translate('tools.pert-estimator.taskNamePlaceholder')"
            />
          </n-form-item>

          <n-form-item :label="translate('tools.pert-estimator.optimisticEstimate')" label-placement="left" mb-3>
            <div flex gap-2 w-full>
              <n-input-number 
                v-model:value="optimisticValue" 
                :placeholder="translate('tools.pert-estimator.value')"
                style="flex: 1"
                :min="0.01"
                :precision="2"
              />
              <c-select 
                v-model:value="optimisticUnit"
                :options="timeUnitOptions"
                style="width: 120px"
              />
            </div>
          </n-form-item>

          <n-form-item :label="translate('tools.pert-estimator.nominalEstimate')" label-placement="left" mb-3>
            <div flex gap-2 w-full>
              <n-input-number 
                v-model:value="nominalValue" 
                :placeholder="translate('tools.pert-estimator.value')"
                style="flex: 1"
                :min="0.01"
                :precision="2"
              />
              <c-select 
                v-model:value="nominalUnit"
                :options="timeUnitOptions"
                style="width: 120px"
              />
            </div>
          </n-form-item>

          <n-form-item :label="translate('tools.pert-estimator.pessimisticEstimate')" label-placement="left" mb-3>
            <div flex gap-2 w-full>
              <n-input-number 
                v-model:value="pessimisticValue" 
                :placeholder="translate('tools.pert-estimator.value')"
                style="flex: 1"
                :min="0.01"
                :precision="2"
              />
              <c-select 
                v-model:value="pessimisticUnit"
                :options="timeUnitOptions"
                style="width: 120px"
              />
            </div>
          </n-form-item>

          <n-button 
            type="primary" 
            :disabled="!isValidForm"
            @click="addTask"
            block
          >
            {{ translate('tools.pert-estimator.addTask') }}
          </n-button>
        </div>
      </c-card>

      <!-- Tasks List -->
      <c-card v-if="tasks.length > 0" mb-4>
        <div mb-4 flex justify-between items-center>
          <h3>{{ translate('tools.pert-estimator.tasks') }}</h3>
          <n-button size="small" @click="clearAllTasks">
            {{ translate('tools.pert-estimator.clearAll') }}
          </n-button>
        </div>

        <n-table striped>
          <thead>
            <tr>
              <th>{{ translate('tools.pert-estimator.taskName') }}</th>
              <th>{{ translate('tools.pert-estimator.optimistic') }}</th>
              <th>{{ translate('tools.pert-estimator.nominal') }}</th>
              <th>{{ translate('tools.pert-estimator.pessimistic') }}</th>
              <th>{{ translate('tools.pert-estimator.expected') }}</th>
              <th>{{ translate('tools.pert-estimator.standardDeviation') }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(task, index) in tasks" :key="task.id">
              <td>{{ getTaskDisplayName(task, index) }}</td>
              <td>{{ task.estimate.optimistic.value }} {{ task.estimate.optimistic.unit }}</td>
              <td>{{ task.estimate.nominal.value }} {{ task.estimate.nominal.unit }}</td>
              <td>{{ task.estimate.pessimistic.value }} {{ task.estimate.pessimistic.unit }}</td>
              <td>{{ formatDuration(task.expectedDuration, 'hours') }}</td>
              <td>{{ formatDuration(task.standardDeviation, 'hours') }}</td>
              <td>
                <n-button 
                  size="small" 
                  type="error" 
                  @click="removeTask(task.id)"
                >
                  {{ translate('tools.pert-estimator.remove') }}
                </n-button>
              </td>
            </tr>
          </tbody>
        </n-table>
      </c-card>

      <!-- Project Summary -->
      <c-card v-if="tasks.length > 0">
        <h3 mb-4>{{ translate('tools.pert-estimator.projectSummary') }}</h3>
        
        <!-- Project Name -->
        <n-form-item :label="translate('tools.pert-estimator.projectName')" label-placement="left" mb-4>
          <n-input 
            v-model:value="projectName" 
            :placeholder="translate('tools.pert-estimator.projectNamePlaceholder')"
          />
        </n-form-item>
        
        <!-- Export Buttons -->
        <div mb-4 flex gap-2 flex-wrap>
          <n-button size="small" @click="exportToCSVFile">
            {{ translate('tools.pert-estimator.exportCSV') }}
          </n-button>
          <n-button size="small" @click="copyMarkdownTable">
            {{ translate('tools.pert-estimator.copyMarkdown') }}
          </n-button>
          <n-button size="small" @click="exportToJSONFile">
            {{ translate('tools.pert-estimator.exportJSON') }}
          </n-button>
        </div>
        
        <div grid grid-cols-1 md:grid-cols-3 gap-4>
          <div>
            <label>{{ translate('tools.pert-estimator.totalExpectedDuration') }}</label>
            <input-copyable 
              :value="formatDuration(projectSummary.totalExpectedDuration, 'hours')"
              readonly
            />
          </div>
          
          <div>
            <label>{{ translate('tools.pert-estimator.totalStandardDeviation') }}</label>
            <input-copyable 
              :value="formatDuration(projectSummary.totalStandardDeviation, 'hours')"
              readonly
            />
          </div>
          
          <div>
            <label>{{ translate('tools.pert-estimator.totalVariance') }}</label>
            <input-copyable 
              :value="projectSummary.totalVariance.toFixed(4)"
              readonly
            />
          </div>
        </div>

        <!-- Different time units display -->
        <div mt-6>
          <h4 mb-3>{{ translate('tools.pert-estimator.convertedResults') }}</h4>
          <div grid grid-cols-2 md:grid-cols-4 gap-4>
            <div v-for="unit in timeUnitOptions" :key="unit.value">
              <label>{{ translate('tools.pert-estimator.expectedDurationIn') }} {{ unit.label.toLowerCase() }}</label>
              <input-copyable 
                :value="convertFromHours(projectSummary.totalExpectedDuration, unit.value).toFixed(2)"
                readonly
              />
            </div>
          </div>
        </div>
      </c-card>

      <!-- Import Section -->
      <c-card mb-4>
        <h3 mb-3>{{ translate('tools.pert-estimator.importData') }}</h3>
        <n-upload
          :file-list="[]"
          @change="handleImportFile"
          accept=".csv,.json"
          :show-file-list="false"
        >
          <n-button>{{ translate('tools.pert-estimator.chooseFile') }}</n-button>
        </n-upload>
        <div mt-2 text-sm opacity-70>
          {{ translate('tools.pert-estimator.supportedFormats') }}
        </div>
        <n-alert v-if="importError" type="error" mt-3 closable @close="importError = ''">
          {{ importError }}
        </n-alert>
        <n-alert v-if="importSuccess" type="success" mt-3 closable @close="importSuccess = false">
          {{ translate('tools.pert-estimator.importSuccess') }}
        </n-alert>
      </c-card>

      <!-- Info Card -->
      <c-card mt-4 v-if="tasks.length === 0">
        <div text-center py-8>
          <h3 mb-4>{{ translate('tools.pert-estimator.title') }}</h3>
          <p mb-4>{{ translate('tools.pert-estimator.description') }}</p>
          <p text-sm opacity-70>{{ translate('tools.pert-estimator.instructions') }}</p>
        </div>
      </c-card>
      </div>
    </div>
    
    <!-- Rename Project Modal -->
    <n-modal v-model:show="showRenameModal" preset="dialog" :title="translate('tools.pert-estimator.renameProject')">
      <n-input 
        v-model:value="renameProjectName"
        :placeholder="translate('tools.pert-estimator.newProjectName')"
        @keyup.enter="confirmRename"
      />
      
      <template #action>
        <n-space>
          <n-button @click="cancelRename">
            {{ translate('tools.pert-estimator.cancel') }}
          </n-button>
          <n-button 
            type="primary" 
            @click="confirmRename"
            :disabled="!renameProjectName.trim()"
          >
            {{ translate('tools.pert-estimator.rename') }}
          </n-button>
        </n-space>
      </template>
    </n-modal>
  </div>
</template>