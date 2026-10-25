# Architecture

Last updated: 2026-10-25

## Current stack

- React and TypeScript interface, retaining the existing dashboard and screenshot review.
- Sites Vinext starter, Vite, and Cloudflare Worker server runtime.
- Sites-managed Cloudflare D1 for one shared household.
- Drizzle schema and immutable generated SQL migrations.
- ChatGPT identity supplied by Sites; server-only `WEALTH_ALLOWED_EMAILS` controls app admission.
- IndexedDB retained only for recovering the earlier browser-local records and OCR language caching.

## Access boundaries

Sites remains custom/private, with only its owner admitted initially. Additional people can be invited later. The server independently requires a platform-supplied stable user ID and an email matching the runtime allowlist. Email is used for admission; stable IDs are used for write attribution. Missing configuration denies access. No first-visitor owner bootstrap exists.

Protected pages call the starter's server-only sign-in helper and are dynamic. Every household API operation repeats authentication and authorization; hiding interface elements is not the security boundary. Sign-in and sign-out use top-level links to dispatch-owned routes. Do not create a separate OAuth stack or trust identity values supplied in request bodies. The starter strips forged identity headers in local development; production identity is injected at Sites dispatch.

The environment allowlist is a runtime secret, never a build input. Adding an editor later requires both Sites visitor access and updating the server allowlist, followed by deployment. All admitted app users can edit the shared household; they do not need Sites source-editor privileges.

## API and persistence

`GET /api/household` returns validated data, revision, update time, and the current viewer. `PUT /api/household` accepts validated data with a quoted revision in If-Match. Responses are private/no-store. Unauthenticated and uninvited requests return 401/403 without accessing storage. Writes additionally require same-origin Origin, JSON content, and a valid revision. Request bodies are read with a 10 MB bound.

D1 stores a single household metadata row and ordered JSON chunks. Each chunk contains at most 256,000 UTF-16 code units, below the database row limit even with multibyte text. Read metadata and chunks in a database batch for a consistent snapshot.

Writes are atomic batches: ensure an empty metadata row exists, compare-and-increment its revision with a unique write token, then replace chunks only if that token won the comparison. A stale batch cannot delete or insert chunks. Any failure rolls back metadata and records together. Schema-only migrations create tables; requests never create or alter schema, and migrations contain no financial data or personal emails.

`src/storage/shared.ts` replaces the browser-only repository for normal operations. The client also rejects saves made against a snapshot that changed during editing. Refresh on focus and every 15 seconds when no editing dialog, import, restore, confirmation, or projection page is active. Explicit Refresh records is available. A conflict asks the user to cancel, refresh, and retry; there is no silent last-write-wins merge.

## Domain data

The existing Data structure remains the validated interchange format: accounts, categories, monthly expense totals, individual payments, asset snapshots, cash flows, scenarios, and settings. Monetary records use safe integer cents. Returns are effective annual rates with month-end contributions. Assumptions remain separate from actual balances.

Manual category/month totals take priority over outgoing payment sums. Incoming payments are excluded from spending. Individual payment descriptions can be blank. Duplicate warnings use date, normalized description, amount, and direction, and allow explicit exceptions. Brokerage cash and investment values are distinct; transfers are not household investment gains.

## Screenshot privacy

Tesseract.js, workers, WASM variants, and English/German model assets are self-hosted. Original images and raw recognized text stay transiently on the user's device. Only confirmed, structured payment records are sent to the authorized shared API. Crop/format limits, review, duplicate checks, and manual-total conflict choices are retained.

## Migration and backups

Opening the shared app never automatically uploads or erases prior IndexedDB records. After an authorized load, the client detects them and offers a browser-only export or a migration preview. The normal backup preview, explicit shared-replacement warning, and revision-checked API write handle migration. The original browser records remain intact.

Version 2 JSON backups include all domain collections; version 1 backups migrate with empty payments. Restoring replaces shared records for every member after validation and confirmation. Merge is outside scope. Exported JSON is unencrypted. Clearing browser storage does not delete D1 records. A backup recovers only the state at export.

## Local development and release

Use Node >=22.13, the portable Sites starter profile, and ignored local development variables. The supplied local sign-in mock admits only the fictional `seedy@sites.test` through the example local allowlist. It is disabled in production. Local D1 and hosted D1 are separate. Apply each pending local migration once after generating the Worker configuration.

Keep the existing Site project ID and audience. The hosting manifest declares `d1: DB` and has no static-only deployment field. Build and publish using the Sites workflow. Do not put secrets, real records, .wrangler state, or private backups in Git.

## Verification

Tests cover anonymous/uninvited denial before database access, cross-site write rejection, shared access across identities, optimistic concurrency, chunked Unicode data, rollback, invalid input, and legacy database recovery. Browser checks cover separate browser contexts, forged-header denial, migration confirmation, existing editing/backup flows, and local OCR. Browser tests reset only the fictional loopback household.
