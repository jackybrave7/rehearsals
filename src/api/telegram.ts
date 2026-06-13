import { API_BASE } from './apiBase';

export async function fetchTelegramConfigured(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/telegram/config`);
    if (!response.ok) return false;
    const data = (await response.json()) as { configured?: boolean };
    return Boolean(data.configured);
  } catch {
    return false;
  }
}

export async function sendTelegramHtmlMessage(html: string): Promise<void> {
  const response = await fetch(`${API_BASE}/telegram/send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ html }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message ?? `SEND_FAILED_${response.status}`);
  }
}
