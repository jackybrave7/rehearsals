import type { RehearsalActorNote } from '../types';
import { API_BASE } from './apiBase';

export async function distributeRehearsalNotes(
  rehearsalId: string
): Promise<RehearsalActorNote[]> {
  const response = await fetch(`${API_BASE}/rehearsals/${encodeURIComponent(rehearsalId)}/distribute-notes`, {
    method: 'POST',
    credentials: 'include',
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string; message?: string };
    throw new Error(data.message ?? data.error ?? `DISTRIBUTE_NOTES_${response.status}`);
  }
  const data = (await response.json()) as { notes: RehearsalActorNote[] };
  return data.notes;
}
