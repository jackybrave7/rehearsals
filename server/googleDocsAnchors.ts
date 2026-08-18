import type { Request, Response } from 'express';
import {
  extractDocTextAnchors,
  extractDocTextAnchorsFromGoogleHtml,
  type DocTextAnchor,
} from '../src/utils/googleDocs.js';
import { fetchGoogleDocumentFromApi, GoogleDocsApiError } from './googleDocs.js';

let cachedServerToken: { token: string; expiresAt: number } | null = null;

export async function getServerGoogleAccessToken(): Promise<string | null> {
  const refreshToken = process.env.GOOGLE_DOCS_REFRESH_TOKEN?.trim();
  const clientId = (process.env.GOOGLE_CLIENT_ID ?? process.env.VITE_GOOGLE_CLIENT_ID)?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!refreshToken || !clientId || !clientSecret) return null;

  if (cachedServerToken && cachedServerToken.expiresAt > Date.now() + 60_000) {
    return cachedServerToken.token;
  }

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  const body = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
  } | null;

  if (!response.ok || !body?.access_token) return null;

  cachedServerToken = {
    token: body.access_token,
    expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000,
  };
  return cachedServerToken.token;
}

const PUBLIC_DOC_HINT =
  'Откройте доступ к документу: «Настройки доступа» → «Все, у кого есть ссылка» → «Читатель».';

export async function fetchPublicGoogleDocHtml(documentId: string): Promise<string> {
  const url = `https://docs.google.com/document/d/${encodeURIComponent(documentId)}/export?format=html`;
  const response = await fetch(url, { redirect: 'follow' });
  if (!response.ok) {
    throw new GoogleDocsApiError(
      response.status,
      'PUBLIC_EXPORT_FAILED',
      response.status === 403 || response.status === 404
        ? `Документ недоступен без входа. ${PUBLIC_DOC_HINT}`
        : `Не удалось загрузить публичный экспорт Google Docs. ${PUBLIC_DOC_HINT}`
    );
  }
  return response.text();
}

export async function resolveGoogleDocAnchors(documentId: string): Promise<{
  anchors: DocTextAnchor[];
  anchorCount: number;
  source: 'server-api' | 'public-export';
}> {
  const serverToken = await getServerGoogleAccessToken();
  if (serverToken) {
    const document = await fetchGoogleDocumentFromApi(documentId, serverToken);
    const anchors = extractDocTextAnchors(document as Parameters<typeof extractDocTextAnchors>[0]);
    return { anchors, anchorCount: anchors.length, source: 'server-api' };
  }

  const html = await fetchPublicGoogleDocHtml(documentId);
  const anchors = extractDocTextAnchorsFromGoogleHtml(html);
  if (anchors.length === 0) {
    throw new GoogleDocsApiError(
      404,
      'NO_PUBLIC_ANCHORS',
      'В документе не найдены заголовки сцен (H1–H6). Оформите названия как «Сцена 1», «Сцена 2» и т.д.'
    );
  }

  return { anchors, anchorCount: anchors.length, source: 'public-export' };
}

export async function handleFetchGoogleDocAnchors(req: Request, res: Response): Promise<void> {
  const documentId = req.params.documentId;
  if (!documentId || !/^[a-zA-Z0-9_-]+$/.test(documentId)) {
    res.status(400).json({ error: 'INVALID_DOCUMENT_ID' });
    return;
  }

  try {
    const result = await resolveGoogleDocAnchors(documentId);
    res.json(result);
  } catch (error) {
    if (error instanceof GoogleDocsApiError) {
      const status = error.code === 'NO_PUBLIC_ANCHORS' ? 404 : error.status;
      res.status(status).json({
        error: error.code,
        message: error.details ?? error.code,
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'FETCH_FAILED';
    console.error('[api] google doc anchors failed', message);
    res.status(502).json({ error: 'FETCH_FAILED', message });
  }
}
