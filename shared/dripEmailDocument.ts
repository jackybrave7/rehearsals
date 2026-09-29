import {
  buildBrandedEmailHtml,
  ONBOARDING_DRIP_FOOTER_NOTE,
} from './brandedEmail.js';
import { DRIP_APP_URL_PLACEHOLDER, expandDripAppUrl } from './dripEmailBody.js';

/** Подставляется при отправке и в превью админки. */
export const DRIP_GREETING_PLACEHOLDER = '{{GREETING}}';

export function wrapFullDripEmailHtml(options: {
  innerBodyHtml: string;
  actionLabel: string;
  actionPath: string;
}): string {
  const path = options.actionPath.startsWith('/') ? options.actionPath : `/${options.actionPath}`;
  return buildBrandedEmailHtml({
    appUrl: DRIP_APP_URL_PLACEHOLDER,
    logoUrl: `${DRIP_APP_URL_PLACEHOLDER}/email/logo.png`,
    greeting: DRIP_GREETING_PLACEHOLDER,
    bodyHtml: options.innerBodyHtml,
    actionLabel: options.actionLabel,
    actionUrl: `${DRIP_APP_URL_PLACEHOLDER}${path}`,
    footerNote: ONBOARDING_DRIP_FOOTER_NOTE,
  });
}

export function isFullDripEmailDocument(html: string): boolean {
  const trimmed = html.trim().toLowerCase();
  return trimmed.startsWith('<!doctype') || trimmed.includes('планировщик постановки');
}

export function renderDripEmailHtml(
  storedHtml: string,
  options: { appUrl: string; greeting: string; logoUrl?: string | null }
): string {
  let html = expandDripAppUrl(storedHtml, options.appUrl);
  html = html.split(DRIP_GREETING_PLACEHOLDER).join(options.greeting);
  if (options.logoUrl) {
    const base = options.appUrl.replace(/\/$/, '');
    const defaultLogo = `${base}/email/logo.png`;
    if (options.logoUrl !== defaultLogo) {
      html = html.split(defaultLogo).join(options.logoUrl);
    }
  }
  return html;
}

export function previewDripEmailHtml(
  storedHtml: string,
  appUrl: string,
  sampleGreeting = 'Анна'
): string {
  return renderDripEmailHtml(storedHtml, {
    appUrl,
    greeting: sampleGreeting,
  });
}
