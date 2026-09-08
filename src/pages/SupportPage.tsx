import { useRef, useState, type ChangeEvent } from 'react';
import { LifeBuoy, CheckCircle2, ImagePlus, X } from 'lucide-react';
import { createSupportTicket, uploadSupportAttachment } from '../api/support';
import { Button } from '../components/Button';
import { Input, Select, Textarea } from '../components/FormFields';
import {
  MAX_SUPPORT_ATTACHMENT_BYTES,
  MAX_SUPPORT_ATTACHMENTS,
  SUPPORT_ATTACHMENT_ACCEPT,
  SUPPORT_TICKET_CATEGORIES,
  getSupportCategoryLabel,
  type SupportTicketCategory,
} from '../types/support';
import { pageTitleClass } from '../utils/pageLayout';

const categoryOptions = SUPPORT_TICKET_CATEGORIES.map(({ value, label }) => ({ value, label }));

const errorMessages: Record<string, string> = {
  MESSAGE_REQUIRED: 'Введите текст обращения.',
  MESSAGE_TOO_LONG: 'Сообщение слишком длинное (максимум 10 000 символов).',
  INVALID_CATEGORY: 'Выберите категорию обращения.',
  INVALID_REQUEST: 'Проверьте заполнение формы.',
  INVALID_ATTACHMENT: 'Не удалось прикрепить один из файлов.',
  ATTACHMENT_ALREADY_USED: 'Один из файлов уже использован.',
  TOO_MANY_ATTACHMENTS: `Можно приложить не более ${MAX_SUPPORT_ATTACHMENTS} файлов.`,
  FILE_TOO_LARGE: `Каждый файл — не более ${Math.round(MAX_SUPPORT_ATTACHMENT_BYTES / (1024 * 1024))} МБ.`,
  INVALID_FILE_TYPE: 'Можно приложить только изображения: JPG, PNG, WebP или GIF.',
  UNAUTHORIZED: 'Войдите в аккаунт, чтобы отправить обращение.',
};

interface PendingAttachment {
  id: string;
  file: File;
  previewUrl: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      const base64 = result.split(',')[1] ?? '';
      if (!base64) {
        reject(new Error('READ_FAILED'));
        return;
      }
      resolve(base64);
    };
    reader.onerror = () => reject(new Error('READ_FAILED'));
    reader.readAsDataURL(file);
  });
}

function validateAttachment(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return errorMessages.INVALID_FILE_TYPE;
  }
  if (!SUPPORT_ATTACHMENT_ACCEPT.split(',').includes(file.type)) {
    return errorMessages.INVALID_FILE_TYPE;
  }
  if (file.size > MAX_SUPPORT_ATTACHMENT_BYTES) {
    return errorMessages.FILE_TOO_LARGE;
  }
  return null;
}

