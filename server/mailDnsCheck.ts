import dns from 'node:dns/promises';

const DKIM_SELECTORS = ['mail', 'dkim'] as const;

export interface MailDnsCheckItem {
  id: string;
  label: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

export interface MailDeliverabilityReport {
  domain: string;
  mailConfigured: boolean;
  fromAddress: string | null;
  checks: MailDnsCheckItem[];
  readyForMailRu: boolean;
  mailRuVerificationUrl: string;
  postmasterUrl: string;
}

async function resolveTxt(name: string): Promise<string[]> {
  try {
    const rows = await dns.resolveTxt(name);
    return rows.map((parts) => parts.join(''));
  } catch {
    return [];
  }
}

function findSpfRecord(records: string[]): string | null {
  return records.find((row) => row.toLowerCase().startsWith('v=spf1')) ?? null;
}

function findDmarcRecord(records: string[]): string | null {
  return records.find((row) => row.toLowerCase().startsWith('v=dmarc1')) ?? null;
}

function parseDkimRecord(records: string[]): { valid: boolean; raw: string | null } {
  const raw = records[0] ?? null;
  if (!raw) return { valid: false, raw: null };
  const lower = raw.toLowerCase();
  const hasVersion = lower.includes('v=dkim1');
  const hasKey = /p=[a-z0-9+/=]+/i.test(raw);
  return { valid: hasVersion && hasKey, raw };
}

export async function checkMailDeliverability(options: {
  fromAddress?: string | null;
  mailConfigured?: boolean;
}): Promise<MailDeliverabilityReport> {
  const fromAddress = options.fromAddress?.trim() || null;
  const domain = fromAddress?.split('@')[1] ?? 'rehears.ru';
  const checks: MailDnsCheckItem[] = [];

  const rootTxt = await resolveTxt(domain);
  const spf = findSpfRecord(rootTxt);
  const spfOk = Boolean(
    spf && (spf.includes('_spf.timeweb.ru') || spf.includes('include:'))
  );
  checks.push({
    id: 'spf',
    label: 'SPF',
    ok: spfOk,
    detail: spf ?? 'TXT-запись SPF не найдена',
    fix: spfOk
      ? undefined
      : 'В DNS домена добавьте SPF: v=spf1 include:_spf.timeweb.ru ~all',
  });

  const dmarcTxt = await resolveTxt(`_dmarc.${domain}`);
  const dmarc = findDmarcRecord(dmarcTxt);
  const dmarcOk = Boolean(dmarc);
  checks.push({
    id: 'dmarc',
    label: 'DMARC',
    ok: dmarcOk,
    detail: dmarc ?? 'Запись _dmarc не найдена',
    fix: dmarcOk
      ? 'Для Mail.ru желательно p=quarantine или p=reject (сейчас часто p=none — письма доходят, но репутация ниже).'
      : 'Добавьте TXT _dmarc: v=DMARC1; p=none; rua=mailto:support@rehears.ru',
  });

  let dkimOk = false;
  for (const selector of DKIM_SELECTORS) {
    const host = `${selector}._domainkey.${domain}`;
    const records = await resolveTxt(host);
    const parsed = parseDkimRecord(records);
    if (records.length === 0) {
      checks.push({
        id: `dkim-${selector}`,
        label: `DKIM (${selector})`,
        ok: false,
        detail: 'Запись не найдена',
        fix:
          selector === 'mail'
            ? 'Сгенерируйте ключ: node scripts/setup-smtp-dkim.mjs и добавьте TXT mail._domainkey в TimeWeb DNS.'
            : undefined,
      });
      continue;
    }

    checks.push({
      id: `dkim-${selector}`,
      label: `DKIM (${selector})`,
      ok: parsed.valid,
      detail: parsed.valid
        ? `Запись найдена (${host})`
        : `Запись есть, но без v=DKIM1 — Mail.ru может отклонять (${parsed.raw?.slice(0, 80)}…)`,
      fix: parsed.valid
        ? undefined
        : `Исправьте TXT ${selector}._domainkey: v=DKIM1; k=rsa; p=… (одной строкой)`,
    });
    if (parsed.valid) dkimOk = true;
  }

  const appDkimConfigured = Boolean(
    process.env.SMTP_DKIM_DOMAIN?.trim() &&
      (process.env.SMTP_DKIM_PRIVATE_KEY_PATH?.trim() ||
        process.env.SMTP_DKIM_PRIVATE_KEY?.trim())
  );
  checks.push({
    id: 'app-dkim',
    label: 'DKIM в приложении',
    ok: appDkimConfigured,
    detail: appDkimConfigured
      ? `Подпись: ${process.env.SMTP_DKIM_SELECTOR}._domainkey.${process.env.SMTP_DKIM_DOMAIN}`
      : 'SMTP_DKIM_* не заданы — письма с VPS не подписываются DKIM',
    fix: appDkimConfigured
      ? undefined
      : 'На сервере: node scripts/setup-smtp-dkim.mjs, добавьте DNS и переменные в .env',
  });

  checks.push({
    id: 'mailru-postmaster',
    label: 'Постмастер Mail.ru',
    ok: true,
    detail: 'Домен нужно подтвердить вручную в postmaster.mail.ru',
    fix: `Добавьте домен ${domain} → подтвердите файлом mailru-verification120c4ec91218f839.html`,
  });

  const readyForMailRu =
    Boolean(options.mailConfigured) && spfOk && dmarcOk && (dkimOk || appDkimConfigured);

  return {
    domain,
    mailConfigured: Boolean(options.mailConfigured),
    fromAddress,
    checks,
    readyForMailRu,
    mailRuVerificationUrl: `https://${domain}/mailru-verification120c4ec91218f839.html`,
    postmasterUrl: 'https://postmaster.mail.ru/',
  };
}
