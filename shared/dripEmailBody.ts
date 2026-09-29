import { escapeHtml } from './escapeHtml.js';

const P_STYLE = 'margin:0 0 14px;line-height:1.65;color:#2a2a2a;font-size:15px;';
const LEAD_STYLE =
  'margin:0 0 16px;line-height:1.65;color:#2a2a2a;font-size:16px;font-weight:600;';

export function dripBodyHtmlFromParagraphs(
  paragraphs: string[],
  options?: { leadFirst?: boolean }
): string {
  return paragraphs
    .filter(Boolean)
    .map((paragraph, index) => {
      const style = options?.leadFirst && index === 0 ? LEAD_STYLE : P_STYLE;
      return `<p style="${style}">${escapeHtml(paragraph)}</p>`;
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
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function resolveDripBodyHtml(bodyHtml: string | null | undefined, bodyText: string): string {
  if (bodyHtml?.trim()) return bodyHtml.trim();
  return dripBodyHtmlFromPlainText(bodyText, { leadFirst: true });
}

export const DRIP_APP_URL_PLACEHOLDER = '{{APP_URL}}';

export function expandDripAppUrl(html: string, appUrl: string): string {
  const base = appUrl.replace(/\/$/, '');
  return html.split(DRIP_APP_URL_PLACEHOLDER).join(base);
}

export function dripEmailGuideImage(slug: string, caption: string, ext: 'png' | 'gif' = 'png'): string {
  const url = `${DRIP_APP_URL_PLACEHOLDER}/guide/v2/${slug}.${ext}`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0 4px;">
  <tr><td align="center">
    <img src="${escapeHtml(url)}" alt="${escapeHtml(caption)}" width="520" style="display:block;max-width:100%;height:auto;border-radius:12px;border:1px solid #e8e4dc;" />
  </td></tr>
  <tr><td style="padding:8px 4px 0;font-size:12px;line-height:1.45;color:#888;text-align:center;">${escapeHtml(caption)}</td></tr>
</table>`;
}

export function dripEmailTip(htmlContent: string): string {
  return `<p style="margin:18px 0 0;padding:14px 16px;background:#faf8f3;border-left:3px solid #b8860b;border-radius:0 8px 8px 0;font-size:14px;line-height:1.55;color:#444;">${htmlContent}</p>`;
}

export function dripEmailInlineLink(path: string, label: string): string {
  const href = `${DRIP_APP_URL_PLACEHOLDER}${path.startsWith('/') ? path : `/${path}`}`;
  return `<a href="${escapeHtml(href)}" style="color:#b8860b;font-weight:600;text-decoration:none;">${escapeHtml(label)}</a>`;
}
