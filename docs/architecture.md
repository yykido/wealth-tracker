# Architecture

Last updated: 2026-10-24

Status: agreed browser-only architecture; no application code exists yet.

## Stack

| Responsibility | Technology |
| --- | --- |
| Language | TypeScript |
| Interface | React |
| Development and build | Vite |
| Browser database | IndexedDB through Dexie |
| Charts | Recharts |
| Source control | Git and GitHub |
| Hosting | Sites, serving the static build |
| Recovery | Local JSON export and restore |

Select compatible stable dependency versions during scaffolding and commit the lockfile. Plain CSS is sufficient initially. Papa Parse is a candidate for later CSV import, not a first-version dependency requirement.

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

## Suggested structure

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

Keep domain logic independent of React and database access. Put persistence behind a small storage interface so a future backend can be added without rewriting calculations or views.

## Initial data model

Use stable IDs, date-only financial dates, and timestamps for creation and modification. Use EUR in the first version.

| Entity | Key fields |
| --- | --- |
| Account | ID, display name, type, currency |
| Category | ID, display name |
| Monthly expense | ID, month (`YYYY-MM`), category ID, positive amount in cents, optional note |
| Asset snapshot | ID, account ID, date, cash value in cents, investment market value in cents |
| Cash flow | ID, account ID, date, positive amount in cents, kind: contribution, withdrawal, transfer in, or transfer out; optional transfer pair ID |
| Projection scenario | ID, name, initial amount, monthly contribution, annual return assumption, duration, optional inflation assumption |
| Settings | Display preferences and supported application settings |

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

Use a JSON envelope containing `app`, `schemaVersion`, `exportedAt`, and `data`. Export accounts, categories, monthly expenses, snapshots, cash flows, scenarios, and supported settings. Do not include runtime objects or secrets.

The app identifier is `wealth-tracker`. The initial backup schema version is 1. Store monetary records in cents, document rate units, and keep database and backup schema versioning explicit and independent. Future formats need explicit migrations; reject unsupported versions rather than guessing.

Example envelope with an empty dataset:

```json
{
  "app": "wealth-tracker",
  "schemaVersion": 1,
  "exportedAt": "2026-10-24T12:00:00.000Z",
  "data": {
    "accounts": [],
    "categories": [],
    "monthlyExpenses": [],
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

During scaffolding, add ignore rules for dependencies, build output, local secrets, IDE state, and private data. Keep backups outside the checkout; ignore rules do not remove files already tracked by Git. Use small feature commits and verify the intended files before pushing.

## Planned verification

- Independently check projections, including zero return, negative return, and contribution timing.
- Check monthly expense uniqueness, snapshot totals, and transfer treatment.
- Verify reload persistence, migrations, and explicit handling of storage failures.
- Verify full backup/restore round trips, canceled restores, corrupt files, unsupported versions, and transactional rollback.
- Verify restore into a fresh browser database and recovery after a change of origin.
- Verify imports, exports, edits, and calculations send no personal data over the network.
- Check accessible controls, mobile layouts, and a production build before deployment.
