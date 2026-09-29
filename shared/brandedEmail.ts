import { escapeHtml } from './escapeHtml.js';

export const DEFAULT_BRANDED_EMAIL_FOOTER =
  'Вы получили это письмо, потому что зарегистрировались в сервисе «Репетиции». Ответьте на письмо, если нужна помощь.';

export const ONBOARDING_DRIP_FOOTER_NOTE =
  'Это письмо из серии подсказок по настройке «Репетиции». Мы присылаем его только о шагах, которые вы ещё не сделали.';

export function buildBrandedEmailHtml(options: {
  appUrl: string;
  logoUrl?: string | null;
  greeting: string;
  bodyHtml: string;
  actionLabel?: string;
  actionUrl?: string;
  footerNote?: string;
}): string {
  const appUrl = options.appUrl.replace(/\/$/, '');
  const logoUrl = options.logoUrl ?? `${appUrl}/email/logo.png`;
  const logoBlock = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" width="48" height="48" alt="Репетиции" style="display:block;border-radius:50%;margin:0 0 12px;border:1px solid rgba(255,255,255,0.15);" />`
    : '';

  const actionBlock =
    options.actionLabel && options.actionUrl
      ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
  <tr>
    <td style="border-radius:10px;background:#b8860b;">
      <a href="${escapeHtml(options.actionUrl)}" style="display:inline-block;padding:14px 24px;color:#141414;font-size:15px;font-weight:700;text-decoration:none;border-radius:10px;">
        ${escapeHtml(options.actionLabel)}
      </a>
    </td>
  </tr>
</table>
<p style="margin:16px 0 0;font-size:13px;color:#888;line-height:1.5;word-break:break-all;">
  Если кнопка не открывается: <a href="${escapeHtml(options.actionUrl)}" style="color:#b8860b;">${escapeHtml(options.actionUrl)}</a>
</p>`
      : '';

  const footerNote = options.footerNote ?? DEFAULT_BRANDED_EMAIL_FOOTER;

  return `<!DOCTYPE html>
<html lang="ru">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0eeea;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0eeea;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e8e4dc;">
        <tr>
          <td style="background:#141414;padding:20px 24px;">
            ${logoBlock}
            <p style="margin:0;font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#b8860b;">Репетиции</p>
            <p style="margin:6px 0 0;font-size:15px;color:#f5f5f5;">Планировщик постановки</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;color:#222222;font-size:15px;line-height:1.55;">
            <p style="margin:0 0 16px;">Здравствуйте, ${escapeHtml(options.greeting)}!</p>
            ${options.bodyHtml}
            ${actionBlock}
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px 24px;border-top:1px solid #eee;font-size:12px;color:#888;line-height:1.5;">
            ${escapeHtml(footerNote)}
            <br><a href="${escapeHtml(appUrl)}" style="color:#b8860b;">${escapeHtml(appUrl)}</a>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
