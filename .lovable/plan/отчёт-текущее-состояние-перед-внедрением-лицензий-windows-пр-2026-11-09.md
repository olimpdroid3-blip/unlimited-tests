# Отчёт: текущее состояние перед внедрением лицензий Windows-программы

Только анализ, код не менялся. Если подтвердите, следующим шагом можно спроектировать `/wor/activate` и API лицензий.

## 1. Стек
- Frontend: React 19, TanStack Start 1.168 (TanStack Router, SSR), Vite 7, Tailwind v4 (`src/styles.css`), shadcn/Radix.
- Backend: server functions TanStack Start (`createServerFn`, файлы `*.functions.ts` / `*.server.ts`) и server routes в `src/routes/api/**`, исполняются на Cloudflare Workers (workerd, не Node).
- БД: внешний Supabase-проект `aabaapmktkfwmvgcirxb`. Браузерный клиент: `src/lib/db.ts` (publishable key, сессия в localStorage). Серверный клиент: `src/lib/db.server.ts` (service role из `GVG_SUPABASE_*`). Встроенный Cloud-проект (`src/integrations/supabase/*`) по правилу проекта не используется.

## 2. Доступ к сайту
- Входа для членов альянса нет: Supabase Auth нигде не вызывается (кроме автосгенерированного `src/integrations/supabase/*`), общего пароля, PIN и `beforeLoad`-редиректов в `src/routes` нет. Все страницы (`towers`, `archive`, `defenses`, `videos`, `battle-power`, `mobs`, ...) открыты всем.
- Единственный закрытый раздел — `/telegram-admin` (`src/routes/telegram-admin.tsx`). Его защищают `src/lib/telegram-admin.server.ts` и `src/lib/telegram-admin.functions.ts`: на сервере проверяется секрет `TELEGRAM_ADMIN_PASSWORD`, затем выдаётся HMAC-подписанная сессия на 30 минут. Ключ подписи — `TELEGRAM_ADMIN_SESSION_SECRET`, а если его нет, ключ получается из пароля (`session:<password>`).
- localStorage используется только для темы (`src/lib/theme.ts`) и для сессии Supabase-клиента, которая сейчас пустая.

## 3. Аккаунты и роли
- На сайте нет личных аккаунтов, таблиц `profiles` или `user_roles` и роли администратора. Роль «админ» — это только один общий пароль на `/telegram-admin`.
- В Telegram личность участника — это Telegram user ID плюс `custom_title` или `tag` из `getChatMember` (`src/lib/tower-form.ts`: `resolveMemberNickname`, `resolveTowerNickname`). Действия только для админов (пробито, удаление) проверяют статус administrator/creator в группе. На сайте этих проверок нет.

## 4. Server routes и Edge Functions
- `src/routes/api/public/telegram/gvg-video-webhook.ts` — публичный webhook Telegram. Он проверяет secret-заголовок (без него отвечает 401) и передаёт обработку модулям `src/lib/gvg-*.server.ts` и `awakening-telegram.server.ts`.
- `src/routes/api/telegram/gvg-video-setup.ts` (GET/POST), `gvg-pin-towers.ts`, `gvg-pin-bp.ts`, `gvg-tower-keyboard.ts` — служебные эндпоинты не под `/api/public` (снаружи отвечали 403).
- Server functions: `awakening.functions.ts`, `heroes.functions.ts`, `mob-recognition.functions.ts`, `tower-notify.functions.ts`, `telegram-admin.functions.ts`.
- Edge Function: `supabase/functions/awakening-report` (`index.ts` и `handler.mjs`, Deno). Через service role вызывает RPC `/rest/v1/rpc/<name>` с таймаутом 10 с. Ещё есть внешняя `telegram-mtproto-send`, её кода в репозитории нет.

## 5. Storage buckets
- `defense-screenshots` (private) — скриншоты и все JSON-состояния бота (`STATE_BUCKET` в `gvg-tower-form`, `gvg-pinned-*`, `tower-origin`, `gvg-tower-requests`, `gvg-bot-messages`, `gvg-pending-defense-form`), а также `awakening.server.ts`, `screenshot-upload.ts`, `routes/defenses.tsx`.
- `hero-icons` (private) — иконки героев.
- Под бинарники ничего нет. Для них нужен отдельный приватный bucket, например `wor-releases`.

## 6. Где встраивать `/wor/activate` и API лицензий
- Страница: новый маршрут `src/routes/wor.activate.tsx` (URL `/wor/activate`). Защищённые данные он получает только через server function.
- API для самой программы: `src/routes/api/public/wor/activate.ts`, `.../validate.ts`, `.../download.ts`. Префикс `/api/public` обязателен, потому что программа вызывает их без входа на сайт. Поэтому проверку нужно делать в каждом обработчике: Zod-валидация, ключ лицензии и привязка к устройству, ответ с подписью (Ed25519/HMAC), ограничение частоты запросов.
- Данные: новые таблицы `licenses` и `license_activations` во внешней БД (через psql по правилу проекта). Включить RLS без анонимного доступа, работать только через `db.server.ts`.
- Если активацию должны делать только члены альянса, нужна настоящая идентификация. Общий пароль или Telegram ID (например, Telegram Login или одноразовый код от бота) не годятся для отзыва доступа у отдельного человека.
- Не трогать для этого `gvg-video-webhook.ts` и `/telegram-admin`: сессия `/telegram-admin` построена на общем пароле.

## 7. Production URL
- https://unlimited-tests.lovable.app (стабильный: `project--33e3ef01-cf16-4bfd-9d4e-cc28e96d83d2.lovable.app`). Webhook Telegram сейчас указывает на dev/preview URL, а не на production.

## 8. Ограничения хостинга для бинарников
- Workers не подходят для отдачи больших файлов через себя: есть лимиты на размер ответа, CPU и память, и нет файловой системы. Класть `.exe` в `public/` нельзя, он станет публично доступен.
- Безопасная схема: бинарник лежит в приватном bucket Storage. Endpoint `/api/public/wor/download` проверяет лицензию и возвращает короткоживущий signed URL (`createSignedUrl`, 60–300 с), а не сам файл.
- Секреты подписи лицензий хранить в project secrets и читать только внутри обработчиков. Изменения кода начинают работать в production только после Publish, изменения БД — сразу.

## Открытые вопросы перед реализацией
- Кто выдаёт лицензии: админ вручную, или любой член альянса через Telegram?
- Сколько устройств разрешено на один ключ, есть ли срок действия и нужна ли офлайн-проверка?
