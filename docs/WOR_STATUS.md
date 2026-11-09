# WoR Collector — production status, 2026-11-09

## Current rate limits

- Global: 1200 requests/minute/IP.
- POST start: 180/10 minutes/IP and 12/10 minutes/machine/IP.
- POST poll: 30/minute/request/IP.
- Telegram reg: unchanged 6/10 minutes/user. Renew/admin-specific quotas unchanged.
- Start formatting errors consume global quota only. Fixed windows remain atomic;
  rejects never extend the window. HTTP 429 includes an integer Retry-After from
  the stored window end, with a conservative full-window fallback if unavailable.
- Tests cover exact boundaries, shared IP, independent machine/request counters,
  window expiration, non-consumption on 400, and Retry-After on compact file errors.
- No device, membership, poll proof, license signature or Telegram approval rule
  changes. Client JSON app_version continues to require major.minor.patch.

## Current artifact update

File endpoints now require only refresh_secret and X-Machine-Code, with the same
active-device/member checks as renew. Certificate expiry and app version are not
checked for these downloads. Missing files, non-current EXE names and revoked
releases return 404; errors are exactly code/message, without status. Bot,
registration, start, poll and renew implementation blocks were compared equal
to the previous commit (UTF-8 source comparison); their protocols are unchanged.

The supplied to-upload/tables.json passed integer version / object dist / string
signature checks and was uploaded immediately. Version 1, 1408 bytes, SHA-256
2a9e903dbfd9bff9af1cfc6df56d2976f38eae9fd9dd249acc06abeff4ba8ca2.
An authenticated admin read-back was byte-for-byte identical. The temporary
operator upload session was revoked and its local credential deleted. Manifest
and EXE have not been read from the user's folder or uploaded; await explicit
owner instruction. No update/table private signing key exists on the server.

The owner admin now has Tables and Release sections with version/date/upload,
and Revoke release. Uploads keep raw bytes and all extra JSON fields; only the
required structure, same-domain filename and EXE SHA-256 are checked. Signatures
are not verified or regenerated. EXE streams use a verified fixed content length.
See WOR_ARTIFACTS.md for masked curl/PowerShell and management instructions.

Production: https://unlimited-tests.lovable.app
Repository: https://github.com/olimpdroid3-blip/unlimited-tests (main).
Lovable project: 33e3ef01-cf16-4bfd-9d4e-cc28e96d83d2 (Tower Keeper).
Publication explicitly authorized by the user. All code changes used local Git;
publication used the native deploy tool. No Lovable AI messages/credits were used.

## Production initialization

- Server-generated Ed25519 private key is encrypted in Supabase Vault.
- Raw private key never entered chat, Git, a browser or the Windows client.
- The one-time bootstrap credential/hash has been removed; bootstrap HTTP
  initialization code has been removed (the former address now rejects requests).
- WOR is enabled through service-only `wor_state.data.settings.enabled=true`.
- Runtime `WOR_ENABLED=false`, when set, still overrides and disables it.

Public license key (32 bytes, lowercase hex):

```text
931905e2ee07fa60bb1558a36e70372267fd9a5e70ab2c4eab7de30d0f390412
```

Independently verified test license for AAAA-BBBB-CCCC-DDDD / Тест / 2030-01-01:

```text
eyJ2IjoxLCJtIjoiQUFBQS1CQkJCLUNDQ0MtRERERCIsIm4iOiLQotC10YHRgiIsImUiOiIyMDMwLTAxLTAxIn0.V1KgmXcFS1h0MqKdDjumu43RZMgHarnOWchzFc5YI3m0-yA-hyfNpX9jXtoPaxnqWONXMxIJT1kmu54eYxmTDA
```

The public key was imported independently through Node crypto/SPKI, the decoded
payload was compared byte-for-byte with the exact required UTF-8 JSON, and the
64-byte signature verified successfully. This key signs licenses only. The
owner's offline update/table signing key remains separate and absent from server.

## Telegram checks

Short-command update: POST /api/wor/start now returns `command` such as
`/reg 6KAM-X9D7` and the clan topic link. The code is random, expires after
10 minutes, is stored hashed, and still requires the initiating member's button
confirmation. The bot reports successful activation after the program receives
its license. `activation_command` is service-only configurable; clients must use
the complete returned command. Legacy deep links and admin login remain supported.

