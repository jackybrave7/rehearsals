import { escapeHtml } from './escapeHtml.js';

export const DEFAULT_BRANDED_EMAIL_FOOTER =
  'Вы получили это письмо, потому что зарегистрировались в сервисе «Репетиции». Ответьте на письмо, если нужна помощь.';

export const ONBOARDING_DRIP_FOOTER_NOTE =
  'Это письмо из серии подсказок по настройке «Репетиции». Мы присылаем его только о шагах, которые вы ещё не сделали.';

export type BrandedEmailDesign = 'theater' | 'zen';

function buildZenLogoMark(logoUrl?: string | null): string {
  const mark = `<table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td align="center" valign="middle" style="width:48px;height:48px;border-radius:50%;border:1px solid rgba(10,10,10,0.16);background:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:20px;font-weight:700;color:#0a0a0a;line-height:48px;">Р</td>
    <td style="padding-left:12px;vertical-align:middle;">
      <p style="margin:0;font-size:11px;letter-spacing:0.1em;text-transform:uppercase;color:#3a4150;">Репетиции</p>
      <p style="margin:4px 0 0;font-size:15px;font-weight:600;color:#0a0a0a;">Планировщик постановки</p>
    </td>
  </tr></table>`;

  if (!logoUrl) return mark;

  return `${mark}<img src="${escapeHtml(logoUrl)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;opacity:0;" />`;
}

function buildTheaterLogoBlock(logoUrl?: string | null): string {
  if (!logoUrl) return '';
  return `<img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="Репетиции" style="display:block;border-radius:50%;margin:0 0 12px;border:1px solid rgba(255,255,255,0.15);" />`;
}

export function buildBrandedEmailHtml(options: {
  appUrl: string;
  logoUrl?: string | null;
  greeting: string;
  bodyHtml: string;
  actionLabel?: string;
  actionUrl?: string;
  footerNote?: string;
  design?: BrandedEmailDesign;
}): string {
  const design = options.design ?? 'theater';
  const appUrl = options.appUrl.replace(/\/$/, '');
  const logoUrl = options.logoUrl ?? `${appUrl}/email/logo.png`;
  const footerNote = options.footerNote ?? DEFAULT_BRANDED_EMAIL_FOOTER;

  const isZen = design === 'zen';
  const outerBg = isZen ? '#e8eaef' : '#f0eeea';
  const cardBorder = isZen ? 'rgba(10,10,10,0.12)' : '#e8e4dc';
  const linkColor = isZen ? '#e04a12' : '#b8860b';
  const buttonBg = isZen ? '#e04a12' : '#b8860b';
  const buttonText = isZen ? '#ffffff' : '#141414';
  const bodyColor = isZen ? '#0a0a0a' : '#222222';
  const footerColor = isZen ? '#3a4150' : '#888888';

  const headerBlock = isZen
    ? `<td style="padding:20px 24px;background:#ffffff;border-bottom:1px solid rgba(10,10,10,0.12);">
            ${buildZenLogoMark(logoUrl)}
          </td>`
    : `<td style="background:#141414;padding:20px 24px;">
            ${buildTheaterLogoBlock(logoUrl)}
            <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#b8860b;">Репетиции</p>
            <p style="margin:6px 0 0;font-size:15px;color:#f5f5f5;">Планировщик постановки</p>
          </td>`;

  const actionBlock =
    options.actionLabel && options.actionUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
  <tr>
    <td style="border-radius:10px;background:${buttonBg};">
      <a href="${escapeHtml(options.actionUrl)}" style="display:inline-block;padding:14px 24px;color:${buttonText};font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
        ${escapeHtml(options.actionLabel)}
      </a>
    </td>
  </tr>
</table>
<p style="margin:16px 0 0;font-size:13px;color:${footerColor};line-height:1.5;word-break:break-all;">
  Если кнопка не открывается: <a href="${escapeHtml(options.actionUrl)}" style="color:${linkColor};">${escapeHtml(options.actionUrl)}</a>
</p>`
      : '';

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:${outerBg};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${outerBg};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid ${cardBorder};">
        <tr>
          ${headerBlock}
        </tr>
        <tr>
          <td style="padding:24px;color:${bodyColor};font-size:15px;line-height:1.55;">
            <p style="margin:0 0 16px;">Здравствуйте, ${escapeHtml(options.greeting)}!</p>
            ${options.bodyHtml}
            ${actionBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px 24px;border-top:1px solid ${isZen ? 'rgba(10,10,10,0.08)' : '#eee'};font-size:12px;color:${footerColor};line-height:1.5;">
            ${escapeHtml(footerNote)}
            <br><a href="${escapeHtml(appUrl)}" style="color:${linkColor};">${escapeHtml(appUrl)}</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
