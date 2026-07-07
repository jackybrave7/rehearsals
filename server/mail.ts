import nodemailer from 'nodemailer';
import { randomUUID } from 'node:crypto';

export interface MailConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  from: string;
}

function readMailConfig(): MailConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;
  if (!host || !user || !pass || !from) return null;

  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE === '1' ||
    process.env.SMTP_SECURE === 'true' ||
    port === 465;

  return { host, port, secure, user, pass, from };
}

function readDkimConfig(): nodemailer.SendMailOptions['dkim'] | undefined {
  const domainName = process.env.SMTP_DKIM_DOMAIN?.trim();
  const keySelector = process.env.SMTP_DKIM_SELECTOR?.trim();
  const privateKey = process.env.SMTP_DKIM_PRIVATE_KEY?.replace(/\\n/g, '\n').trim();
  if (!domainName || !keySelector || !privateKey) return undefined;
  return { domainName, keySelector, privateKey };
}

function domainFromAddress(address: string): string {
  const match = address.match(/@([^>\s]+)/);
  return match?.[1] ?? 'rehears.ru';
}

function buildMailHeaders(from: string, msgType?: string): Record<string, string> {
  const domain = domainFromAddress(from);
  const headers: Record<string, string> = {
    'Message-ID': `<${randomUUID()}@${domain}>`,
    'X-Mailer': 'Rehearsals',
    'X-Entity-Ref-ID': randomUUID(),
    'List-Unsubscribe': `<mailto:support@${domain}?subject=unsubscribe>`,
  };
  if (msgType) {
    headers['X-Mailru-Msgtype'] = msgType;
    headers['X-Postmaster-Msgtype'] = msgType;
  }
  return headers;
}

export function isMailConfigured(): boolean {
  return readMailConfig() !== null;
}

export function readMailFromAddress(): string | null {
  return readMailConfig()?.from ?? null;
}

function formatFromAddress(from: string): string {
  if (from.includes('<')) return from;
  return `"Репетиции" <${from}>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function textToHtml(text: string): string {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const withLinks = block.replace(
        /(https?:\/\/[^\s<]+)/g,
        '<a href="$1" style="color:#b8860b;">$1</a>'
      );
      return `<p style="margin:0 0 12px;line-height:1.5;">${withLinks.replace(/\n/g, '<br>')}</p>`;
    });
  return `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;color:#222;">${paragraphs.join('')}</body></html>`;
}

function buildActionEmailHtml(options: {
  greeting: string;
  paragraphs: string[];
  actionLabel: string;
  actionUrl: string;
  footer?: string;
}): string {
  const body = options.paragraphs
    .map((paragraph) => `<p style="margin:0 0 12px;line-height:1.5;">${escapeHtml(paragraph)}</p>`)
    .join('');
  const footer = options.footer
    ? `<p style="margin:16px 0 0;font-size:13px;color:#666;line-height:1.5;">${escapeHtml(options.footer)}</p>`
    : '';
  return `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;color:#222;max-width:560px;">
    <p style="margin:0 0 12px;line-height:1.5;">Здравствуйте, ${escapeHtml(options.greeting)}!</p>
    ${body}
    <p style="margin:20px 0;">
      <a href="${escapeHtml(options.actionUrl)}" style="display:inline-block;padding:12px 20px;background:#b8860b;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;">
        ${escapeHtml(options.actionLabel)}
      </a>
    </p>
    <p style="margin:0 0 12px;font-size:13px;color:#666;line-height:1.5;word-break:break-all;">
      Если кнопка не открывается, скопируйте ссылку:<br>
      <a href="${escapeHtml(options.actionUrl)}" style="color:#b8860b;">${escapeHtml(options.actionUrl)}</a>
    </p>
    ${footer}
  </body>
</html>`;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  msgType?: string;
}): Promise<void> {
  const config = readMailConfig();
  if (!config) throw new Error('MAIL_NOT_CONFIGURED');

  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
    dkim: readDkimConfig(),
    tls: {
      minVersion: 'TLSv1.2',
    },
  });

  const fromAddress = formatFromAddress(config.from);
  const info = await transporter.sendMail({
    from: fromAddress,
    replyTo: config.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html ?? textToHtml(options.text),
    headers: buildMailHeaders(config.from, options.msgType),
    envelope: {
      from: config.from,
      to: options.to,
    },
  });

  const domain = options.to.split('@')[1] ?? 'unknown';
  console.log('[mail] sent', {
    domain,
    messageId: info.messageId,
    accepted: info.accepted,
    rejected: info.rejected,
  });
}

