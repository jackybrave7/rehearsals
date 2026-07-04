const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'j',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'c',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
};

function stripHeadingMarkup(text: string): string {
  return text
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .replace(/\{\{([^}]+)\}\}/g, '$1')
    .trim();
}

/** Latin slug (e.g. bystryj-start) for shareable URLs. */
export function guideSlugLatin(text: string): string {
  const plain = stripHeadingMarkup(text).toLowerCase();
  let result = '';
  for (const char of plain) {
    if (CYRILLIC_TO_LATIN[char] !== undefined) {
      result += CYRILLIC_TO_LATIN[char];
    } else if (/[a-z0-9]/.test(char)) {
      result += char;
    } else if (/\s/.test(char) || char === '-' || char === '—') {
      result += '-';
    }
  }
  return result.replace(/-+/g, '-').replace(/^-|-$/g, '');
}

/** Cyrillic slug kept in URL (e.g. сцены-и-текст). */
export function guideSlugCyrillic(text: string): string {
  const plain = stripHeadingMarkup(text).toLowerCase();
  return plain
    .replace(/[,…:;.!?«»"()]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Default heading anchor: prefer explicit id, else cyrillic slug. */
export function guideHeadingId(text: string, explicitId?: string): string {
  if (explicitId?.trim()) return explicitId.trim();
  return guideSlugCyrillic(text);
}

export function guideMediaSlug(description: string): string {
  return guideSlugLatin(description) || 'media';
}
