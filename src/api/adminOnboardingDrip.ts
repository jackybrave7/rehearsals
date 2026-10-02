import { API_BASE } from './apiBase';

export interface OnboardingDripSettings {
  enabled: boolean;
  includeLegacyUsers: boolean;
  launchedAt: string | null;
}

export type DripConditionType = 'checklist_pending' | 'checklist_done' | 'always';

export interface EmailDripStepDto {
  id: string;
  sortOrder: number;
  enabled: boolean;
  title: string;
  conditionType: DripConditionType;
  conditionChecklistStep: string | null;
  delayDays: number;
  delayHours: number;
  delayMinutes: number;
  subject: string;
  bodyText: string;
  bodyHtml: string | null;
  bodyFormat: 'plain' | 'html';
  actionLabel: string;
  actionPath: string;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface DripStepEngagementStats {
  stepId: string;
  title: string;
  deliveries: number;
  opens: number;
  clicks: number;
  openRate: number;
  clickRate: number;
}

export interface DripChainEngagementStats {
  totalDeliveries: number;
  totalOpens: number;
  totalClicks: number;
  uniqueOpens: number;
  uniqueClicks: number;
  steps: DripStepEngagementStats[];
}

export interface OnboardingDripOverview {
  settings: OnboardingDripSettings;
  mailConfigured: boolean;
  steps: EmailDripStepDto[];
  meta: {
    checklistSteps: Array<{ id: string; label: string }>;
    conditionTypes: Array<{ value: string; label: string }>;
    actionPaths: Array<{ value: string; label: string }>;
  };
  stats: { totalSent: number };
  engagement: DripChainEngagementStats;
}

export type EmailDripStepInput = Partial<
  Omit<EmailDripStepDto, 'id' | 'sentCount' | 'createdAt' | 'updatedAt'>
> &
  Pick<EmailDripStepDto, 'title' | 'subject' | 'bodyText'>;

async function adminFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: 'include', ...init });
}

export async function fetchAdminOnboardingDrip(): Promise<OnboardingDripOverview> {
  const response = await adminFetch('/admin/onboarding-drip');
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<OnboardingDripOverview>;
}

export async function updateAdminOnboardingDripSettings(
  patch: Partial<Pick<OnboardingDripSettings, 'enabled' | 'includeLegacyUsers'>>
): Promise<{ settings: OnboardingDripSettings }> {
  const response = await adminFetch('/admin/onboarding-drip', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ settings: OnboardingDripSettings }>;
}

export async function createAdminDripStep(
  body: EmailDripStepInput
): Promise<{ step: EmailDripStepDto }> {
  const response = await adminFetch('/admin/onboarding-drip/steps', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ step: EmailDripStepDto }>;
}

export async function updateAdminDripStep(
  id: string,
  body: Partial<EmailDripStepInput>
): Promise<{ step: EmailDripStepDto }> {
  const response = await adminFetch(`/admin/onboarding-drip/steps/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ step: EmailDripStepDto }>;
}

export async function deleteAdminDripStep(id: string): Promise<void> {
  const response = await adminFetch(`/admin/onboarding-drip/steps/${id}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await response.text());
}

export async function duplicateAdminDripStep(id: string): Promise<{ step: EmailDripStepDto }> {
  const response = await adminFetch(`/admin/onboarding-drip/steps/${id}/duplicate`, {
    method: 'POST',
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<{ step: EmailDripStepDto }>;
}

export async function sendAdminDripTestEmail(
  body: EmailDripStepInput & { stepId?: string }
): Promise<{ ok: true; sentTo: string }> {
  const response = await adminFetch('/admin/onboarding-drip/test-send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { error?: string } | null;
    if (data?.error === 'MAIL_NOT_CONFIGURED') throw new Error('MAIL_NOT_CONFIGURED');
    if (data?.error === 'MISSING_FIELDS') throw new Error('MISSING_FIELDS');
    if (data?.error === 'SEND_FAILED') throw new Error('SEND_FAILED');
    throw new Error(await response.text());
  }
  return response.json() as Promise<{ ok: true; sentTo: string }>;
}
