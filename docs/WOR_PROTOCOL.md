# WoR Collector: Telegram activation protocol

Implementation contract, 2026-11-09. Production base URL:
`https://unlimited-tests.lovable.app`. Deployment and live verification status
is recorded separately in `WOR_STATUS.md`; an address here alone does not mean
that an endpoint has been deployed.

The feature is off by default. A server `WOR_ENABLED` override takes precedence;
otherwise the service-only `wor_state.data.settings.enabled` must be true.
The production key has been initialized. The one-time bootstrap HTTP handler
and operator credential have been removed. Production public artifacts and
verification limits are recorded in WOR_STATUS.md.
An isolated preview must use a separate database, test bot and test clan forum;
do not repoint the live bot at a review branch.

## Identity and confirmation

No Supabase Auth accounts are created. The immutable member identifier is the
decimal Telegram user ID, stored as a string. Username is never an identifier.
Owner: `302364492`. Clan supergroup: `-1003978316922`. Confirmation topic: `6`,
«Важлива інформація онлі», https://t.me/c/3978316922/6.

1. The Windows program generates 32 random bytes, encodes them as unpadded
   base64url to obtain `poll_secret`. `poll_hash` is unpadded base64url of SHA-256
   over the **UTF-8 text of poll_secret**, not its decoded random bytes.
2. `start` creates a random 32-byte request ID, valid for 600 seconds.
3. Preferred activation: the program displays the server-provided `command`,
   such as `/reg K7M2-9Q4X`, and a Copy button. The member pastes it into clan
   topic 6. No bot mention is required while this bot remains a clan admin.
   The program must not hardcode `/reg`: read the complete `command` field.
   The short code is random (40 bits), expires with the request in 10 minutes,
   is stored only as a SHA-256 hash, and can be claimed only once by a member.
   The program can alternatively open `activate_url` (`https://t.me/<existing_bot>?start=<id>`).
   Telegram delivers `/start <id>` to the bot in private chat. The bot checks
   membership and records the initiating Telegram ID. It sends the confirmation
   **only to the clan topic 6**, with the computer code and member display name.
4. Only the initiating user may press its button. The webhook validates its
   secret header; the handler validates chat ID, topic ID, user ID, request TTL,
   pending state, membership and local ban. A button press approves/denies once.
5. The Windows program polls every 3 seconds. After successful license issuance
   the bot reports `✅ Активировано: <имя>, компьютер …<последние 4 символа>` in
   topic 6. Approval alone does not falsely report that a device was activated.
   The secret is returned only in
   the first successful response. A lost successful response is deliberately
   unrecoverable: ask the owner to revoke that slot and start again.

The bot needs administrator status in the clan supergroup for reliable
`getChatMember` queries for other members. It needs permission to send messages
in topic 6. The topic must remain open. It does not need permission to create
topics. Do not change privacy mode, other topic permissions or existing bot
webhook routing for this feature. The existing webhook secret verification is
retained. Existing tower, walkthrough, scouting and video handlers are retained.

Member status `creator`, `administrator`, `member`, or `restricted` with
`is_member=true` is accepted. `left`, `kicked`, unknown statuses and bot accounts
are rejected. Every renewal consults membership, with a server cache of at most
180 seconds. Membership is also checked before issuing licenses and downloads.
Telegram/network failures produce `server_error`, never a successful renewal.
Local bans and revocations bypass this cache and apply immediately.

Display name: custom title → member tag → Telegram profile display name →
`Участник <id>`. This is a label, not an identity or a game/account identifier.

## HTTP

HTTPS only. JSON is UTF-8. No endpoint redirects to a different domain; the
Telegram URL is returned as a JSON field and explicitly opened by the program.
Downloads are streamed by the site's server from a private bucket.

### POST /api/wor/start

Exactly these fields; extra fields, including game data, are rejected:

```json
{"machine_code":"AAAA-BBBB-CCCC-DDDD","app_version":"1.0.0","poll_hash":"<SHA-256 of poll_secret, base64url>"}
```

```json
{"status":"ok","request_id":"<random base64url>","activate_url":"https://t.me/<bot>?start=<request_id>","expires_in":600,"interval":3,"command":"/reg K7M2-9Q4X","chat_url":"https://t.me/c/3978316922/6"}
```

Machine codes match `[A-Z2-7]{4}(-[A-Z2-7]{4}){3}`. Versions use numeric
`major.minor.patch` with no leading zeroes or prerelease suffix, maximum 40 chars.

`command` and `chat_url` are additive fields; poll/renew/license formats remain
unchanged. `activate_url` is retained for existing clients and web administration.
Registration is accepted only from the configured clan and topic. Another user
cannot take over a claimed request or press its confirmation button. Wrong
codes are limited to six attempts per user per ten minutes, in addition to the
general bot limit. The code alphabet excludes 0/1/I/O; the example is illustrative,
not a fixed or reusable code. `/reg@<our_bot> <code>` is supported as a fallback;
mentions of another bot and unrelated commands remain on their old routing.

