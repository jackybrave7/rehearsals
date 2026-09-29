/** Стилизованный HTML тела письма (внутри фирменной обёртки). */
export function escapeDripHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const P_STYLE = 'margin:0 0 14px;line-height:1.65;color:#2a2a2a;font-size:15px;';
const LEAD_STYLE =
  'margin:0 0 16px;line-height:1.65;color:#2a2a2a;font-size:16px;font-weight:600;';
const MUTED_STYLE = 'margin:0 0 14px;line-height:1.6;color:#555;font-size:14px;';

export function dripBodyHtmlFromParagraphs(paragraphs: string[], options?: { leadFirst?: boolean }): string {
  return paragraphs
    .filter(Boolean)
    .map((paragraph, index) => {
      const style = options?.leadFirst && index === 0 ? LEAD_STYLE : P_STYLE;
      return `<p style="${style}">${escapeDripHtml(paragraph)}</p>`;
    })
    .join('');
}

export function dripBodyHtmlFromPlainText(plain: string, options?: { leadFirst?: boolean }): string {
  const paragraphs = plain
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  return dripBodyHtmlFromParagraphs(paragraphs, options);
}

export function plainTextFromHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
