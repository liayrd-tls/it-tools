import { Calculator } from '@vicons/tabler';
import { defineTool } from '../tool';
import { translate } from '@/plugins/i18n.plugin';

export const tool = defineTool({
  name: translate('tools.pert-estimator.title'),
  path: '/pert-estimator',
  description: translate('tools.pert-estimator.description'),
  keywords: [
    'pert',
    'estimation',
    'project',
    'management',
    'tasks',
    'duration',
    'planning',
    'schedule',
    'timeline',
    'calculator',
    'optimistic',
    'pessimistic',
    'nominal',
    'expected',
  ],
  component: () => import('./pert-estimator.vue'),
  icon: Calculator,
  createdAt: new Date('2024-08-10'),
});