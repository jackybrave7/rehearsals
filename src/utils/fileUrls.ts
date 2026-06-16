/** Превращает путь /api/files/…, data:… или /images/… в URL для <img src> и ссылок. */
export function resolveAssetUrl(url?: string): string | undefined {
  if (!url) return undefined;
  if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }
  if (url.startsWith('/images/') || url.startsWith('/api/')) {
    return url;
  }
  return url;
}

export function resolvePlayScriptUrl(play: {
  scriptFileUrl?: string;
  scriptFileDataUrl?: string;
}): string | undefined {
  return resolveAssetUrl(play.scriptFileUrl ?? play.scriptFileDataUrl);
}
