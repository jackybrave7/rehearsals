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

**Google Docs:** `VITE_GOOGLE_CLIENT_ID` подставляется **на этапе сборки**. Задайте его в `.env` **до** `npm run build` и добавьте прод-домен в [Google Cloud Console](https://console.cloud.google.com/) → Authorized JavaScript origins.

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
  sh -c 'rm -rf node_modules && npm install --omit=dev && npm start'
```

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
