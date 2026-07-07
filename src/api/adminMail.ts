import { API_BASE } from './apiBase';

export interface MailDnsCheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

export interface MailDeliverabilityReport {
  domain: string;
  mailConfigured: boolean;
  fromAddress: string | null;
  checks: MailDnsCheckItem[];
  readyForMailRu: boolean;
  mailRuVerificationUrl: string;
  postmasterUrl: string;
}

async function adminFetch(path: string): Promise<Response> {
  return fetch(`${API_BASE}${path}`, { credentials: 'include' });
}

export async function fetchMailDeliverability(): Promise<MailDeliverabilityReport> {
  const response = await adminFetch('/admin/mail/deliverability');
  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) throw new Error(`MAIL_DNS_${response.status}`);
  return response.json() as Promise<MailDeliverabilityReport>;
}
