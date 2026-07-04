import type { RsvpStatus } from '../types';
import { API_BASE } from './apiBase';

export async function fetchRehearsalRsvp(
  rehearsalId: string
): Promise<Record<string, RsvpStatus>> {
  const response = await fetch(`${API_BASE}/rehearsals/${encodeURIComponent(rehearsalId)}/rsvp`, {
    credentials: 'include',
  });
  if (!response.ok) throw new Error(`REHEARSAL_RSVP_${response.status}`);
  const data = (await response.json()) as { rsvp: Record<string, RsvpStatus> };
  return data.rsvp;
}
