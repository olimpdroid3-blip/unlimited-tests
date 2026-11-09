# WoR Telegram activation — review branch, 2026-11-09

Repository: `https://github.com/olimpdroid3-blip/unlimited-tests`.
This is the connected Tower Keeper alliance website repository: local origin and
Lovable project `33e3ef01-cf16-4bfd-9d4e-cc28e96d83d2` share base commit
`2617b5fb3b4fec368a73fa145508758c0d75f38d`.
Review branch: `feature/wor-telegram-activation-review`. Target for eventual
review: `main`. The user subsequently explicitly authorized production
publication, with no Lovable AI-credit usage. GitHub synchronization and native
`lovable_deploy_project` are the publishing path; no AI messages are sent.

## Implemented locally

- start / poll proof-of-possession flow with single-use 10-minute requests.
- Telegram ID ownership, fresh clan membership checks with 180-second cache.
- Confirmation messages only in chat `-1003978316922`, topic `6`.
- Request initiator alone can approve; owner ID `302364492` alone can administer.
- Licenses use exact ordered UTF-8 JSON and Ed25519; only refresh hashes persist.
- Owner bot commands, Telegram-authenticated web admin, CSRF and cookie controls.
- Private streaming downloads, immutable release files, exact-byte manifest/tables.
- Owner audit, export, service-only schema/RLS and scheduled database snapshots.
- Isolated hook in the existing webhook after its unchanged secret-token check.
  Other legacy message/callback routes retain their original ordering and code.

## Verification

- New local tests cover license bytes and independent verification, one-time
  issuance under concurrent polls, wrong-user/wrong-topic callbacks, legacy bot
  pass-through, expiry, device limits, membership removal/network failure,
  owner-only actions, cookie/CSRF, exact file bytes, immutable releases and
  minimum version behavior.
- TypeScript and client/server production build checked locally.
- No private license key or bot token in source or client output.
- No live Telegram message sent during these checks.
- Final branch review: 161 Node tests passed, 1 existing Bun-only test skipped;
  TypeScript and production build passed. Thirty existing page/bot modules
  compared equal to the review baseline. The 13 changed/added files were scanned
  for private keys, Telegram tokens, Supabase secret/service-role keys and the
  local operator credential; no matches. No local .env/.local file is included.

## Installation not yet completed

Migration `wor_telegram_licensing_private_state` has been applied successfully.
The three WOR tables have RLS, no anon/authenticated grants or key-RPC access;
the private bucket and daily snapshot job exist. Rolled-back service-role checks
passed for CAS conflict rejection, snapshot creation and atomic rate limiting.
The license Vault secret has not yet been generated.

Production publication is now authorized. Do not change the production bot webhook. No GitHub
Actions workflows exist in this repository checkout. The connected Lovable
project still reports the base main commit above before the branch push.

An explicit server `WOR_ENABLED` overrides the flag; otherwise only a service-role
operator may enable `wor_state.data.settings.enabled`. Missing configuration
defaults off. Unrelated bot messages never read the WOR database. Bootstrap
accepts `WOR_BOOTSTRAP_SHA256` from server environment or `bootstrap_sha256` from
the same service-only settings. No operator credential/hash is embedded in Git.

The production Ed25519 pair has **not been generated**. Consequently there is
no real public key or test certificate to report yet. Local tests use disposable
test keys, which must never be presented as the production key.

## Remaining installation sequence

1. Database migration and service-only permission verification are complete.
2. Database CAS, rate and snapshot tests passed in a rolled-back transaction.
   Advisors report the intentionally closed RLS tables without client policies.
   No game tables are changed.
3. User-authorized main synchronization is complete; finish native publication
   and server initialization without a Lovable AI turn.
4. Only in a separately authorized environment, set `WOR_ENABLED=true` and a
   server `WOR_BOOTSTRAP_SHA256` for a newly generated operator credential.
   Invoke one-use `/api/wor/bootstrap` from the operator process. It generates key material entirely
   in the server, stores it encrypted in Vault, checks bot identity, supergroup
   and administrator status, and returns **only** public key/test certificate
   plus nonsecret bot diagnostics. Initialization permanently disables this
   credential. Never put this credential in a URL or browser code.
5. Independently verify the returned certificate against the exact expected
   UTF-8 payload and 32-byte public key. Record only those public artifacts here.
6. Remove bootstrap HTTP code and operator credential after successful
   initialization, rebuild and republish. Retain Vault contents and identity.
7. Test HTTPS start/poll error states and authenticated file denial. Verify
   bot membership lookup, webhook secret rejection and all legacy bot routing.
   A real end-to-end confirmation requires the owner to click its topic button.
