# Аудит підключень до БД (read-only)

## Висновок

Усі реальні запити застосунку (браузер + сервер) ідуть **тільки** до `https://aabaapmktkfwmvgcirxb.supabase.co`. Залишились лише неактивні артефакти старого проєкту `cifsbkkebifyyjgsjriq`.

## Перелік джерел підключення

| Джерело | Куди веде | Вердикт |
|---|---|---|
| `src/lib/db.ts` (браузерний клієнт, URL+ключ захардкожені) | aabaapmktkfwmvgcirxb | new |
| `src/lib/db.server.ts` (service role, `GVG_SUPABASE_URL` / `GVG_SUPABASE_SERVICE_ROLE_KEY`) | aabaapmktkfwmvgcirxb | new |
| `src/routes/towers.tsx`, `archive.tsx`, `defenses.tsx`, `battle-power.tsx`, `videos.tsx`, `src/components/TowerModal.tsx`, `HeroPicker.tsx` — усі через `@/lib/db` | new | new |
| `src/lib/gvg-video-bot.server.ts` → `@/lib/db.server` | new | new |
| `src/lib/heroes.functions.ts` → `await import("@/lib/db.server")` (3 місця), Storage upload/signed URL | new | new |
| `src/routes/api/public/telegram/gvg-video-webhook.ts` → `await import('@/lib/db.server')` | new | new |
| `src/routes/api/telegram/gvg-video-setup.ts` — лише Telegram API, БД не чіпає | n/a | new |
| Storage: `defenses.tsx` завантаження скріншотів через `supabase.storage` з `@/lib/db` | new | new |
| Дані в БД: `heroes.icon_url` та `defenses.screenshot_url` — перевірено REST-запитом, домен `aabaapmktkfwmvgcirxb` | new | new |
| Зовнішній fetch: `fastidious.gg/heroes`, `ai.gateway.lovable.dev`, `api.telegram.org` | не БД | n/a |

## Залишкові артефакти старого проєкту (не впливають на запити)

| Артефакт | Стан | Вердикт |
|---|---|---|
| `.env` — `SUPABASE_URL`, `VITE_SUPABASE_URL`, `*_PROJECT_ID`, `*_PUBLISHABLE_KEY` = cifsbkkebifyyjgsjriq | автогенерований Lovable Cloud; жоден файл коду ці змінні не читає, крім generated-клієнтів нижче | old (неактивний) |
| `supabase/config.toml` → `project_id = "cifsbkkebifyyjgsjriq"` | лише для тулінгу міграцій Lovable Cloud | old (неактивний) |
| `src/integrations/supabase/client.ts` (generated) | читає `VITE_SUPABASE_*` → старий проєкт; **не імпортується жодним файлом застосунку** | old, unused |
| `src/integrations/supabase/client.server.ts` (generated) | читає `SUPABASE_SERVICE_ROLE_KEY` → старий проєкт; не імпортується | old, unused |
| `src/integrations/supabase/auth-middleware.ts` (`requireSupabaseAuth`) | ніде не використовується | old, unused |
| `src/integrations/supabase/auth-attacher.ts` → зареєстрований у `src/start.ts` як `functionMiddleware` | **єдиний активний код, що торкається старого клієнта**: на кожному виклику serverFn робить `supabase.auth.getSession()` зі старого клієнта. Це лише читання localStorage, мережевого запиту до старої БД зазвичай немає, дані не читаються/не пишуться | uncertain (косметично) |
| `src/integrations/supabase/types.ts` | тільки типи; схеми в обох проєктах однакові | n/a |

## Що можна прибрати (за бажанням, окремим кроком)

1. Прибрати `attachSupabaseAuth` з `functionMiddleware` у `src/start.ts` — авторизація Supabase у застосунку не використовується.
2. Видалити невикористані generated-файли `client.ts`, `client.server.ts`, `auth-middleware.ts`, `auth-attacher.ts` (типи `types.ts` залишити).

`.env` та `supabase/config.toml` — автогенеровані платформою, редагувати їх не варто; вони не впливають на runtime.
