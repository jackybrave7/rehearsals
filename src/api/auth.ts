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

export async function fetchAuthConfig(): Promise<{
  mailConfigured: boolean;
  registrationMode: 'normal' | 'beta';
}> {
  try {
    const response = await authFetch('/auth/config');
    if (!response.ok) return { mailConfigured: false, registrationMode: 'normal' };
    return response.json() as Promise<{
      mailConfigured: boolean;
      registrationMode: 'normal' | 'beta';
    }>;
  } catch {
    return { mailConfigured: false, registrationMode: 'normal' };
  }
}

export async function updateAuthProfile(payload: {
  name?: string;
  currentPassword?: string;
  newPassword?: string;
}): Promise<AuthSessionPayload> {
  const response = await authFetch('/auth/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(await parseAuthError(response));
  return response.json() as Promise<AuthSessionPayload>;
}

export async function requestPasswordReset(email: string): Promise<string> {
  const response = await authFetch('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  const data = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
  } | null;
    if (!response.ok) throw new Error(await parseAuthError(response, data?.error, data));
  return data?.message ?? 'Если аккаунт с таким email зарегистрирован, на почту отправлен одноразовый пароль.';
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
  name: string,
  acceptTerms: boolean
): Promise<{ needsEmailVerification: true; message: string; registrationMode?: 'normal' | 'beta' }> {
  const response = await authFetch('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, name, acceptTerms }),
  });
  if (!response.ok) throw new Error(await parseAuthError(response));
  const data = (await response.json()) as { message?: string; registrationMode?: 'normal' | 'beta' };
  return {
    needsEmailVerification: true,
    registrationMode: data.registrationMode,
    message:
      data.message ??
      'На ваш email отправлена ссылка для подтверждения. Перейдите по ней, затем войдите в аккаунт.',
  };
}

export async function verifyEmail(
  token: string
): Promise<{ betaPendingApproval?: boolean }> {
  const response = await authFetch('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  if (!response.ok) throw new Error(await parseAuthError(response));
  return (await response.json()) as { betaPendingApproval?: boolean };
}

export async function resendEmailVerification(email: string): Promise<string> {
  const response = await authFetch('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
  const data = (await response.json().catch(() => null)) as {
    message?: string;
    error?: string;
  } | null;
  if (!response.ok) throw new Error(await parseAuthError(response, data?.error, data));
  return (
    data?.message ??
    'Если аккаунт с таким email зарегистрирован и не подтверждён, на почту отправлена новая ссылка.'
  );
}

export async function logout(): Promise<void> {
  await authFetch('/auth/logout', { method: 'POST' });
}

export async function deleteAuthAccount(password?: string): Promise<void> {
  const response = await authFetch('/auth/delete-account', {
    method: 'POST',
    body: JSON.stringify(password ? { password } : {}),
  });
  if (!response.ok) throw new Error(await parseAuthError(response));
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

async function parseAuthError(
  response: Response,
  errorCode?: string,
  preloaded?: { error?: string; message?: string } | null
): Promise<string> {
  try {
    const data = preloaded ?? ((await response.json()) as { error?: string; message?: string });
    const code = errorCode ?? data.error;
    if (code === 'INVALID_CREDENTIALS') return 'Неверный email или пароль';
    if (code === 'EMAIL_EXISTS') return 'Пользователь с таким email уже зарегистрирован';
    if (code === 'USER_NOT_FOUND') {
      return 'Пользователь не найден. Попросите его зарегистрироваться на rehears.ru/login';
    }
    if (code === 'WRONG_PASSWORD') return 'Неверный текущий пароль';
    if (code === 'INVALID_PASSWORD') return 'Новый пароль должен быть не короче 8 символов';
    if (code === 'INVALID_NAME') return 'Укажите имя';
    if (code === 'DELETE_ACCOUNT_FAILED') return 'Не удалось удалить аккаунт. Попробуйте позже или напишите в поддержку.';
    if (code === 'MAIL_NOT_CONFIGURED') {
      return 'Почта на сервере не настроена. Обратитесь к администратору (SMTP в .env).';
    }
    if (code === 'MAIL_FAILED') return 'Не удалось отправить письмо. Попробуйте позже.';
    if (code === 'INVALID_EMAIL') return 'Укажите email';
    if (code === 'TERMS_NOT_ACCEPTED') {
      return 'Примите пользовательское соглашение и политику конфиденциальности';
    }
    if (code === 'EMAIL_NOT_VERIFIED') {
      return 'Подтвердите email — проверьте почту или запросите письмо повторно.';
    }
    if (code === 'REGISTRATION_PENDING') {
      return 'Доступ ожидает одобрения администратора. Мы отправим письмо, когда аккаунт будет активирован.';
    }
    if (code === 'TOO_MANY_REQUESTS') {
      return data?.message ?? 'Подождите пару минут перед повторной отправкой.';
    }
    if (code === 'INVALID_TOKEN') return 'Ссылка подтверждения недействительна или устарела.';
    if (code) return code;
    if (data.message) return data.message;
  } catch {
    // ignore JSON parse errors
  }

  if (response.status === 404) {
    return 'Сервис авторизации недоступен. Перезапустите API (restart.bat) — возможно, порт 3001 занят другим приложением.';
  }

  return `AUTH_${response.status}`;
}