8. Upload owner's actual signed artifacts and verify Windows-client signatures.
   No unsigned or invented production release/table file is installed.

The live bot's current permissions/webhook URL have not yet been rechecked;
historical bot checks and existing source confirm the intended clan chat, but
do not substitute for the step-4 live verification. No `setWebhook` is called
automatically by the new implementation.

## Files to review

- `docs/WOR_PROTOCOL.md` — protocol, owner commands, security and backup/migration.
- `docs/WOR_STATUS.md` — verified state, deployment hold, backup and review steps.
- `docs/wor-curl-examples.ps1` — Windows-compatible start/poll/renew/update/tables.
- `supabase/wor-schema.sql` — isolated server-only database additions.
- `src/lib/wor-crypto.mjs` — exact payload, encoding, Ed25519 and file metadata.
- `src/lib/wor-service.server.mjs` — activation/renewal/downloads, Telegram handlers,
  limits, owner actions, sessions and audit.
- `src/lib/wor-store.server.mjs` — service-only database CAS and private file streams.
- `src/lib/wor-ui.server.mjs` — new Telegram-authenticated owner administration page.
- `src/lib/wor.server.mjs` — disabled-by-default feature, runtime wiring and key init.
- `src/lib/wor.server.d.mts` — server exports' TypeScript declarations.
- `src/lib/wor.test.mjs` — new protocol, security and legacy pass-through tests.
- `src/server.ts` — adds routing only for /api/wor/*, /downloads/* and /wor/admin.
- `src/routes/api/public/telegram/gvg-video-webhook.ts` — adds an isolated WOR hook
  after the unchanged webhook secret check, before unchanged legacy routing.

## Backup actually taken

An initial committed WOR-only snapshot was created and verified at
`2026-11-09 19:32:04.714563 UTC` (22:32 Moscow). At that point the state had
revision 0, zero devices and zero activation requests. It is a row in
`public.wor_backups`. Daily snapshots are enabled at 02:15 UTC, retained 35 days;
the scheduled job had not yet run when inspected.

This is not a full database or off-site disaster backup. No full-project backup
was made or verified by this task. Existing game, hotel and Telegram tables were
not modified. A full database and private Storage backup must be verified before
eventual production activation; no live database restore is needed for code rollback.

## Review before merge

1. Inspect the branch comparison against `main`: exactly the 13 files above.
2. In a separate checkout run `node node_modules/typescript/bin/tsc --noEmit`
   and `node --test --test-isolation=none src/lib/*.test.ts src/lib/*.test.mjs`.
   The existing Bun-only integration file is explicitly skipped under Node.
3. Build: `node node_modules/vite/bin/vite.js build --configLoader runner` on
   this Windows checkout (elevated process execution was needed locally).
4. Do not point a branch preview at the live bot/webhook. For a full test deploy,
   use a separate Supabase project, separate test bot and private test forum;
   apply schema there and replace clan chat/topic/owner settings for that forum.
   Configure server secrets only, enable WOR, and register the test bot's webhook
   on that isolated preview. Do not change the production bot's webhook or token.
5. Confirm topic-only and initiating-user-only approval, owner-only administration,
   one-time poll issuance, exit/ban/revoke denial, limits and exact file bytes.
   Upload actual owner-signed artifacts and verify with the Windows client.
6. No separate hosted preview is created automatically by this branch push.
   Neither an end-to-end real bot test nor a rollback rehearsal has yet been run.

## Effect and rollback after a future authorized deployment

With WOR disabled (default), existing pages and bot actions keep their previous
routing; new WOR APIs return 503 and no WOR bot request is handled. No webhook
registration, token replacement or allowed_updates change is performed.
Enabling WOR adds only its new endpoints and owned Telegram commands/callbacks.

Fast disable: set server `WOR_ENABLED=false` and publish that environment change.
This leaves old pages/commands available and preserves licensing records. Full
code rollback: redeploy the previously recorded working hosting version, or
revert this feature commit on main and publish after approval. No force push.
Keep the additive WOR tables/private files/Vault key, rather than dropping them
or restoring the entire shared database. Restore WOR data alone only if it was
actually corrupted, after stopping writers and taking another snapshot.

The feature switch supplies a one-deployment emergency stop. A strict two-minute
recovery time is not proven: hosting access, build/rollout time and the real
previous production version must be verified in a rollback rehearsal. The base
source commit above identifies the review baseline, not a verified production
hosting version. Record the actual last-good deployment before releasing.
