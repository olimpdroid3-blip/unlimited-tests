# Отчёт: имена участников и права в Telegram-боте (без изменений кода)

Код не менялся. Этот отчёт — только ответ на вопрос; по нему нечего «утверждать», кроме согласия, что изменения не нужны.

## 1. Как бот формирует имя
- **Вежі (thread 8) и «Додати код» (thread 4):** имя = только `custom_title` из `getChatMember`. Без title — отказ `NO_TITLE_TEXT`. username / first_name / last_name не используются.
- **Видео (индексация):** автор = `custom_title`; если его нет — строка «Невідомий автор». Отдельно в `telegram_username` пишется `from.username ?? from.first_name` (только как служебное поле, не как автор).
- **Админка /telegram-admin:** `display_name` и `username` берутся готовыми из таблицы `telegram_broadcast_recipients`; заполняет её внешняя MTProto Edge Function, её кода в проекте нет.

## 2. Member tag обычных участников
Не поддерживается. Нигде в коде нет чтения тега участника (поля `tag` и аналогов). У обычного участника бот видит только `status: "member"` — имя такой человек не получает.

## 3. Custom title администраторов
Поддерживается — это единственный источник ника (`status` = `administrator` или `creator` + непустой `custom_title`).

## 4. Какие поля Telegram API реально читаются
- `getChatMember` → `result.status`, `result.custom_title` (одинаково для всех; у обычного участника `custom_title` в Bot API отсутствует).
- Из update: `from.id`, `from.username`, `from.first_name` (видео-вебхук), `message.chat.id/username`, `message_thread_id`, `message_id`, `callback_query.from.id`, `callback_query.message.*`.
- `last_name` объявлен в типе `resolveUploader`, но не используется.

## 5. Что доступно обычному участнику
- **Admin-only:** «➕ Додати» (вежа), «Додати код» (thread 4), «💥 Пробито», «🗑 Видалити запис» — отказ «доступне лише адміністраторам».
- **Доступно всем:** «🏰 Всі вежі» (`tower:list`) — проверки прав нет, только проверка нужного чата; ссылка «Вежі — Дзеркала»; загрузка видео индексируется у всех (автор будет «Невідомий автор»).

## 6. Где это определено
- `src/lib/tower-form.ts` — `resolveAdminNickname()`: проверка `administrator`/`creator`, затем `custom_title`; тексты `NOT_ADMIN_TEXT`, `NO_TITLE_TEXT`.
- `src/lib/gvg-tower-form.server.ts` — `startTowerForm()` (getChatMember + resolveAdminNickname); обработчики breach/delete callbacks (проверка `status` в `["administrator","creator"]`); ветка `CB_TOWER_LIST` без проверки прав.
- `src/lib/gvg-pending-defense-form.server.ts` — `startPendingDefenseForm()` (то же через resolveAdminNickname).
- `src/lib/gvg-video-bot.server.ts` — `resolveUploader()` (custom_title или «Невідомий автор»).
- `src/routes/api/public/telegram/gvg-video-webhook.ts` — запись `telegram_username` и `telegram_uploader_custom_title`.
- `src/lib/telegram-admin.server.ts` — только читает `display_name`/`username` из таблицы.

## Bot API и MTProto
- Весь бот (вежі, коды, видео) работает через **Bot API** (`getChatMember`).
- **MTProto** используется только внешней Edge Function `telegram-mtproto-send` (синхронизация участников, рассылка). Её кода в проекте нет, поэтому как она собирает `display_name` (и читает ли теги/титулы), отсюда проверить нельзя. Telethon в проекте не используется.
