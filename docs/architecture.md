# Architecture

Last updated: 2026-10-24

Status: browser-only first version implemented.

## Stack

| Responsibility        | Technology                      |
| --------------------- | ------------------------------- |
| Language              | TypeScript                      |
| Interface             | React                           |
| Development and build | Vite                            |
| Browser database      | IndexedDB through Dexie         |
| Charts                | Recharts                        |
| Source control        | Git and GitHub                  |
| Hosting               | Sites, serving the static build |
| Recovery              | Local JSON export and restore   |

Compatible dependency versions are recorded in package.json and package-lock.json. Plain CSS is sufficient initially. Tesseract.js provides on-device OCR. English and German model packages are self-hosted as build assets. Papa Parse remains a candidate for later CSV import.

## Data flow

```text
Sites or local development server --> Application files --> Browser
                                                            |
                         Manual entries / backup restore -->|
                                                            v
                                                     IndexedDB
                                                            |
                                      Dashboard / projections / backup export
```

The browser performs validation, calculations, persistence, and backup processing. No Java service, remote financial database, brokerage connection, or localhost API is required.

GitHub and Sites receive application source or build files, not personal financial records. Normal asset or expense updates never trigger source-control operations or deployments.

## Source structure

```text
src/
  components/
  features/
    expenses/
    assets/
    projections/
    data/           Backup, restore, and deletion
  domain/           Types, validation, and pure calculations
  storage/          Dexie schema, migrations, and repositories
  demo/             Fictional examples only
```

Domain logic is independent of React and database access. Put persistence behind a small storage interface so a future backend can be added without rewriting calculations or views.

## Initial data model

Use stable IDs, date-only financial dates, and timestamps for creation and modification. Use EUR in the first version.

| Entity              | Key fields                                                                                                                              |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Account             | ID, display name, type, currency                                                                                                        |
| Category            | ID, display name                                                                                                                        |
| Monthly expense     | ID, month (`YYYY-MM`), category ID, positive amount in cents, optional note                                                             |
| Asset snapshot      | ID, account ID, date, cash value in cents, investment market value in cents                                                             |
| Cash flow           | ID, account ID, date, positive amount in cents, kind: contribution, withdrawal, transfer in, or transfer out; optional transfer pair ID |
| Projection scenario | ID, name, initial amount, monthly contribution, annual return assumption, duration, optional inflation assumption                       |
| Settings            | Display preferences and supported application settings                                                                                  |

Enforce unique month/category expense totals and account/date snapshots. Validate references and handle deletion of referenced accounts or categories explicitly; do not leave orphan records.

Snapshots on different dates are observations, not amounts to add together. Latest account values may be summed with their valuation dates disclosed. Match cash-flow periods to snapshot dates before calculating gains; paired household transfers cancel. Incomplete records do not support reliable performance calculations.

## Calculation conventions

- Store recorded money as safe integer cents and reject values outside supported numeric bounds.
- Normalize euro input explicitly and display using German euro formatting.
- Retain intermediate precision for projections and round displayed amounts consistently.
- Interpret annual returns as effective annual rates: `monthlyRate = (1 + annualRate) ** (1 / 12) - 1`.
- Apply contributions at month end: `nextBalance = balance * (1 + monthlyRate) + monthlyContribution`.
- At zero return, ending value equals initial value plus all contributions.
- Reject non-finite inputs, invalid durations, annual returns at or below -100%, and inflation at or below -100%.
- Inflation-adjusted value is `nominalValue / (1 + annualInflation) ** years`.
- Label taxes and fees as excluded. Assumed returns are not measured performance or forecasts.

## Persistence and privacy

IndexedDB is the source of truth. Persist confirmed edits in transactions and show errors when a write fails. Never claim an unsaved edit is stored.

Data belongs to a browser profile and origin (scheme, host, and port), not a GitHub account or Sites login. Local development and the hosted app have separate databases. Preserve the deployment origin where possible; use backup/restore to move records when it changes.

Clearing website data, deleting a profile, storage eviction, or private browsing can remove records. Browser storage is not an encrypted vault and does not protect against access to the same browser profile. Persistent-storage requests can be considered but must not replace backups.

Bundle dependencies and avoid analytics or external requests containing financial inputs. Files selected for restore are read locally. Keep private imports, backups, credentials, and personal logs outside the repository. Fictional data must not silently overwrite or mix with real records.

## Backup format

Use a JSON envelope containing `app`, `schemaVersion`, `exportedAt`, and `data`. Export accounts, categories, monthly expenses, payments, snapshots, cash flows, scenarios, and supported settings. Do not include runtime objects or secrets.

The app identifier is `wealth-tracker`. The current backup schema version is 2, adding the payments collection. Version 1 backups migrate with an empty payments array; all existing collections remain required. Store monetary records in cents, document rate units, and keep database and backup schema versioning explicit and independent. Future formats need explicit migrations; reject unsupported versions rather than guessing.