export async function sendProActivatedEmail(to: string, name: string): Promise<void> {
  const appUrl = process.env.APP_URL?.trim() || 'https://rehears.ru';
  const settingsUrl = `${appUrl.replace(/\/$/, '')}/app/settings`;
  const greeting = name.trim() || to;

  await sendMail({
    to,
    subject: 'Тариф Pro подключён — Репетиции',
    msgType: 'transaction',
    text: [
      `Здравствуйте, ${greeting}!`,
      '',
      'Вам подключён тариф Pro в сервисе «Репетиции».',
      '',
      'Теперь доступны:',
      '• неограниченное число постановок и театров;',
      '• шаблоны репетиций и повтор расписания сериями;',
      '• личные авто-напоминания участникам в Telegram;',
      '• аналитика посещаемости по актёрам;',
      '• редактирование архивных постановок.',
      '',
      `Откройте настройки: ${settingsUrl}`,
      '',
      'Если у вас остались вопросы по тарифу — ответьте на это письмо.',
    ].join('\n'),
  });
}

export async function sendRegistrationApprovedEmail(to: string, name: string): Promise<void> {
  const appUrl = process.env.APP_URL?.trim() || 'https://rehears.ru';
  const loginUrl = `${appUrl.replace(/\/$/, '')}/login`;
  const greeting = name.trim() || to;

  await sendMail({
    to,
    subject: 'Доступ к Репетициям открыт',
    msgType: 'transaction',
    text: [
      `Здравствуйте, ${greeting}!`,
      '',
      'Администратор одобрил вашу заявку на регистрацию в сервисе «Репетиции».',
      'Теперь можно войти в аккаунт:',
      loginUrl,
      '',
      'Добро пожаловать в планировщик постановки!',
    ].join('\n'),
  });
}

export async function sendEmailVerificationEmail(
  to: string,
  name: string,
  token: string,
  options?: { betaMode?: boolean }
): Promise<void> {
  const appUrl = process.env.APP_URL?.trim() || 'https://rehears.ru';
  const verifyUrl = `${appUrl.replace(/\/$/, '')}/verify-email?token=${encodeURIComponent(token)}`;
  const greeting = name.trim() || to;
  const betaMode = options?.betaMode ?? false;

  const intro = betaMode
    ? 'Вы зарегистрировались в сервисе «Репетиции» (режим бета-тестирования). Подтвердите адрес электронной почты.'
    : 'Вы зарегистрировались в сервисе «Репетиции». Подтвердите адрес электронной почты, чтобы войти в аккаунт.';
  const afterConfirm = betaMode
    ? 'После подтверждения заявка будет рассмотрена администратором. Мы сообщим на почту, когда доступ откроется.'
    : 'Ссылка действует 48 часов. Если вы не регистрировались — просто проигнорируйте это письмо.';
  const spamHint =
    'Если письма нет во входящих, проверьте папку «Спам» и отметьте его как «Не спам».';

  await sendMail({
    to,
    subject: 'Подтверждение регистрации на rehears.ru',
    msgType: 'registration',
    text: [
      `Здравствуйте, ${greeting}!`,
      '',
      intro,
      verifyUrl,
      '',
      afterConfirm,
      '',
      spamHint,
      ...(betaMode
        ? ['', 'Ссылка действует 48 часов. Если вы не регистрировались — просто проигнорируйте это письмо.']
        : []),
    ].join('\n'),
    html: buildActionEmailHtml({
      greeting,
      paragraphs: [intro, afterConfirm, spamHint],
      actionLabel: 'Подтвердить email',
      actionUrl: verifyUrl,
      footer: betaMode
        ? 'Ссылка действует 48 часов. Если вы не регистрировались — просто проигнорируйте это письмо.'
        : undefined,
    }),
  });
}

