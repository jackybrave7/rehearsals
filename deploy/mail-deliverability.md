# Доставляемость писем (Яндекс, Mail.ru)

Письма регистрации уходят через SMTP TimeWeb (`support@rehears.ru`). Если на **Яндексе** письмо в «Спаме», а на **Mail.ru** не приходит — почти всегда не хватает **DKIM** и/или домен не добавлен в постмастеры.

## Текущая проверка DNS (rehears.ru)

| Запись | Нужно | Статус |
|--------|--------|--------|
| SPF | `v=spf1 include:_spf.timeweb.ru ~all` | обычно есть |
| DMARC | `v=DMARC1; p=none; rua=mailto:support@rehears.ru` | обычно есть |
| **DKIM** | TXT `mail._domainkey.rehears.ru` (из панели TimeWeb) | **часто отсутствует** |

Проверка с сервера:

```bash
dig +short TXT rehears.ru
dig +short TXT mail._domainkey.rehears.ru
dig +short TXT _dmarc.rehears.ru
```

## 1. DKIM в TimeWeb (обязательно)

1. Панель TimeWeb → **Почта** → домен `rehears.ru` → **DKIM** (или «Аутентификация»).
2. Включите DKIM для ящика `support@rehears.ru`.
3. Скопируйте **TXT-запись** для поддомена `mail._domainkey` (или как указано в панели).
4. DNS домена → добавьте запись → подождите 15–60 минут.
5. В панели TimeWeb нажмите «Проверить».

Без DKIM Mail.ru часто **молча отбрасывает** письма, Яндекс кладёт в спам.

## 2. Постмастер Mail.ru

1. https://postmaster.mail.ru/ → войти.
2. **Добавить домен** `rehears.ru`.
3. Подтвердить владение (файл уже на сайте):
   - https://rehears.ru/mailru-verification120c4ec91218f839.html
4. После проверки — смотреть статистику доставки и ошибки.

## 3. Постмастер Яндекса

1. https://postmaster.yandex.ru/ → добавить `rehears.ru`.
2. Подтвердить домен (DNS TXT или мета-тег).
3. Убедиться, что SPF и DKIM «зелёные».

## 4. Настройки `.env` на сервере

```env
SMTP_HOST=smtp.timeweb.ru
SMTP_PORT=465
SMTP_SECURE=1
SMTP_USER=support@rehears.ru
SMTP_PASS=...
SMTP_FROM=support@rehears.ru
APP_URL=https://rehears.ru
```

`SMTP_FROM` должен совпадать с `SMTP_USER` (тот же ящик).

Опционально — подпись DKIM на стороне приложения (если TimeWeb выдал приватный ключ):

```env
SMTP_DKIM_DOMAIN=rehears.ru
SMTP_DKIM_SELECTOR=mail
SMTP_DKIM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

Обычно достаточно DKIM на стороне SMTP TimeWeb без переменных в `.env`.

После правок: `docker restart rehearsals-api`.

## 5. Тест отправки

На сервере (из каталога проекта, с загруженным `.env`):

```bash
node scripts/test-smtp.mjs ваш@yandex.ru
node scripts/test-smtp.mjs ваш@mail.ru
```

Смотрите логи API: `[mail] sent` с `accepted` / `rejected`.

## 6. Если всё ещё спам на Яндексе

- Попросите получателя: «Не спам» + добавить `support@rehears.ru` в контакты.
- Не меняйте `SMTP_FROM` на другой домен.
- Проверьте, что ссылка в письме ведёт на `https://rehears.ru/verify-email?...` (не localhost).
