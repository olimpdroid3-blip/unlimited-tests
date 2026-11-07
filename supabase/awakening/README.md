# Awakening Reader v1 backend

Applied to the external GvG database `aabaapmktkfwmvgcirxb` on 2026-11-07 via
Supabase migrations `awakening_report_import_v1` and
`awakening_current_read_and_atomic_site_reset`. These SQL files preserve the
applied source; do not rerun them against an already migrated database.

The deployed `awakening-report` Edge Function sources live in
`supabase/functions/awakening-report`. Platform JWT verification is disabled
because the handler validates a separate import token, stored only as SHA-256
in the database. It calls service-role-only RPCs; the administrative key stays
in Edge Function/server environment variables. Never include it in the reader.

`awakening_private` is not exposed to the Data API, has RLS enabled and no
public-role policies or schema grants. Website and bot read current scouting
through `awakening_read` using their existing server client. Independent reader
sessions resolve conflicts by last committed import; client clocks do not decide.

Atomic clear-all snapshots and locks the current match and tower tables,
validates the unchanged snapshot, archives tower rows, clears current towers
and variants and rotates the match in one transaction. Screenshot removal runs
after commit as best-effort cleanup. Scouting history and import IDs survive.
Missing positions in an upload are never deleted.

The reader sends manually; it keeps local reports on failure and reuses an
unchanged report ID on retry. Before collecting another match the operator
must archive/reset the local reader. Previously unsubmitted data cannot be
automatically identified as belonging to the previous match.

`transaction-check.sql` tests only its own test scope inside a rolled-back
transaction. `src/lib/awakening.test.mjs` tests website/bot logic with mocked IO.
Live resets and Telegram test messages are not part of automated verification.
