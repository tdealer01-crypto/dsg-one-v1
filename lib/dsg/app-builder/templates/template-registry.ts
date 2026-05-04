export type DsgAppTemplateCategory = 'landing' | 'crud' | 'dashboard' | 'form' | 'workspace';
export type DsgAppTemplateRisk = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type DsgAppTemplate = {
  id: string;
  name: string;
  category: DsgAppTemplateCategory;
  description: string;
  useCases: string[];
  defaultFeatures: string[];
  requiredCapabilities: string[];
  risk: DsgAppTemplateRisk;
  productionNotes: string[];
};

export const DSG_APP_TEMPLATES: DsgAppTemplate[] = [
  {
    id: 'database-crud-app',
    name: 'Database CRUD App',
    category: 'crud',
    description: 'Database-backed app with list and create flows.',
    useCases: ['todo', 'inventory', 'tasks', 'internal tools'],
    defaultFeatures: ['list records', 'create record', 'status tracking', 'server route', 'database table'],
    requiredCapabilities: ['database', 'api_route', 'frontend_page'],
    risk: 'MEDIUM',
    productionNotes: ['Writes require server-side access checks.', 'Rows must be scoped by workspace or user.'],
  },
  {
    id: 'saas-landing-page',
    name: 'SaaS Landing Page',
    category: 'landing',
    description: 'Marketing page with feature blocks, pricing, FAQ, and form submission.',
    useCases: ['landing page', 'waitlist', 'product launch'],
    defaultFeatures: ['hero', 'features', 'pricing', 'faq', 'form submission'],
    requiredCapabilities: ['frontend_page', 'api_route'],
    risk: 'MEDIUM',
    productionNotes: ['Public form submissions require throttling.', 'Public claims require review.'],
  },
  {
    id: 'operator-dashboard',
    name: 'Operator Dashboard',
    category: 'dashboard',
    description: 'Dashboard for metrics, activity, evidence, and operational status.',
    useCases: ['analytics', 'admin dashboard', 'ops console'],
    defaultFeatures: ['metrics cards', 'activity table', 'status filters', 'evidence panel'],
    requiredCapabilities: ['frontend_page', 'database', 'access_control'],
    risk: 'HIGH',
    productionNotes: ['Read-only roles must not mutate data.', 'Actions require permission checks.'],
  },
  {
    id: 'form-workflow-app',
    name: 'Form Workflow App',
    category: 'form',
    description: 'Multi-step form with validation, submission storage, and review status.',
    useCases: ['intake form', 'approval request', 'survey'],
    defaultFeatures: ['multi-step form', 'validation', 'submission status', 'review queue'],
    requiredCapabilities: ['frontend_page', 'api_route', 'database'],
    risk: 'MEDIUM',
    productionNotes: ['Sensitive fields must be classified.', 'Submission endpoint requires throttling.'],
  },
  {
    id: 'workspace-starter',
    name: 'Workspace Starter',
    category: 'workspace',
    description: 'Starter app with protected pages, workspace membership, and roles.',
    useCases: ['saas starter', 'internal app', 'team workspace'],
    defaultFeatures: ['login screen', 'workspace switcher', 'role guard', 'protected area'],
    requiredCapabilities: ['access_control', 'database', 'frontend_page'],
    risk: 'HIGH',
    productionNotes: ['Roles must be verified server-side.', 'Client-supplied role is not trusted.'],
  },
];

export function getDsgAppTemplateById(id: string): DsgAppTemplate | undefined {
  return DSG_APP_TEMPLATES.find((template) => template.id === id);
}

export function getDsgAppTemplatesByCategory(category: DsgAppTemplateCategory): DsgAppTemplate[] {
  return DSG_APP_TEMPLATES.filter((template) => template.category === category);
}

export function getDsgAppTemplatesForUseCase(useCase: string): DsgAppTemplate[] {
  const normalized = useCase.trim().toLowerCase();
  return DSG_APP_TEMPLATES.filter((template) =>
    template.useCases.some((candidate) => candidate.toLowerCase().includes(normalized) || normalized.includes(candidate.toLowerCase())),
  );
}
