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

**Google Docs:** ссылки на сцены работают через **публичный** документ («все, у кого есть ссылка»). Знаки и режим «Учить текст» — из загруженного `.docx`. Вход в Google и `VITE_GOOGLE_CLIENT_ID` **не нужны**. Опционально `GOOGLE_DOCS_REFRESH_TOKEN` на сервере — для закрытых документов.

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

С Windows: `deploy.bat` (коммит + push + деплой) или `deploy.bat --skip-git` если код уже на GitHub.

Проверка доступности сервера: `deploy-check.bat`.

Локальные настройки SSH (другой порт/IP): скопируйте `deploy/deploy.local.example.bat` → `deploy/deploy.local.bat` (файл в `.gitignore`).

### Connection timed out (SSH / scp)

Если `deploy.bat` падает на `Connection timed out` **до** строк `Running deploy on server...`:

| Симптом | Что значит |
|---------|------------|
| ping OK, порт 22 FAIL | VPS включён, но **SSH закрыт** или сервис не слушает порт |
| ping OK, порты 22/80/443 FAIL | Сервер **не обслуживает** трафик (остановлен, файрвол, завис) |
| ping FAIL | Неверный IP или VPS **выключен** у хостера |

**Это не ошибка скрипта деплоя** — с вашего ПК нельзя достучаться до `45.153.71.162`.

**Что сделать в панели TimeWeb:**

1. **Серверы → VPS** — статус «Работает»; при «Выключен» — включить.
2. **Сеть / Firewall** — разрешить входящий **TCP 22** (и 80/443 для сайта).
3. **Консоль / VNC** (если SSH недоступен):
   ```bash
   systemctl status ssh
   systemctl start ssh
   systemctl status nginx
   ufw status
   curl -s http://127.0.0.1:3001/api/health
   ```
4. Проверить **оплату** — просроченный VPS часто блокирует все порты кроме ping.

После восстановления SSH: `deploy.bat --skip-git`.

**Альтернатива:** GitHub Actions workflow `Deploy production` (`.github/workflows/deploy-prod.yml`). В репозитории → Settings → Secrets:

- `DEPLOY_SSH_HOST` = `45.153.71.162`
- `DEPLOY_SSH_USER` = `root`
- `DEPLOY_SSH_KEY` = содержимое приватного ключа `rehearsals_vps`
- `DEPLOY_SSH_PORT` = `22` (опционально)

Запуск: Actions → Deploy production → Run workflow.

**Важно:** успешный run должен занимать **несколько минут** (npm install + build). Если job завершился за ~30 секунд — деплой, скорее всего, не выполнился (старый workflow искал скрипт не там). После обновления workflow в логах SSH должны быть строки `git pull`, `npm run build` и `Deployed commit on server:`.

Если и GitHub не может подключиться — VPS точно недоступен снаружи.

### Порт 22 OK, но SSH «висит» на handshake

Если `deploy-check.bat` показывает **OK** на шаге 2 и зависает на шаге 3:

1. **Выключите VPN** (HideMy.Name и др.) — TCP может проходить, а SSH-обмен обрывается или идёт минутами.
2. **Первое подключение** иногда ждёт 30–60 сек (GSSAPI/DNS на сервере) — `deploy.bat` теперь отключает GSSAPI и ставит таймаут 25 сек.
3. **Ключ не на сервере** — через **Консоль/VNC** в TimeWeb:
   ```bash
   mkdir -p ~/.ssh && chmod 700 ~/.ssh
   echo 'ВАШ_ПУБЛИЧНЫЙ_КЛЮЧ' >> ~/.ssh/authorized_keys
   chmod 600 ~/.ssh/authorized_keys
   ```
   Публичный ключ: `%USERPROFILE%\.ssh\rehearsals_vps.pub` (или `ssh-keygen -y -f rehearsals_vps`).
4. **Подробный лог** (куда именно зависает):
   ```bat
   "%SystemRoot%\System32\OpenSSH\ssh.exe" -vvv -i %USERPROFILE%\.ssh\rehearsals_vps root@45.153.71.162
   ```

## Полезное

- Логи API: `pm2 logs rehearsals-api`
- Статус: `pm2 status`
- Пример nginx: [`nginx.conf.example`](nginx.conf.example)
