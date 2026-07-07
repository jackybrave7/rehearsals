# Деплой на VPS (TimeWeb и др.)

Краткая инструкция для Ubuntu/Debian. Предполагается домен, nginx и доступ по SSH.

## Что получится

| Компонент | Где работает |
|-----------|--------------|
| React (статика) | nginx → `dist/` |
| Express API + SQLite | pm2 → `npm start` на `127.0.0.1:3001` |
| База | `data/rehearsals.db` (не в git) |

## 1. Подготовка сервера

```bash
sudo apt update
sudo apt install -y git nginx

# Node.js 20+ (через nvm или nodesource — как принято на вашем VPS)
node -v   # v20 или новее
npm -v

sudo npm install -g pm2
```

## 2. Клонирование проекта

```bash
sudo mkdir -p /var/www
sudo chown $USER:$USER /var/www
cd /var/www
git clone https://github.com/jackybrave7/rehearsals.git rehearsals
cd rehearsals
```

## 3. Переменные окружения

```bash
cp .env.example .env
nano .env
```

Минимум для API:

```env
API_PORT=3001
```

По желанию: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`.

**Почта (обязательно для регистрации и уведомлений):** в `/var/www/rehearsals/.env` на сервере:

```env
SMTP_HOST=smtp.timeweb.ru
SMTP_PORT=465
SMTP_SECURE=1
SMTP_USER=support@rehears.ru
SMTP_PASS=пароль-от-ящика
SMTP_FROM=support@rehears.ru
APP_URL=https://rehears.ru
```

После правки: `docker restart rehearsals-api`. Проверка: `curl -s https://rehears.ru/api/auth/config` — должно быть `"mailConfigured":true`.

**Доставляемость на Яндекс / Mail.ru:** см. [`deploy/mail-deliverability.md`](mail-deliverability.md) (DKIM, постмастеры). Тест: `node scripts/test-smtp.mjs ваш@mail.ru`.

**Google Docs (опционально):** `VITE_GOOGLE_CLIENT_ID` — только для синхронизации текста из Google Docs, не для входа в аккаунт. Подставляется **на этапе сборки**. Задайте в `.env` **до** `npm run build`.

## 4. Сборка и первый запуск API

```bash
npm install
npm run build
pm2 start npm --name rehearsals-api -- start
pm2 save
pm2 startup   # выполните команду, которую выведет pm2
```

Проверка:

```bash
curl -s http://127.0.0.1:3001/api/health
```

Каталог `data/` создаётся автоматически при первом обращении к API. Резервные копии — в `data/backups/`.

## 5. nginx

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/rehearsals
sudo nano /etc/nginx/sites-available/rehearsals
```

Измените:

- `server_name` — ваш домен
- `root` — `/var/www/rehearsals/dist`

```bash
sudo ln -sf /etc/nginx/sites-available/rehearsals /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

Откройте сайт в браузере. Если API не запущен, приложение покажет экран «База данных недоступна».

## 6. HTTPS (рекомендуется)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ваш-домен.ru
```

## Docker (текущий прод)

На VPS API может работать в контейнере `rehearsals-api`. Для исходящих запросов к `api.telegram.org` нужен **`--network host`** — иначе из bridge-сети Docker бывает `fetch failed` / `UND_ERR_CONNECT_TIMEOUT`.

```bash
cd /var/www/rehearsals
docker stop rehearsals-api 2>/dev/null; docker rm rehearsals-api 2>/dev/null
docker run -d \
  --name rehearsals-api \
  --restart unless-stopped \
  --network host \
  -v /var/www/rehearsals:/app \
  --env-file /var/www/rehearsals/.env \
  -e NODE_OPTIONS=--dns-result-order=ipv4first \
  -w /app node:22-bookworm-slim \
  npm start
```

Зависимости ставятся при деплое (`deploy/remote-deploy.sh`); контейнер только запускает API. Старый вариант с `npm install` внутри контейнера при каждом restart больше не нужен.

`TELEGRAM_BOT_TOKEN` задаётся в `/var/www/rehearsals/.env` (не в git). После правки — `docker restart rehearsals-api`.

## Обновление после изменений в git

```bash
cd /var/www/rehearsals
git pull
npm install
npm run build          # если менялись VITE_* — проверьте .env перед сборкой
pm2 restart rehearsals-api
```

## Полезное

- Логи API: `pm2 logs rehearsals-api`
- Статус: `pm2 status`
- Пример nginx: [`nginx.conf.example`](nginx.conf.example)
