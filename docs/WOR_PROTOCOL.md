# WoR Collector: Telegram activation protocol

Implementation contract, 2026-11-09. Production base URL:
`https://unlimited-tests.lovable.app`. Deployment and live verification status
is recorded separately in `WOR_STATUS.md`; an address here alone does not mean
that an endpoint has been deployed.

The feature is off by default. A server `WOR_ENABLED` override takes precedence;
otherwise the service-only `wor_state.data.settings.enabled` must be true.
Bootstrap uses server `WOR_BOOTSTRAP_SHA256` or the service-only settings
`bootstrap_sha256`, never an embedded operator secret. This supports activation
and emergency shutdown without an AI turn or a hosting secret-management UI.
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
3. The program opens `activate_url` (`https://t.me/<existing_bot>?start=<id>`).
   Telegram delivers `/start <id>` to the bot in private chat. The bot checks
   membership and records the initiating Telegram ID. It sends the confirmation
   **only to the clan topic 6**, with the computer code and member display name.
4. Only the initiating user may press its button. The webhook validates its
   secret header; the handler validates chat ID, topic ID, user ID, request TTL,
   pending state, membership and local ban. A button press approves/denies once.
5. The Windows program polls every 3 seconds. The secret is returned only in
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
{"status":"ok","request_id":"<random base64url>","activate_url":"https://t.me/<bot>?start=<request_id>","expires_in":600,"interval":3}
```

Machine codes match `[A-Z2-7]{4}(-[A-Z2-7]{4}){3}`. Versions use numeric
`major.minor.patch` with no leading zeroes or prerelease suffix, maximum 40 chars.

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

Headers: `Authorization: Bearer <refresh_secret>`, `X-Machine-Code: <code>`,
`X-App-Version: <version>`.

Returns the uploaded `manifest.json` **byte for byte**, including whitespace and
UTF-8 encoding. Requires active device, unexpired certificate and clan membership.
The manifest fields remain exactly the agreed contract:

```json
{"version":"1.2.0","min_version":"1.1.0","url":"/downloads/WoR-Collector-1.2.0.exe","sha256":"<64 lowercase hex>","notes":"...","signature":"<base64url>"}
```

The server validates structure, allowed relative filename, version ordering and
EXE SHA-256. It **does not sign** the file or invent/change the owner's signature
format. The Windows program must verify the offline signature using a separately
pinned update public key before trusting any manifest, hash, version or file.
The license public key must not be accepted as the update signing key.

`version_too_old` is returned if X-App-Version is below the current release's
min_version, as in the original error contract. Therefore the owner must plan
manual recovery for clients below min_version: this protocol intentionally does
not grant those clients an unauthenticated download exception.

### GET /downloads/<filename>

Same headers and checks as update; only registered, uploaded release files are
served. The EXE stream is never redirected to Storage. No traversal paths or
arbitrary upstream URLs are accepted. Current upload limit: **50 MiB per EXE**.
This is an explicit Supabase/hosting bound; larger files need a tested private
object storage setup with a higher limit. The upload and download are streamed,
not buffered into the Cloudflare Worker's 128 MiB memory.

### GET /api/wor/tables

Headers: `Authorization: Bearer <refresh_secret>`, `X-Machine-Code: <code>`.
`X-App-Version` is optional and not used by this endpoint.

Returns uploaded `tables.json` **byte for byte**. Same device validity and clan
membership checks. Upload limit: **1 MiB**. No signed-table schema was specified:
the server accepts the owner's JSON object as an opaque artifact and does not
invent a signature field or signed-byte definition. The admin displays `version`,
`v`, or `payload.version` when present, otherwise «не указана». The server does
not sign or reserialize it. The Windows client verifies the owner's offline
signature. An actual signed fixture has not yet been supplied: client
compatibility must be checked with the owner's real file before user release.

### Errors

```json
{"status":"error","code":"denied","message":"Запрос отклонён или уже использован."}
```

Codes: `pending`, `denied`, `expired`, `revoked`, `member_removed`, `device_limit`,
`rate_limited`, `version_too_old`, `server_error`. Pending poll uses the mandated
special 202 body above. Bad fields: HTTP 400 `denied`. Missing owner session:
401 `denied`. Rate limit: 429. Temporary failures/unpublished data: 503
`server_error`. No traceback, request token, game data or personal data is logged.

Limits: global 180/minute/IP; starts 5/10 minutes/IP; admin login starts
3/10 minutes/IP; poll 22/minute/request/IP; renew 10/minute/machine/IP;
bot actions 30/minute/user. Only Cloudflare's CF-Connecting-IP is trusted,
never client-supplied X-Forwarded-For. Requests without it share a fallback
bucket. Store RPCs are service-only and counters are atomic.

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

Release upload: choose the owner's manifest.json and EXE → upload → verify ready
state → Publish. A version/filename cannot be reused. Publishing a lower/equal
version is rejected. Current release cannot be deleted; older releases can.
Failed uploads leave a draft: delete the draft before retrying. The server is a
file distributor: upload authentication is independent of the client's required
cryptographic signature verification. Do not upload unsigned production files.

Tables: choose the owner's signed tables.json → Upload. The new object becomes
current atomically. Its displayed version, size and SHA-256 help inspect the
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
