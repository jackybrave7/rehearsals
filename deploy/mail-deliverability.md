# Доставляемость писем (Яндекс, Mail.ru)

Письма регистрации уходят через SMTP TimeWeb (`support@rehears.ru`). **Mail.ru часто молча отбрасывает** письма без корректного **DKIM**.

## Диагностика (быстро)

На сервере или локально:

```bash
node scripts/check-mail-dns.mjs rehears.ru
```

В админке: **Статистика платформы** → блок **«Доставка на Mail.ru»**.

## Текущее состояние DNS (проверено)

| Запись | Статус |
|--------|--------|
| SPF `v=spf1 include:_spf.timeweb.ru ~all` | ✓ есть |
| DMARC `_dmarc.rehears.ru` | ✓ есть (`p=none`) |
| DKIM `mail._domainkey` | ✗ **нужен для писем с VPS** |
| DKIM `dkim._domainkey` | ⚠ есть, но **без `v=DKIM1`** — Mail.ru может не принять |

Письма с API (nodemailer → smtp.timeweb.ru) **не подписываются** почтовым ящиком TimeWeb — нужна **своя DKIM-подпись** в приложении + TXT `mail._domainkey`.

## 1. DKIM для писем с сервера (обязательно)

На VPS в каталоге проекта:

```bash
cd /var/www/rehearsals
node scripts/setup-smtp-dkim.mjs rehears.ru --write-env
docker restart rehearsals-api
```

Скрипт выведет TXT для DNS. В **TimeWeb → Домены → rehears.ru → DNS**:

- Тип: **TXT**
- Хост: **`mail._domainkey`**
- Значение: `v=DKIM1; k=rsa; p=…` (одной строкой, из вывода скрипта)

Подождите 15–60 минут, затем:

```bash
node scripts/check-mail-dns.mjs
node scripts/test-smtp.mjs ваш@mail.ru
```

## 2. Постмастер Mail.ru

1. https://postmaster.mail.ru/ → войти.
2. **Добавить домен** `rehears.ru`.
3. Подтвердить файлом: https://rehears.ru/mailru-verification120c4ec91218f839.html
4. В разделе защиты домена убедиться, что SPF и DKIM зелёные.
5. API статистики: https://help.mail.ru/developers/postmaster/api/ (`/ext-api/troubles-list/`).

## 3. Исправить старую запись `dkim._domainkey` (желательно)

В DNS сейчас значение начинается с `k=rsa;p=…` без `v=DKIM1`. В TimeWeb отредактируйте запись:

```
v=DKIM1; k=rsa; p=…тот же ключ…
```

## 4. DMARC (позже)

Для «Надёжного отправителя» Mail.ru нужен `p=quarantine` или `p=reject`. Пока можно оставить `p=none`, если DKIM настроен.

## 5. Настройки `.env`

```env
SMTP_HOST=smtp.timeweb.ru
SMTP_PORT=465
SMTP_SECURE=1
SMTP_USER=support@rehears.ru
SMTP_PASS=...
SMTP_FROM=support@rehears.ru
APP_URL=https://rehears.ru

SMTP_DKIM_DOMAIN=rehears.ru
SMTP_DKIM_SELECTOR=mail
SMTP_DKIM_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
```

`SMTP_FROM` = `SMTP_USER`. После правок: `docker restart rehearsals-api`.

**Не добавляйте `List-Unsubscribe`** в транзакционные письма (регистрация, сброс пароля) — Mail.ru может классифицировать их как рассылку и отклонять с `550 spam message rejected`.

## 6. Тест

```bash
node scripts/test-smtp.mjs ваш@yandex.ru
node scripts/test-smtp.mjs ваш@mail.ru
node scripts/send-registration-test.mjs ваш@mail.ru
node scripts/capture-dkim-message.mjs
```

В логах API: `[mail] sent` с `accepted`.
