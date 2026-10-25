# Product requirements

Last updated: 2026-10-24

Status: first version implemented; deployment and verification results are recorded in the README and release history.

## Purpose

Help an individual or household record spending, track asset values, and explore hypothetical investment growth. The app does not execute investments or automatically connect to a brokerage.

## Principles

- Keep actual records separate from projected balances and return assumptions.
- Distinguish deposits from investment gains; never imply that balance growth alone is investment performance.
- Keep financial records in the user's browser, outside GitHub and deployed files.
- Start with manual monthly updates and a reliable backup workflow.
- Make financial amounts and projection assumptions editable. Use fictional defaults.

## First-version workflows

### Monthly expenses

1. Select a month and category.
2. Enter the total spent in that category, with an optional note.
3. Save, edit, or delete the entry and see updated monthly totals.

Use one total per month and category. Editing an existing total replaces it rather than adding a duplicate. Individual payments can also be imported through the screenshot workflow below. A manual total takes priority over payment sums for that category/month, rather than being added to them. CSV import is a later enhancement.

Categories are user-defined. Support euro amounts and German decimal formatting. Expense totals are independent of recorded account balances and do not automatically reduce asset snapshots.

### Bulk screenshot payment import

- Select a PNG, JPEG, or WebP screenshot/photo of a payment list (up to 10 MB and 24 megapixels), or paste a payment list as text.
- Run OCR locally using English and/or German models served with the app; do not send the image or extracted text to external services.
- Support dated payment rows and date headings with signed euro amounts. Expose a year setting for dates without a year. Other layouts may require manual correction.
- Review an editable table of dates, optional descriptions, positive amounts, outgoing/incoming direction, and suggested categories. Blank descriptions are accepted when importing, editing, and restoring backups. Allow deselecting entries and adding missed rows.
- Do not automatically select incoming, unsigned, ambiguous multi-amount, or transfer-like entries. Do not include incoming payments in spending totals.
- Flag matching date/description/amount/direction combinations in existing records or the selected batch. Duplicates require an explicit exception or deselection.
- Require a choice for existing manual totals: keep the total and exclude payments from its calculation, or remove the total and use all recorded outgoing payments for the group. Show that partial imports may understate a full month.
- Persist the selected payments and category changes in one transaction only after confirmation. Retain neither original images nor raw OCR text.
- Allow editing and deleting recorded payments. Calculated totals update automatically; manual totals remain authoritative until removed.

### Asset snapshots

1. Select an account and valuation date.
2. Enter cash and investment market value separately.
3. Save a new snapshot while retaining earlier dates for history.

Support bank, savings, and brokerage accounts, including Trade Republic. For each account and date, edit an existing snapshot rather than creating a second conflicting record. Do not add a brokerage's total on top of its cash and investments.

Show when each balance was recorded. Never label snapshots as live prices. If accounts were updated on different dates, label the household total as the sum of latest recorded values and expose those dates.

Record contributions and withdrawals separately when available. Paired transfers between tracked accounts are internal movements. If cash-flow history is incomplete, show balance changes without claiming they are investment gains.

### Projections

Enter an initial amount, monthly contribution, annual return assumption, and duration. Show projected balances and contributions separately, with optional inflation adjustment and multiple saved scenarios.

A return assumption, including a user-entered 10%, is hypothetical and not a forecast or measured return. Editing scenarios must not change recorded assets. Taxes and fees are excluded initially and must be labeled as such.

Use fictional demonstration figures rather than household details from the discussion.

### Automatic saving and backups

- Save confirmed edits to IndexedDB and report save failures rather than implying success.
- Retain records across normal page reloads, browser closure, and device restarts.
- Export all records and settings in a versioned JSON backup, named using the export date, such as `wealth-tracker-backup-2026-10-24.json`.
- Show the last successful export time and encourage a backup after monthly updates; a download does not prove that the user retained the file.
- Provide explicit, confirmed deletion of personal records.

### Restore and recovery

1. Open the app and select Restore backup.
2. Select the saved JSON file; read it locally without uploading it.
3. Validate its format, version, record values, and references.
4. Show counts, export date, and a clear warning that restore replaces current records.
5. Offer export of existing records before replacement, then require confirmation.
6. Replace records atomically and refresh the dashboard after success.

Invalid, unsupported, canceled, or failed restores leave current records unchanged. Merge is outside the first version. Recovery returns records to their exported state; later changes cannot be recovered from that file.

If browser data is lost, restore into the same app. If the Site is unavailable, redeploy the application from source or run it locally, then restore there. The JSON file contains records, not the application itself.

## Storage boundaries

| Location           | Contents                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------- |
| Browser IndexedDB  | Personal expenses, categories, accounts, snapshots, cash flows, payments, scenarios, and settings |
| GitHub             | Code, documentation, lockfile, and fictional examples                                             |
| Sites              | Application files, without personal records                                                       |
| User's backup file | Exported financial records and settings, stored privately by the user                             |

Different browsers, profiles, devices, and website origins have separate data. Switching from a local development URL to Sites requires export and restore. Private browsing is unsuitable for durable records. Browser storage and plain JSON are not encrypted vaults.

## Outside the first version

- Spring Boot, PostgreSQL, backend hosting, tunnels, and always-on services.
- Shared household accounts and automatic cross-device synchronization.
- Brokerage APIs, trade execution, and live price feeds.
- CSV and Excel imports and PDF extraction.
- Multiple currencies, tax calculations, investment recommendations, and probabilistic forecasts.

## Acceptance criteria

1. Monthly category totals can be added, corrected, and deleted without duplicate counting.
2. Dated asset snapshots retain history and avoid double counting cash and investments.
3. Contributions and withdrawals remain separate from snapshots and projections.
4. Projection inputs change only hypothetical results and state their assumptions.
5. Saved records survive reloads and normal browser restarts.
6. Export and restore recover all supported records and settings without partial replacement on failure.
7. Personal updates, export, restore, and calculations do not transmit financial data to a server.
8. A deployed app starts without personal records and operates independently of the developer's Mac.

## Delivery order

1. Scaffold React, TypeScript, Vite, browser storage, and fictional examples.
2. Implement manual monthly expenses and asset snapshots.
3. Implement and verify backup export, restore, and deletion before using real data.
4. Add deterministic projections and charts.
5. Verify calculations, persistence, recovery, responsive layouts, and privacy behavior.
6. Commit reviewed changes, push to GitHub, and deploy through Sites.
7. Consider CSV import after the manual workflow is useful.

## Future questions

- Which CSV layouts would save the most effort?
- Are individual ETF holdings or purchase-level expenses needed?
- Is shared family access worth adding synchronization and authentication later?

## Screenshot import acceptance

- One clear fictional screenshot yields multiple review rows and a single confirmed batch save.
- An invalid or canceled review leaves current records unchanged.
- Existing manual totals are never silently added to imported payment sums.
- Payments survive reloads and JSON backup recovery; legacy records survive database upgrades.
- Image bytes and recognized text never leave the device or enter persistent storage.
