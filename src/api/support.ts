import type { SupportTicket } from '../types/support';
import { API_BASE } from './apiBase';

export async function createSupportTicket(input: {
  category: string;
  subject?: string;
  message: string;
}): Promise<{ ticket: SupportTicket; mailSent: boolean }> {
  const response = await fetch(`${API_BASE}/support/tickets`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (response.status === 401) throw new Error('UNAUTHORIZED');
  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'INVALID_REQUEST');
  }
  if (!response.ok) throw new Error(`SUPPORT_TICKET_${response.status}`);

  return response.json() as Promise<{ ticket: SupportTicket; mailSent: boolean }>;
}
