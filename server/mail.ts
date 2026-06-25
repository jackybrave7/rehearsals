import nodemailer from 'nodemailer';

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

export function isMailConfigured(): boolean {
  return readMailConfig() !== null;
}

export async function sendMail(options: {
  to: string;
  subject: string;
  text: string;
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
  });

  await transporter.sendMail({
    from: config.from,
    to: options.to,
    subject: options.subject,
    text: options.text,
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
