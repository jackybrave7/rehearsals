const RU_PHONE_LENGTH = 11;

export function extractPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeRussianPhoneDigits(digits: string): string {
  if (!digits) return '';

  let normalized = digits;
  if (normalized.startsWith('8')) {
    normalized = `7${normalized.slice(1)}`;
  } else if (!normalized.startsWith('7')) {
    normalized = `7${normalized}`;
  }

  return normalized.slice(0, RU_PHONE_LENGTH);
}

/** Единый вид: +7 (963) 965-80-72 */
export function formatPhone(value: string | undefined | null): string {
  if (!value?.trim()) return '';

  const digits = normalizeRussianPhoneDigits(extractPhoneDigits(value));
  if (!digits || digits === '7') return '+7';

  const national = digits.slice(1);
  let result = '+7';

  if (national.length > 0) {
    result += ` (${national.slice(0, 3)}`;
  }
  if (national.length >= 3) {
    result += ')';
  }
  if (national.length > 3) {
    result += ` ${national.slice(3, 6)}`;
  }
  if (national.length > 6) {
    result += `-${national.slice(6, 8)}`;
  }
  if (national.length > 8) {
    result += `-${national.slice(8, 10)}`;
  }

  return result;
}

export function formatPhoneInput(value: string): string {
  return formatPhone(value);
}

export function parsePhoneForSave(value: string | undefined): string | undefined {
  const formatted = formatPhone(value);
  if (!formatted || formatted === '+7') return undefined;
  return formatted;
}
