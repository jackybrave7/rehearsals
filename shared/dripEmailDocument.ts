import {
  buildBrandedEmailHtml,
  ONBOARDING_DRIP_FOOTER_NOTE,
} from './brandedEmail.js';
import { DRIP_APP_URL_PLACEHOLDER, expandDripAppUrl } from './dripEmailBody.js';

/** Подставляется при отправке и в превью админки. */
export const DRIP_GREETING_PLACEHOLDER = '{{GREETING}}';

export const DRIP_BODY_START = '<!-- DRIP_BODY_START -->';
export const DRIP_BODY_END = '<!-- DRIP_BODY_END -->';

export function extractDripEmailInnerBody(fullHtml: string): string {
  const startIdx = fullHtml.indexOf(DRIP_BODY_START);
  if (startIdx >= 0) {
    const endIdx = fullHtml.indexOf(DRIP_BODY_END);
    if (endIdx > startIdx) {
      return fullHtml.slice(startIdx + DRIP_BODY_START.length, endIdx).trim();
    }
  }

  const afterGreeting = fullHtml.match(
    /Здравствуйте[^<]*<\/p>\s*([\s\S]*?)(?=<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px)/i
  );
  if (afterGreeting?.[1]) return afterGreeting[1].trim();

  return fullHtml.trim();
}

export function injectDripEmailInnerBody(fullHtml: string, innerBodyHtml: string): string {
  const wrapped = `${DRIP_BODY_START}${innerBodyHtml}${DRIP_BODY_END}`;
  if (fullHtml.includes(DRIP_BODY_START)) {
    const pattern = new RegExp(
      `${DRIP_BODY_START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${DRIP_BODY_END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`
    );
    return fullHtml.replace(pattern, wrapped);
  }

  const re =
    /(Здравствуйте[^<]*<\/p>\s*)[\s\S]*?(?=<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px)/i;
  if (re.test(fullHtml)) {
    return fullHtml.replace(re, `$1${wrapped}`);
  }

  return fullHtml;
}

export function wrapFullDripEmailHtml(options: {
  innerBodyHtml: string;
  actionLabel: string;
  actionPath: string;
}): string {
  const path = options.actionPath.startsWith('/') ? options.actionPath : `/${options.actionPath}`;
  const bodyHtml = `${DRIP_BODY_START}${options.innerBodyHtml}${DRIP_BODY_END}`;
  return buildBrandedEmailHtml({
    appUrl: DRIP_APP_URL_PLACEHOLDER,
    logoUrl: `${DRIP_APP_URL_PLACEHOLDER}/email/logo.png`,
    greeting: DRIP_GREETING_PLACEHOLDER,
    bodyHtml,
    actionLabel: options.actionLabel,
    actionUrl: `${DRIP_APP_URL_PLACEHOLDER}${path}`,
    footerNote: ONBOARDING_DRIP_FOOTER_NOTE,
    design: 'zen',
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

  const base = options.appUrl.replace(/\/$/, '');
  const logoTarget =
    options.logoUrl?.trim() ||
    `${base}/email/logo.png`;
  const logoSources = [
    `${DRIP_APP_URL_PLACEHOLDER}/email/logo.png`,
    `${base}/email/logo.png`,
    expandDripAppUrl(`${DRIP_APP_URL_PLACEHOLDER}/email/logo.png`, options.appUrl),
  ];
  for (const source of logoSources) {
    if (source && source !== logoTarget) {
      html = html.split(source).join(logoTarget);
    }
  }

  return html;
}

export function previewDripEmailHtml(
  storedHtml: string,
  appUrl: string,
  sampleGreeting = 'Анна',
  logoUrl?: string | null
): string {
  const base = appUrl.replace(/\/$/, '');
  return renderDripEmailHtml(storedHtml, {
    appUrl,
    greeting: sampleGreeting,
    logoUrl: logoUrl ?? `${base}/email/logo.png`,
  });
}