The server operator can change `settings.activation_command` in the closed
WOR state to another unused lowercase command word **without a leading slash**;
the next start response and bot parser use it immediately. Existing owner
command words are reserved. Check source handlers and Telegram command menus
before assigning a new word. No client update or setMyCommands change is needed.

### POST /api/wor/poll

```json
{"request_id":"<request_id>","poll_secret":"<32 random bytes as base64url>"}
```

- `202 {"status":"pending"}`
- `200 {"status":"ok","license":"<certificate>","refresh_secret":"<32 random bytes as base64url>","valid_days":7}`
- `403` with `denied`, `expired`, `device_limit`, or `member_removed`.

The server stores only `poll_hash` and `refresh_hash`. Fixed-length hashes are
compared using a constant-time primitive. Approved requests are closed atomically
with device creation. Concurrent polls cannot issue twice or bypass device limits.
Default limit: 2 active devices, including registered devices with an expired
license. Revoke an obsolete device to release its slot. A machine code may have
only one active registration.

### POST /api/wor/renew

```json
{"machine_code":"AAAA-BBBB-CCCC-DDDD","app_version":"1.0.0","refresh_secret":"<secret>"}
```

`200 {"status":"ok","license":"<new certificate>"}`. Invalid/revoked device
credentials: `403 revoked`. A local ban or missing clan membership:
`403 member_removed`. Renewal remains possible after certificate expiration
provided the device and membership are still active.

### GET /api/wor/update

Headers: `Authorization: Bearer <refresh_secret>`, `X-Machine-Code: <code>`.
X-App-Version is not required or checked. Device authentication is the same as
renew: matching refresh hash, active/non-revoked registration, active member and
clan membership. Certificate expiration does not prevent these downloads.

Returns the current uploaded manifest.json byte for byte. No current release
or missing file: HTTP 404. Required upload fields are version, url, sha256 and
signature; min_version/notes are optional and extra fields are preserved.
The URL must point to /downloads/<safe filename>.exe on this same HTTPS domain
(relative or absolute). The server does not verify signatures, sign files,
reorder fields, change values or rewrite JSON. The client's separate pinned
offline public key verifies the owner's signature.

### GET /downloads/<filename>

Same two headers/authentication. Only the filename in the **current** manifest
is served. Previous, absent and revoked releases return 404. Response type is
application/octet-stream, Content-Length is the verified file byte count, and
there are no redirects to Storage or other domains. Cloudflare FixedLengthStream
preserves a fixed byte count while streaming. EXE upload limit: 50 MiB.

Before release upload, the admin checks required manifest fields, exact EXE
filename against the URL, and SHA-256 of the selected file. The server repeats
filename/SHA-256 checks and publishes only a complete upload. The actual bytes
of the signed manifest and EXE remain unchanged. The owner may replace a release
with the same version or filename; immutable private object paths retain history,
while the current release pointer changes atomically. Old paths stop being served.

### GET /api/wor/tables

Same two headers/authentication. Returns the current tables.json byte for byte,
including its original formatting/BOM when present. Missing file: HTTP 404.
Upload requires a JSON object with integer version, object dist and string
signature. Other fields are accepted and preserved. No signature verification
or reserialization occurs on the server. Upload limit: 1 MiB.

### File endpoint errors

These three endpoints use exactly `{"code":"...","message":"..."}`.
Missing/unpublished file: 404 not_found; bad device credentials: 403 revoked;
removed/banned member: 403 member_removed; malformed input: 400 denied;
rate limiting: 429 rate_limited; upstream failure: 503 server_error.
The activation endpoints below keep their original error format.

### Errors

```json
{"status":"error","code":"denied","message":"Запрос отклонён или уже использован."}
```

Codes: `pending`, `denied`, `expired`, `revoked`, `member_removed`, `device_limit`,
`rate_limited`, `version_too_old`, `server_error`. Pending poll uses the mandated
special 202 body above. Bad fields: HTTP 400 `denied`. Missing owner session:
401 `denied`. Rate limit: 429. Temporary failures/unpublished data: 503
`server_error`. No traceback, request token, game data or personal data is logged.

Limits: global 1200/minute/IP; validated starts 180/10 minutes/IP plus
12/10 minutes/machine/IP; admin login starts 3/10 minutes/IP;
poll 30/minute/request/IP; renew 10/minute/machine/IP;
bot actions 30/minute/user. Only Cloudflare's CF-Connecting-IP is trusted,
never client-supplied X-Forwarded-For. Requests without it share a fallback
bucket. Store RPCs are service-only and counters are atomic.

Start validates Content-Type, JSON, exact fields, machine_code, app_version and
poll_hash before consuming either start quota. Rejected formatting still counts
toward the global budget. The per-machine/IP quota is checked before the IP-only
start quota, so repeat attempts from one blocked machine do not exhaust the
shared start-IP quota. Windows are fixed from their first request; rejected
requests do not extend the window. HTTP 429 includes Retry-After as integer
seconds to that counter window end, without changing JSON response fields.
The client should keep polling its existing request, honor Retry-After, and
avoid calling start automatically on each retry. Telegram registration remains
6 attempts per 10 minutes per Telegram ID; no membership/device proof is relaxed.