Live Telegram inspection for this update returned status=administrator,
receives_bare_commands=true and no registered commands in default/all-group/chat
scopes. `/reg` was absent in pre-existing source handlers. The saved clan roster
lists only our bot. A second bot's private implementation cannot be inspected
without its access; no second bot is known from the available roster.
Production start returned a bare `/reg` command, expiry=600, interval=3 and the
correct topic link; its proof-based poll returned 202. No live clan message was
sent by the operator test. Local registration/security tests and build passed.

- Existing bot: @gvg_video_index_bot.
- Clan: -1003978316922; actual type supergroup, forum=true.
- Bot's getChatMember status: administrator. can_manage_topics=false: it can use
  the existing open topic, but cannot reopen/manage it. Keep topic 6 open.
- Confirmation destination stays topic 6, «Важлива інформація онлі».
- Owner ID: 302364492; default device limit: 2.
- Existing webhook is unchanged:
  https://project--33e3ef01-cf16-4bfd-9d4e-cc28e96d83d2-dev.lovable.app/api/public/telegram/gvg-video-webhook
- Existing allowed_updates remain message, edited_message, channel_post,
  callback_query. No setWebhook call was made.
- No real confirmation message was sent during operator checks. An owner click
  is still needed to verify the complete live Telegram round trip/admin login.

## Verified production HTTP results

- POST /api/wor/start: 200, valid t.me bot link, no redirect.
- POST /api/wor/poll: 202 pending with correct proof; 403 denied with wrong proof.
- POST /api/wor/renew: 403 revoked with a random device secret.
- GET /api/wor/update, /api/wor/tables, /downloads/Test.exe: 403 revoked with
  random credentials; no redirection to Storage or another domain.
- Extra client body fields: 400 denied.
- GET /wor/admin: 200.
- Existing /, /towers, /videos: 200.
- Existing webhook rejects an incorrect secret header with 401.

No real device was activated by the operator tests. The smoke-test pending
request expires after ten minutes. Actual owner-signed releases/tables have not
been supplied/uploaded; authenticated artifact delivery and Windows-client
signature compatibility still need those actual files. Local tests cover
exact bytes, streaming, SHA-256, limits, owner checks and revocation behavior.

## Runtime correction and checks

Cloudflare Workers supports manual/follow redirect modes, not redirect:error.
WOR upstream requests now use manual mode and reject all non-success statuses,
so redirects remain prohibited. A regression test covers this distinction.
Reference: https://developers.cloudflare.com/workers/runtime-apis/request/

Existing page/bot implementation modules were preserved; only the two routing
entry points were extended. Unrelated bot messages return to legacy routing
without reading the WOR database. All existing webhook secret checks remain.

## Backups and rollback

Three committed WOR-state snapshots existed at final initialization; latest:
2026-11-09 19:59:50 UTC (22:59:50 Moscow). Daily WOR snapshots at 02:15 UTC,
35-day retention. RLS/no client grants protect state, rate, backup tables and
private Storage. Database CAS, stale-CAS rejection, rate limiting and snapshots
were tested using a rolled-back service-role transaction before rollout.

These are WOR-only snapshots in the same database, not a full/off-site project
backup. A full database backup was not made or verified by this task. Original
game/hotel/Telegram tables were not modified. Storage objects and license key
need a separate confidential backup/server-to-server migration strategy, as
explained in WOR_PROTOCOL.md.

Emergency disable, executed only by a trusted database operator:

```sql
update public.wor_state
set data=jsonb_set(data,'{settings,enabled}','false'::jsonb), revision=revision+1
where id;
```

This stops WOR without a code deployment when no runtime environment flag
explicitly forces true. Existing pages/commands retain legacy routing. Keep
WOR records/private files/Vault key during code rollback; do not restore the
shared database. Full rollback uses the last-good hosting version or a reviewed
revert deployment. A strict two-minute full rollback has not been rehearsed.
The source baseline before WOR was 2617b5fb3b4fec368a73fa145508758c0d75f38d;
it is not a verified previous hosting deployment ID.

## Instructions

- WOR_PROTOCOL.md: complete protocol, owner commands, upload and migration.
- wor-curl-examples.ps1: PowerShell 7+ start/poll/renew/update/tables examples.
- The new admin uses Telegram confirmation in the same clan topic. It supports
  members/devices, revoke/ban/limits, release uploads, tables version inspection,
  owner audit and export. Uploads must use the owner's actual offline-signed files.
