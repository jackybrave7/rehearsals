import type { AuthSessionPayload, TheaterAccessRole, TheaterMember } from '../types/auth';
import { API_BASE } from './apiBase';

async function authFetch(path: string, init?: RequestInit): Promise<Response> {
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

export async function fetchAuthSession(): Promise<AuthSessionPayload | null> {
  const response = await authFetch('/auth/me');
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`AUTH_ME_${response.status}`);
  return response.json() as Promise<AuthSessionPayload>;
}

export async function loginWithEmail(email: string, password: string): Promise<AuthSessionPayload> {
  const response = await authFetch('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) throw new Error(await parseAuthError(response));
  return response.json() as Promise<AuthSessionPayload>;
}

export async function registerWithEmail(
  email: string,
  password: string,
  name: string
): Promise<AuthSessionPayload> {
  const response = await authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name }),
  });
  if (!response.ok) throw new Error(await parseAuthError(response));
  return response.json() as Promise<AuthSessionPayload>;
}

export async function loginWithGoogle(credential: string): Promise<AuthSessionPayload> {
  const response = await authFetch('/auth/google', {
    method: 'POST',
    body: JSON.stringify({ credential }),
  });
  if (!response.ok) throw new Error(await parseAuthError(response));
  return response.json() as Promise<AuthSessionPayload>;
}

export async function logout(): Promise<void> {
  await authFetch('/auth/logout', { method: 'POST' });
}

export async function fetchTheaterMembers(theaterId: string): Promise<TheaterMember[]> {
  const response = await authFetch(`/theaters/${encodeURIComponent(theaterId)}/members`);
  if (!response.ok) throw new Error(`MEMBERS_${response.status}`);
  const data = (await response.json()) as { members?: TheaterMember[] };
  return data.members ?? [];
}

export async function addTheaterMember(
  theaterId: string,
  email: string,
  role: Exclude<TheaterAccessRole, 'owner'>
): Promise<void> {
  const response = await authFetch(`/theaters/${encodeURIComponent(theaterId)}/members`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
  if (!response.ok) throw new Error(await parseAuthError(response));
}

export async function removeTheaterMember(theaterId: string, userId: string): Promise<void> {
  const response = await authFetch(
    `/theaters/${encodeURIComponent(theaterId)}/members/${encodeURIComponent(userId)}`,
    { method: 'DELETE' }
  );
  if (!response.ok) throw new Error(await parseAuthError(response));
}

async function parseAuthError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { error?: string };
    if (data.error === 'INVALID_CREDENTIALS') return 'Неверный email или пароль';
    if (data.error === 'EMAIL_EXISTS') return 'Пользователь с таким email уже зарегистрирован';
    if (data.error === 'USER_NOT_FOUND') {
      return 'Пользователь не найден. Попросите его зарегистрироваться на rehears.ru/login';
    }
    if (data.error === 'INVALID_GOOGLE_TOKEN') return 'Не удалось войти через Google';
    if (data.error) return data.error;
  } catch {
    // ignore JSON parse errors
  }

  if (response.status === 404) {
    return 'Сервис авторизации недоступен. Перезапустите API (restart.bat) — возможно, порт 3001 занят другим приложением.';
  }

  return `AUTH_${response.status}`;
}
