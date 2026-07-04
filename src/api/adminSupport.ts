import type { SupportTicket, SupportTicketStatus } from '../types/support';
import { API_BASE } from './apiBase';

export async function fetchAdminSupportTickets(options?: {
  status?: SupportTicketStatus;
  limit?: number;
}): Promise<{ tickets: SupportTicket[]; openCount: number }> {
  const params = new URLSearchParams();
  if (options?.status) params.set('status', options.status);
  if (options?.limit) params.set('limit', String(options.limit));

  const query = params.toString();
  const response = await fetch(`${API_BASE}/admin/support/tickets${query ? `?${query}` : ''}`, {
    credentials: 'include',
  });

  if (response.status === 403) throw new Error('FORBIDDEN');
  if (!response.ok) throw new Error(`ADMIN_SUPPORT_${response.status}`);

  return response.json() as Promise<{ tickets: SupportTicket[]; openCount: number }>;
}

export async function updateAdminSupportTicketStatus(
  ticketId: string,
  status: SupportTicketStatus
): Promise<SupportTicket> {
  const response = await fetch(`${API_BASE}/admin/support/tickets/${ticketId}`, {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });

  if (response.status === 403) throw new Error('FORBIDDEN');
  if (response.status === 404) throw new Error('NOT_FOUND');
  if (!response.ok) throw new Error(`ADMIN_SUPPORT_UPDATE_${response.status}`);

  const body = (await response.json()) as { ticket: SupportTicket };
  return body.ticket;
}
