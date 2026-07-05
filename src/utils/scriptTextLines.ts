const CHARACTER_NAME_PART = '[А-ЯA-ZЁ][а-яёА-ЯЁ\\-]+';
const CHARACTER_NAME = `(?:${CHARACTER_NAME_PART}(?:[\\s-]+${CHARACTER_NAME_PART}){0,3})`;
const CHARACTER_MULTI_WORD_NAME = `(?:${CHARACTER_NAME_PART}(?:\\s+${CHARACTER_NAME_PART})+)`;
const CHARACTER_ALL_CAPS_NAME = '[А-ЯA-ZЁ]{2,}';
const CHARACTER_INLINE_REMARK_RE = '\\s*\\([^)]+\\)';

/** Маркер реплики: «Петер:», «Петер.» или «Петер (ремарка).» */
export const CHARACTER_DIALOGUE_INLINE_RE = new RegExp(
  `^(${CHARACTER_NAME})(?:${CHARACTER_INLINE_REMARK_RE})?\\s*[:.]\\s*(.*)$`
);

export const CHARACTER_CUE_LINE_RE = new RegExp(
  `^${CHARACTER_NAME}(?:${CHARACTER_INLINE_REMARK_RE})?\\s*[:.]?$`
);

/** В середине строки — только полное имя или ВСЕ ПРОПИСНЫЕ, чтобы не резать по «Тише.» */
const CHARACTER_MARKER_RE = new RegExp(
  `(?:^(${CHARACTER_NAME})|(?<=[.!?]\\s)(${CHARACTER_MULTI_WORD_NAME}|${CHARACTER_ALL_CAPS_NAME}))(?:${CHARACTER_INLINE_REMARK_RE})?\\s*[:.]\\s+`,
  'g'
);

function splitCompoundLine(line: string): string[] {
  const markers: Array<{ index: number; name: string }> = [];
  for (const match of line.matchAll(CHARACTER_MARKER_RE)) {
    const name = match[1] ?? match[2];
    if (!name) continue;
    markers.push({ index: match.index ?? 0, name });
  }

  if (markers.length === 0) {
    return [line];
  }

  const segments: string[] = [];
  let cursor = 0;

  for (let i = 0; i < markers.length; i += 1) {
    const start = markers[i].index;
    if (start > cursor) {
      const prefix = line.slice(cursor, start).trim();
      if (prefix) segments.push(prefix);
    }
    const end = i + 1 < markers.length ? markers[i + 1].index : line.length;
    const chunk = line.slice(start, end).trim();
    if (chunk) segments.push(chunk);
    cursor = end;
  }

  if (cursor < line.length) {
    const tail = line.slice(cursor).trim();
    if (tail) segments.push(tail);
  }

  return segments;
}

/** Разбивает сырой текст сцены на логические строки (абзацы + реплики в одной строке). */
export function expandScriptTextToLines(raw: string): string[] {
  const result: string[] = [];

  for (const physicalLine of raw.replace(/\r\n/g, '\n').split('\n')) {
    const trimmed = physicalLine.trim();
    if (!trimmed) continue;
    result.push(...splitCompoundLine(trimmed));
  }

  return result;
}
