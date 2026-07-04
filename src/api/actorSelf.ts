import type { ActorUnavailability, MemorizationStatus, RehearsalActorNote, RsvpStatus } from '../types';
import type { TheaterAccessRole } from '../types/auth';
import { API_BASE } from './apiBase';

async function actorFetch(path: string, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
}

export interface ActorSelfProfile {
  theaterId: string;
  role: TheaterAccessRole | null;
  linked: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    photoUrl: string | null;
    notes: string | null;
    status: string;
    unavailability: ActorUnavailability[];
    memorizationByScene?: Record<string, MemorizationStatus>;
  } | null;
}

export async function fetchActorSelf(theaterId?: string): Promise<ActorSelfProfile> {
  const query = theaterId ? `?theaterId=${encodeURIComponent(theaterId)}` : '';
  const response = await actorFetch(`/actor/me${query}`);
  if (!response.ok) throw new Error(`ACTOR_ME_${response.status}`);
  return response.json() as Promise<ActorSelfProfile>;
}

export async function patchActorAvailability(
  theaterId: string,
  unavailability: ActorUnavailability[]
): Promise<ActorUnavailability[]> {
  const response = await actorFetch('/actor/me/availability', {
    method: 'PATCH',
    body: JSON.stringify({ theaterId, unavailability }),
  });
  if (!response.ok) throw new Error(`ACTOR_AVAILABILITY_${response.status}`);
  const data = (await response.json()) as { unavailability: ActorUnavailability[] };
  return data.unavailability;
}

export async function patchActorProfile(
  theaterId: string,
  payload: {
    name?: string;
    photoUrl?: string | null;
    notes?: string;
  }
): Promise<NonNullable<ActorSelfProfile['linked']>> {
  const response = await actorFetch('/actor/me/profile', {
    method: 'PATCH',
    body: JSON.stringify({ theaterId, ...payload }),
  });
  if (!response.ok) throw new Error(`ACTOR_PROFILE_${response.status}`);
  const data = (await response.json()) as { linked: NonNullable<ActorSelfProfile['linked']> };
  return data.linked;
}

export async function patchActorMemorization(
  theaterId: string,
  sceneId: string,
  status: MemorizationStatus
): Promise<Record<string, MemorizationStatus>> {
  const response = await actorFetch('/actor/me/memorization', {
    method: 'PATCH',
    body: JSON.stringify({ theaterId, sceneId, status }),
  });
  if (!response.ok) throw new Error(`ACTOR_MEMORIZATION_${response.status}`);
  const data = (await response.json()) as { memorizationByScene: Record<string, MemorizationStatus> };
  return data.memorizationByScene;
}

export async function patchActorRsvp(
  rehearsalId: string,
  status: RsvpStatus | null
): Promise<Record<string, RsvpStatus>> {
  const response = await actorFetch('/actor/me/rsvp', {
    method: 'PATCH',
    body: JSON.stringify({ rehearsalId, status }),
  });
  if (!response.ok) throw new Error(`ACTOR_RSVP_${response.status}`);
  const data = (await response.json()) as { rsvp: Record<string, RsvpStatus> };
  return data.rsvp;
}

export async function fetchActorRehearsalsRsvp(
  theaterId: string
): Promise<Array<{ rehearsalId: string; rsvp: Record<string, RsvpStatus> }>> {
  const response = await actorFetch(
    `/actor/me/rehearsals-rsvp?theaterId=${encodeURIComponent(theaterId)}`
  );
  if (!response.ok) throw new Error(`ACTOR_REHEARSALS_RSVP_${response.status}`);
  const data = (await response.json()) as {
    rehearsals: Array<{ rehearsalId: string; rsvp: Record<string, RsvpStatus> }>;
  };
  return data.rehearsals;
}

export async function fetchActorNotes(theaterId: string): Promise<RehearsalActorNote[]> {
  const response = await actorFetch(`/actor/me/notes?theaterId=${encodeURIComponent(theaterId)}`);
  if (!response.ok) throw new Error(`ACTOR_NOTES_${response.status}`);
  const data = (await response.json()) as { notes: RehearsalActorNote[] };
  return data.notes;
}

export async function acknowledgeActorNote(
  theaterId: string,
  noteId: string
): Promise<RehearsalActorNote> {
  const response = await actorFetch(`/actor/me/notes/${encodeURIComponent(noteId)}/acknowledge`, {
    method: 'PATCH',
    body: JSON.stringify({ theaterId }),
  });
  if (!response.ok) throw new Error(`ACTOR_NOTE_ACK_${response.status}`);
  const data = (await response.json()) as { note: RehearsalActorNote };
  return data.note;
}
