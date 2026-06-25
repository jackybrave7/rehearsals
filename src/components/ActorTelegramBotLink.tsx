import { useEffect, useState } from 'react';
import { Bot, Check, Copy } from 'lucide-react';
import { fetchTelegramStatus } from '../api/telegram';

interface ActorTelegramBotLinkProps {
  actorId: string;
  theaterId?: string | null;
  telegramChatId?: string;
}

export function ActorTelegramBotLink({
  actorId,
  theaterId,
  telegramChatId,
}: ActorTelegramBotLinkProps) {
  const [botUsername, setBotUsername] = useState<string | null>(null);
  const [botConfigured, setBotConfigured] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!theaterId) {
      setBotUsername(null);
      setBotConfigured(false);
      return;
    }
    void fetchTelegramStatus(theaterId).then((status) => {
      setBotConfigured(status.botConfigured);
      setBotUsername(status.botUsername);
    });
  }, [theaterId]);

  if (!botConfigured || !botUsername) {
    return (
      <p className="text-xs text-muted">
        Личные напоминания в Telegram: бот сервиса не настроен (нужен TELEGRAM_BOT_TOKEN на сервере).
      </p>
    );
  }

  const link = `https://t.me/${botUsername}?start=link_${actorId}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-2 rounded-xl border border-gold/10 bg-background/20 p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-white">
        <Bot size={16} className="text-gold/70" />
        Личные напоминания в Telegram
      </div>
      {telegramChatId ? (
        <p className="flex items-center gap-2 text-sm text-emerald-200">
          <Check size={14} />
          Бот подключён — участник будет получать напоминания в личку
        </p>
      ) : (
        <p className="text-xs text-muted">
          Участник должен открыть ссылку и нажать «Start» в боте @{botUsername}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate text-sm text-gold-light underline-offset-2 hover:underline"
        >
          {link}
        </a>
        <button
          type="button"
          onClick={() => void copyLink()}
          className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-gold/20 px-2.5 py-1.5 text-xs text-gold-light hover:bg-gold/10"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Скопировано' : 'Копировать'}
        </button>
      </div>
    </div>
  );
}