export function SupportPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<SupportTicketCategory>('bug');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ ticketNumber: string; mailSent: boolean; category: SupportTicketCategory } | null>(
    null
  );

  const handlePickFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (picked.length === 0) return;

    setError(null);
    const next: PendingAttachment[] = [];
    for (const file of picked) {
      if (attachments.length + next.length >= MAX_SUPPORT_ATTACHMENTS) {
        setError(errorMessages.TOO_MANY_ATTACHMENTS);
        break;
      }
      const validationError = validateAttachment(file);
      if (validationError) {
        setError(validationError);
        continue;
      }
      next.push({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        previewUrl: URL.createObjectURL(file),
      });
    }
    if (next.length > 0) {
      setAttachments((current) => [...current, ...next]);
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments((current) => {
      const target = current.find((entry) => entry.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return current.filter((entry) => entry.id !== id);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const attachmentFileIds: string[] = [];
      for (const attachment of attachments) {
        const dataBase64 = await readFileAsBase64(attachment.file);
        const uploaded = await uploadSupportAttachment({
          name: attachment.file.name,
          mimeType: attachment.file.type,
          dataBase64,
        });
        attachmentFileIds.push(uploaded.fileId);
      }

      const { ticket, mailSent } = await createSupportTicket({
        category,
        subject: subject.trim() || undefined,
        message,
        attachmentFileIds,
      });
      setResult({ ticketNumber: ticket.ticketNumber, mailSent, category: ticket.category });
      setSubject('');
      setMessage('');
      setAttachments((current) => {
        for (const attachment of current) URL.revokeObjectURL(attachment.previewUrl);
        return [];
      });
    } catch (submitError) {
      const code = submitError instanceof Error ? submitError.message : 'UNKNOWN';
      setError(errorMessages[code] ?? 'Не удалось отправить обращение. Попробуйте позже.');
    } finally {
      setSubmitting(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-6">
        <header>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
            <LifeBuoy size={14} />
            Поддержка
          </div>
          <h1 className={pageTitleClass}>Обращение отправлено</h1>
        </header>

        <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={24} />
            <div className="space-y-3">
              <p className="text-white">
                Ваше обращение зарегистрировано под номером{' '}
                <span className="font-mono font-semibold text-gold-light">{result.ticketNumber}</span>.
              </p>
              <p className="text-sm text-muted">
                Категория: {getSupportCategoryLabel(result.category)}
              </p>
              {result.mailSent ? (
                <p className="text-sm text-muted">
                  Копия обращения отправлена на ваш email. Сохраните номер — он понадобится при переписке.
                </p>
              ) : (
                <p className="text-sm text-amber-200/90">
                  Письмо с подтверждением не отправлено (почта не настроена на сервере). Запишите номер обращения.
                </p>
              )}
              <Button type="button" variant="secondary" onClick={() => setResult(null)}>
                Отправить ещё одно обращение
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-xs font-medium uppercase tracking-wide text-gold-light">
          <LifeBuoy size={14} />
          Поддержка
        </div>
        <h1 className={pageTitleClass}>Поддержка</h1>
        <p className="mt-1 text-muted">
          Опишите проблему или предложение — мы ответим на email вашего аккаунта.
        </p>
      </header>

      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="space-y-5 rounded-2xl border border-gold/10 bg-surface/40 p-4 sm:p-6"
      >
        <Select
          label="Категория"
          value={category}
          onChange={(event) => setCategory(event.target.value as SupportTicketCategory)}
          options={categoryOptions}
          required
        />

        <Input
          label="Тема (необязательно)"
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Кратко, о чём обращение"
          maxLength={200}
        />

        <Textarea
          label="Сообщение"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          placeholder="Опишите ситуацию подробнее: что делали, что ожидали, что произошло"
          rows={6}
          required
          maxLength={10000}
        />

        <div className="space-y-3">
          <div>
            <p className="mb-1 text-sm font-medium text-foreground">Скриншоты (необязательно)</p>
            <p className="text-xs text-muted">
              До {MAX_SUPPORT_ATTACHMENTS} изображений, каждое до {Math.round(MAX_SUPPORT_ATTACHMENT_BYTES / (1024 * 1024))} МБ
            </p>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept={SUPPORT_ATTACHMENT_ACCEPT}
            multiple
            className="hidden"
            onChange={handlePickFiles}
          />

          {attachments.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2">
              {attachments.map((attachment) => (
                <li
                  key={attachment.id}
                  className="flex items-center gap-3 rounded-xl border border-gold/10 bg-background/50 p-3"
                >
                  <img
                    src={attachment.previewUrl}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-lg border border-gold/10 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-foreground">{attachment.file.name}</p>
                    <p className="text-xs text-muted">{formatFileSize(attachment.file.size)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="rounded-lg p-1 text-muted hover:bg-white/5 hover:text-foreground"
                    aria-label={`Удалить ${attachment.file.name}`}
                  >
                    <X size={16} />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}

          {attachments.length < MAX_SUPPORT_ATTACHMENTS ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              <ImagePlus size={16} className="mr-2 inline" />
              Прикрепить скрин
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="rounded-lg border border-red-500/30 bg-red-950/30 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting || !message.trim()}>
          {submitting ? 'Отправка…' : 'Отправить обращение'}
        </Button>
      </form>
    </div>
  );
}