export async function sendEmailConfirmedEmail(
  to: string,
  name: string,
  options: { betaMode: boolean }
): Promise<void> {
  const appUrl = process.env.APP_URL?.trim() || 'https://rehears.ru';
  const loginUrl = `${appUrl.replace(/\/$/, '')}/login`;
  const greeting = name.trim() || to;

  if (options.betaMode) {
    await sendMail({
      to,
      subject: 'Email подтверждён — Репетиции',
      msgType: 'transaction',
      text: [
        `Здравствуйте, ${greeting}!`,
        '',
        'Ваш email подтверждён. Заявка на регистрацию отправлена администратору.',
        'Мы сообщим на почту, когда доступ к сервису откроется.',
        '',
        'Пока можно вернуться на страницу входа:',
        loginUrl,
      ].join('\n'),
    });
    return;
  }

  await sendMail({
    to,
    subject: 'Email подтверждён — можно войти',
    msgType: 'transaction',
    text: [
      `Здравствуйте, ${greeting}!`,
      '',
      'Ваш email подтверждён. Теперь можно войти в «Репетиции» и пользоваться сервисом:',
      loginUrl,
      '',
      'Добро пожаловать в планировщик постановки!',
    ].join('\n'),
  });
}

export async function sendPasswordResetEmail(
  to: string,
  name: string,
  oneTimePassword: string
): Promise<void> {
  const appUrl = process.env.APP_URL?.trim() || 'https://rehears.ru';
  const greeting = name.trim() || to;
  await sendMail({
    to,
    subject: 'Одноразовый пароль — Репетиции',
    msgType: 'password-reset',
    text: [
      `Здравствуйте, ${greeting}!`,
      '',
      'Вы запросили восстановление доступа к «Репетиции».',
      `Одноразовый пароль: ${oneTimePassword}`,
      '',
      'Войдите на сайте и сразу смените пароль в Настройках → Аккаунт.',
      appUrl,
      '',
      'Если вы не запрашивали сброс — просто проигнорируйте это письмо.',
    ].join('\n'),
  });
}

const SUPPORT_CATEGORY_LABELS: Record<string, string> = {
  bug: 'Ошибка / сбой',
  feature: 'Предложение / улучшение',
  billing: 'Тариф и оплата',
  account: 'Аккаунт и доступ',
  other: 'Другое',
};

export async function sendSupportTicketConfirmationEmail(options: {
  to: string;
  name: string;
  ticketNumber: string;
  category: string;
  subject: string | null;
  message: string;
}): Promise<void> {
  const greeting = options.name.trim() || options.to;
  const categoryLabel = SUPPORT_CATEGORY_LABELS[options.category] ?? options.category;
  const subjectLine = options.subject?.trim() ? `\nТема: ${options.subject.trim()}` : '';

  await sendMail({
    to: options.to,
    subject: `Обращение ${options.ticketNumber} — Репетиции`,
    msgType: 'support',
    text: [
      `Здравствуйте, ${greeting}!`,
      '',
      'Мы получили ваше обращение в поддержку «Репетиции».',
      '',
      `Номер обращения: ${options.ticketNumber}`,
      `Категория: ${categoryLabel}${subjectLine}`,
      '',
      'Ваше сообщение:',
      options.message,
      '',
      'Сохраните номер обращения — он понадобится, если вы напишете нам повторно по этому вопросу.',
      'Мы ответим на указанный email, когда обработаем заявку.',
    ].join('\n'),
    html: `<!DOCTYPE html>
<html>
  <body style="font-family:Arial,sans-serif;color:#222;max-width:560px;">
    <p style="margin:0 0 12px;line-height:1.5;">Здравствуйте, ${escapeHtml(greeting)}!</p>
    <p style="margin:0 0 12px;line-height:1.5;">Мы получили ваше обращение в поддержку «Репетиции».</p>
    <p style="margin:0 0 12px;line-height:1.5;">
      <strong>Номер обращения:</strong> ${escapeHtml(options.ticketNumber)}<br>
      <strong>Категория:</strong> ${escapeHtml(categoryLabel)}${
        options.subject?.trim()
          ? `<br><strong>Тема:</strong> ${escapeHtml(options.subject.trim())}`
          : ''
      }
    </p>
    <div style="margin:16px 0;padding:16px;border-left:3px solid #b8860b;background:#faf8f3;">
      <p style="margin:0 0 8px;font-size:13px;color:#666;">Ваше сообщение:</p>
      <p style="margin:0;line-height:1.5;white-space:pre-wrap;">${escapeHtml(options.message)}</p>
    </div>
    <p style="margin:0 0 12px;font-size:13px;color:#666;line-height:1.5;">
      Сохраните номер обращения — он понадобится, если вы напишете нам повторно по этому вопросу.
      Мы ответим на указанный email, когда обработаем заявку.
    </p>
  </body>
</html>`,
  });
}
