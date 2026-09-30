export type EmbeddableVideoProvider = 'youtube' | 'rutube' | 'vimeo' | 'vk';

export interface EmbeddableVideo {
  provider: EmbeddableVideoProvider;
  canonicalUrl: string;
  embedUrl: string;
  thumbnailUrl: string | null;
}

const EMBED_HOSTS = new Set([
  'www.youtube.com',
  'youtube.com',
  'm.youtube.com',
  'youtu.be',
  'rutube.ru',
  'www.rutube.ru',
  'vimeo.com',
  'www.vimeo.com',
  'player.vimeo.com',
  'vk.com',
  'www.vk.com',
  'vkvideo.ru',
  'www.vkvideo.ru',
]);

function tryParseUrl(input: string): URL | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  try {
    const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    return new URL(withProtocol);
  } catch {
    return null;
  }
}

function parseYouTube(parsed: URL): EmbeddableVideo | null {
  const host = parsed.hostname.replace(/^www\./, '');
  let videoId: string | null = null;

  if (host === 'youtu.be') {
    videoId = parsed.pathname.replace(/^\//, '').split('/')[0] || null;
  } else if (host === 'youtube.com' || host === 'm.youtube.com') {
    if (parsed.pathname.startsWith('/watch')) {
      videoId = parsed.searchParams.get('v');
    } else if (parsed.pathname.startsWith('/embed/')) {
      videoId = parsed.pathname.split('/')[2] ?? null;
    } else if (parsed.pathname.startsWith('/shorts/')) {
      videoId = parsed.pathname.split('/')[2] ?? null;
    }
  }

  if (!videoId || !/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return null;

  const canonicalUrl = `https://www.youtube.com/watch?v=${videoId}`;
  return {
    provider: 'youtube',
    canonicalUrl,
    embedUrl: `https://www.youtube.com/embed/${videoId}?rel=0`,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
  };
}

function parseRutube(parsed: URL): EmbeddableVideo | null {
  const host = parsed.hostname.replace(/^www\./, '');
  if (host !== 'rutube.ru') return null;

  let videoId: string | null = null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts[0] === 'video' && parts[1]) {
    videoId = parts[1];
  } else if (parts[0] === 'play' && parts[1] === 'embed' && parts[2]) {
    videoId = parts[2];
  }

  if (!videoId || videoId.length < 8) return null;

  const canonicalUrl = `https://rutube.ru/video/${videoId}/`;
  return {
    provider: 'rutube',
    canonicalUrl,
    embedUrl: `https://rutube.ru/play/embed/${videoId}`,
    thumbnailUrl: `https://pic.rutube.ru/video/${videoId}.jpg`,
  };
}

function parseVimeo(parsed: URL): EmbeddableVideo | null {
  const host = parsed.hostname.replace(/^www\./, '');
  let videoId: string | null = null;

  if (host === 'vimeo.com') {
    videoId = parsed.pathname.split('/').filter(Boolean)[0] ?? null;
  } else if (host === 'player.vimeo.com') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts[0] === 'video' && parts[1]) videoId = parts[1];
  }

  if (!videoId || !/^\d+$/.test(videoId)) return null;

  const canonicalUrl = `https://vimeo.com/${videoId}`;
  return {
    provider: 'vimeo',
    canonicalUrl,
    embedUrl: `https://player.vimeo.com/video/${videoId}`,
    thumbnailUrl: null,
  };
}

function parseVk(parsed: URL): EmbeddableVideo | null {
  const host = parsed.hostname.replace(/^www\./, '');
  if (host !== 'vk.com' && host !== 'vkvideo.ru') return null;

  const match = parsed.pathname.match(/video(-?\d+)_(\d+)/i);
  if (!match) return null;

  const oid = match[1]!;
  const id = match[2]!;
  const canonicalUrl = `https://vk.com/video${oid}_${id}`;
  return {
    provider: 'vk',
    canonicalUrl,
    embedUrl: `https://vk.com/video_ext.php?oid=${oid}&id=${id}&hd=2`,
    thumbnailUrl: null,
  };
}

export function parseEmbeddableVideoLink(input: string): EmbeddableVideo | null {
  const parsed = tryParseUrl(input);
  if (!parsed) return null;

  const host = parsed.hostname.replace(/^www\./, '');
  if (!EMBED_HOSTS.has(parsed.hostname) && !EMBED_HOSTS.has(host)) {
    return null;
  }

  return (
    parseYouTube(parsed) ??
    parseRutube(parsed) ??
    parseVimeo(parsed) ??
    parseVk(parsed)
  );
}

export function isEmbeddableVideoUrl(url: string): boolean {
  return parseEmbeddableVideoLink(url) !== null;
}

/** Загруженный файл в S3 (по префиксу ключа в URL). */
export function isOutcomeVideoFileUrl(url: string): boolean {
  return url.includes('/rehearsal-outcome-videos/');
}

export function getEmbeddableVideoFromStoredUrl(url: string): EmbeddableVideo | null {
  return parseEmbeddableVideoLink(url);
}

export function outcomeVideoEmbedUrl(url: string): string | null {
  if (isOutcomeVideoFileUrl(url)) return url;
  return parseEmbeddableVideoLink(url)?.embedUrl ?? null;
}

export function outcomeVideoThumbnailUrl(url: string): string | null {
  return parseEmbeddableVideoLink(url)?.thumbnailUrl ?? null;
}

export function outcomeVideoProviderLabel(url: string): string | null {
  const provider = parseEmbeddableVideoLink(url)?.provider;
  if (!provider) return null;
  switch (provider) {
    case 'youtube':
      return 'YouTube';
    case 'rutube':
      return 'Rutube';
    case 'vimeo':
      return 'Vimeo';
    case 'vk':
      return 'VK Видео';
    default:
      return null;
  }
}
