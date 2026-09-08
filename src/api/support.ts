import type { SupportTicket } from '../types/support';
import { API_BASE } from './apiBase';

export async function uploadSupportAttachment(input: {
  name: string;
  mimeType: string;
  dataBase64: string;
}): Promise<{ fileId: string; url: string }> {
  const response = await fetch(`${API_BASE}/support/attachments`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (response.status === 401) throw new Error('UNAUTHORIZED');
  if (response.status === 413) throw new Error('FILE_TOO_LARGE');
  if (response.status === 400) {
    const body = (await response.json().catch(() => null)) as { error?: string } | null;
    throw new Error(body?.error ?? 'INVALID_REQUEST');
  }
  if (!response.ok) throw new Error(`SUPPORT_ATTACHMENT_${response.status}`);

  const data = (await response.json()) as { fileId: string; url: string };
  return data;
}

export async function createSupportTicket(input: {
  category: string;
  subject?: string;
  message: string;
  attachmentFileIds?: string[];
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