## Ed25519 licenses

Sign the exact UTF-8 bytes below, with no whitespace and this key order:

```json
{"v":1,"m":"AAAA-BBBB-CCCC-DDDD","n":"Тест","e":"2030-01-01"}
```

Certificate = `base64url(payload) + "." + base64url(signature)`, no padding.
Normal expiry is today's UTC date + 7 calendar days, valid through that day's
end in UTC. The test certificate deliberately has the requested fixed expiry.

The production key is generated in the server runtime. PKCS#8 material is kept
encrypted in Supabase Vault, accessible only through a service-role-only RPC.
No license private key enters browser code, Windows client, Git, chat or logs.
The server has **no offline update private key**. Limit service-role/management
access; administrators with those credentials can access license material.
The public key and test certificate are recorded only after real server generation
and independent verification, in `WOR_STATUS.md`.

## Owner commands and web administration

Commands are accepted only in a **private chat with the existing bot** and only
from ID 302364492. Group commands continue through the existing bot unchanged.

```text
/devices                       list every device
/devices 123456789              list that member's devices
/revoke AAAA-BBBB-CCCC-DDDD      revoke one device (UUID also accepted)
/ban 123456789                  ban member and revoke all their devices
/unban 123456789                allow new activation; revoked devices stay revoked
/limit 123456789 2              set member limit (1–10)
/limit default 2                set default limit (1–10)
```

`/wor/admin`: Telegram confirmation in the **same topic 6**, owner-only. The
browser generates its own poll_secret; successful confirmation creates a
30-minute Secure, HttpOnly, SameSite=Strict cookie. Every modifying browser
request requires both exact same-origin Origin and a session CSRF token.

The admin shows members/IDs, devices, issue/renewal dates, versions, statuses,
limits, ban/revoke controls, immutable release uploads, current tables and audit.

Release section: choose the owner's manifest.json and EXE → upload → Publish.
Current version and upload/publication date are displayed. Revoke release
unpublishes it immediately without deleting its private backup objects; subsequent
manifest/EXE requests return 404. The current release must be revoked before deletion.
Failed uploads leave a draft: delete the draft before retrying. The server is a
file distributor: upload authentication is independent of the client's required
cryptographic signature verification. Do not upload unsigned production files.

Tables: choose the owner's signed tables.json → Upload. The new object becomes
current atomically. Its displayed version, date, size and SHA-256 help inspect the
upload; View opens the original bytes. Previous objects are retained for backup.

## Backups and moving hosts

- Daily database snapshots at **02:15 UTC** (05:15 Moscow), retention 35 days.
  Snapshot access is service-only. Manual snapshot and JSON export are in admin.
- These snapshots share the source database: they are **not** an off-site
  disaster backup. Copy an encrypted export to a separate location after changes.
  No external backup destination was provided or silently configured.
- Export includes membership IDs, limits, refresh hashes, device records,
  license expiry dates, release/table object paths, settings and audit. It excludes
  browser sessions, pending activation requests, raw device secrets and private key.
- Copy **all objects in the private wor-private bucket** as well. Database
  backups do not include Storage file bytes. Preserve immutable object paths and
  verify SHA-256 before/after transfer. Never make the bucket public.
- Keep the owner's offline signed manifests/EXEs/tables as a separate source copy.
  Keep the offline update key backed up separately, encrypted, on the owner's side.
- For a new web host using the same database: transfer server environment secrets
  securely; keep the API hostname if possible, configure HTTPS and streaming;
  use the same Vault key and device state. Change the existing bot webhook URL
  only after testing that every legacy route is present.
- For a new database: apply schema without replacing existing data, restore
  exported state with sessions/requests empty, copy private Storage objects and
  schedule snapshots. Transfer the license key **server to server**, using the
  source `wor_license_key` RPC and destination `wor_license_key(candidate)` over
  an authenticated confidential channel. Never paste it in chat, a browser form,
  a command argument or a public backup. An encrypted Vault SQL dump alone is not
  portable without its external encryption key. Verify the same public key before
  switching hosts; generating a new key would invalidate existing client trust.
- Test renewal on one consenting device before switching DNS/webhook. Keep old
  hosting until verification completes. An in-progress activation/admin login
  must be restarted after migration. Existing refresh secrets continue to work
  because their hashes and Telegram IDs are preserved.

## User-facing confirmation text

Программа передаёт только код компьютера, версию программы и секрет устройства.
Данные игры, имя персонажа, игровой аккаунт и пароли не передаются. Для проверки
доступа сохраняется ваш Telegram ID и отображаемое имя. Подтверждайте только
свой запрос. Доступ может отозвать владелец клана; уже выданная офлайн-лицензия
действует до указанной даты — максимум 7 дней.