Example envelope with an empty dataset:

```json
{
  "app": "wealth-tracker",
  "schemaVersion": 2,
  "exportedAt": "2026-10-24T12:00:00.000Z",
  "data": {
    "accounts": [],
    "categories": [],
    "monthlyExpenses": [],
    "payments": [],
    "assetSnapshots": [],
    "cashFlows": [],
    "scenarios": [],
    "settings": {}
  }
}
```

Use `wealth-tracker-backup-YYYY-MM-DD.json` for downloads. Plain JSON is readable and unencrypted. Browser exports are user-initiated; do not promise automatic filesystem backups or that a completed download remains available.

## Restore transaction

1. Read the selected file locally and enforce reasonable size and record limits.
2. Parse and validate the application identifier, version, types, dates, money bounds, IDs, uniqueness, and cross-record references.
3. Show the export timestamp, record counts, and replacement warning. Offer export of current records.
4. After confirmation, clear and replace all domain stores in one IndexedDB transaction.
5. On error, roll back; on success, invalidate cached views and reload records.

Do not clear existing stores before validation or outside the replacement transaction. Reject partial or corrupt backups. The first version replaces data, never merges it. Track the latest successful export time separately from the backup's original export timestamp.

Recovery restores only the exported state. If the Site is unavailable, rebuild or redeploy the code, or run the app locally, and import the backup. A backup cannot restore the website code or edits made after export.

## Deployment and version control

Build static assets into `dist/` and deploy using the Sites workflow. Start with a private audience. Keep the required hosting manifest and GitHub/Sites source revisions aligned when deployment is configured.

The deployed personal tracker operates in each visitor's browser. It is not limited to a fictional demo, but the application bundle must contain only fictional examples. The developer's Mac can be asleep or off after deployment.

The repository includes ignore rules for dependencies, build output, local secrets, IDE state, and private data. Keep backups outside the checkout; ignore rules do not remove files already tracked by Git. Use small feature commits and verify the intended files before pushing.

## Verification

- Independently check projections, including zero return, negative return, and contribution timing.
- Check monthly expense uniqueness, snapshot totals, and transfer treatment.
- Verify reload persistence, migrations, and explicit handling of storage failures.
- Verify full backup/restore round trips, canceled restores, corrupt files, unsupported versions, and transactional rollback.
- Verify restore into a fresh browser database and recovery after a change of origin.
- Verify imports, exports, edits, and calculations send no personal data over the network.
- Check accessible controls, mobile layouts, and a production build before deployment.

## Interface

Use a Trade Republic-inspired visual direction: white surfaces, black typography, generous spacing, rounded action buttons, and restrained green chart accents. Keep Wealth Tracker branding and explicitly state that this is an independent project. Start empty; fictional examples require an explicit action.

## Storage implementation

Dexie manages separate stores for accounts, categories, expenses, snapshots, cash flows, scenarios, and settings. Whole-dataset writes and restore replacements occur in a transaction. A stale-data check rejects edits when another tab has changed the stored dataset; reload before retrying. Tests use a simulated IndexedDB implementation, and visual browser verification is separate.

## Bulk payment import

Database version 2 adds a `payments` store while retaining version 1 stores and records. Backup version 2 includes payments; restoring legacy backups adds an empty payment collection before normal validation. No screenshot or OCR source text is persisted.

`scripts/prepare-ocr.mjs` copies the Tesseract worker, LSTM WASM variants, licenses, and English/German language data from locked npm dependencies into ignored `public/ocr/`. Predev and prebuild hooks prepare these assets. The client explicitly configures worker, core, and language paths to the current origin, avoiding CDN defaults. Models are fetched only when scanning, not on every page visit.

The import flow bounds file sizes, image pixels, extracted-text length, and batch size. It normalizes common date and currency formats conservatively, proposes categories using local merchant rules, and leaves questionable directions or rows unselected. Recognition is fallible; an editable review precedes persistence. Raw text is available transiently to correct parser mistakes.

Duplicate identity uses date, normalized description, positive integer amount, and direction. It is a warning rather than a hard uniqueness constraint because legitimate repeated payments exist. Overrides require explicit acknowledgment.

Spending totals are derived by category/month: use an existing manual total, otherwise sum outgoing payments. Incoming payments are excluded. The review requires an explicit choice before removing any overlapping manual total. Committing applies category creation, optional manual-total removal, and all selected payments through the existing atomic dataset write and stale-tab check.

Browser tests must exercise the real worker and WASM on a fictional screenshot, not just mock recognized text. Network checks must confirm that no image or text is sent to an external service. Additional tests cover manual-total conflicts, duplicates, payment edits, schema migration, and backup recovery.
