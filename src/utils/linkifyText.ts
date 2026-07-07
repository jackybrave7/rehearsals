const URL_PATTERN = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi;

export interface LinkifySegment {
  type: 'text' | 'url';
  text: string;
  href?: string;
  label?: string;
}

/** Короткая подпись ссылки для отображения в интерфейсе. */
export function shortenUrlForDisplay(url: string, maxLength = 52): string {
  if (url.length <= maxLength) return url;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
    const compact = path === '/' ? host : `${host}${path}`;
    if (compact.length <= maxLength) return compact;
    if (host.length >= maxLength - 1) {
      return `${host.slice(0, maxLength - 1)}…`;
    }
    const pathBudget = maxLength - host.length - 1;
    return `${host}${path.slice(0, Math.max(pathBudget, 8))}…`;
  } catch {
    return `${url.slice(0, maxLength - 1)}…`;
  }
}

export function linkifyText(text: string): LinkifySegment[] {
  const segments: LinkifySegment[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_PATTERN)) {
    const url = match[0];
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'text', text: text.slice(lastIndex, index) });
    }
    segments.push({
      type: 'url',
      text: url,
      href: url,
      label: shortenUrlForDisplay(url),
    });
    lastIndex = index + url.length;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', text }];
}
