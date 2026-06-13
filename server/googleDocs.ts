import type { Request, Response } from 'express';

const GOOGLE_DOCS_API = 'https://docs.googleapis.com/v1/documents';

export class GoogleDocsApiError extends Error {
  status: number;
  code: string;
  details?: string;

  constructor(status: number, code: string, details?: string) {
    super(code);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token || null;
}

function mapGoogleError(status: number, body: unknown): GoogleDocsApiError {
  const error = (body as { error?: { message?: string; status?: string } })?.error;
  const message = error?.message ?? '';
  const lower = message.toLowerCase();

  if (
    lower.includes('office file') ||
    lower.includes('must not be an office') ||
    lower.includes('not supported for this document')
  ) {
    return new GoogleDocsApiError(status, 'OFFICE_FILE', message);
  }

  if (status === 401) {
    return new GoogleDocsApiError(status, 'AUTH_EXPIRED', message);
  }

  if (status === 404) {
    return new GoogleDocsApiError(status, 'NOT_FOUND', message);
  }

  if (status === 403) {
    if (
      lower.includes('has not been used') ||
      lower.includes('is disabled') ||
      lower.includes('access not configured')
    ) {
      return new GoogleDocsApiError(status, 'API_DISABLED', message);
    }
    return new GoogleDocsApiError(status, 'ACCESS_DENIED', message);
  }

  return new GoogleDocsApiError(status, `API_ERROR_${status}`, message || undefined);
}

export async function fetchGoogleDocumentFromApi(
  documentId: string,
  accessToken: string
): Promise<unknown> {
  const response = await fetch(`${GOOGLE_DOCS_API}/${encodeURIComponent(documentId)}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    throw mapGoogleError(response.status, body);
  }

  return body;
}

export async function handleFetchGoogleDocument(req: Request, res: Response): Promise<void> {
  const documentId = req.params.documentId;
  if (!documentId || !/^[a-zA-Z0-9_-]+$/.test(documentId)) {
    res.status(400).json({ error: 'INVALID_DOCUMENT_ID' });
    return;
  }

  const accessToken = readBearerToken(req);
  if (!accessToken) {
    res.status(401).json({ error: 'AUTH_REQUIRED' });
    return;
  }

  try {
    const document = await fetchGoogleDocumentFromApi(documentId, accessToken);
    res.json(document);
  } catch (error) {
    if (error instanceof GoogleDocsApiError) {
      res.status(error.status).json({
        error: error.code,
        message: error.details,
      });
      return;
    }

    const message = error instanceof Error ? error.message : 'FETCH_FAILED';
    console.error('[api] google docs fetch failed', message);
    res.status(502).json({ error: 'FETCH_FAILED', message });
  }
}
