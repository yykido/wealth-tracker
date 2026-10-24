# Wealth Tracker

A browser-only personal finance dashboard for monthly expenses, dated asset balances, and hypothetical investment projections. Its restrained black-and-white interface takes visual inspiration from Trade Republic; this is an independent project with no brokerage affiliation.

## Run locally

Use Node.js 20 or newer (Node 22 recommended).

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`).

```bash
npm test          # Domain, backup validation, and database recovery checks
npm run test:browser # End-to-end checks (Chrome on macOS; Chromium elsewhere)
npm run build    # TypeScript checks and production build into dist/
npm run preview  # Serve the production build locally
```

For browser tests on Linux, install the test browser with `npx playwright install --with-deps chromium`. Browser tests use fictional data in a fresh profile; screenshot artifacts go to the temporary directory.

## Features

- Add, edit, and delete monthly expense totals by category.
- Bulk-import payments from a screenshot/photo using on-device OCR, or paste a payment list. Edit dates, descriptions, amounts, directions, and category suggestions before confirming.
- Flag possible duplicates and explicitly resolve conflicts with existing manual category totals. Incoming payments are stored separately and excluded from spending.
- Create bank, savings, and brokerage accounts; record cash and investments separately in dated snapshots.
- Keep contributions, withdrawals, and paired internal transfers separate from balance history.
- Save constant-rate projection scenarios with monthly contributions and inflation adjustments. These are hypothetical, before taxes and costs.
- Export all records, including individual payments, as a versioned JSON backup, preview and validate restores, and replace data transactionally after confirmation.
- Load explicitly labeled fictional examples or start empty. Loading examples replaces existing records only after confirmation.

## Where your data lives

IndexedDB in the current browser stores financial records. The app does not upload them to Sites, GitHub, or a backend. Updating records does not require a commit or redeployment, and the deployed app does not depend on the developer's Mac being awake.

Data is specific to the browser profile and website origin. Local development, a Sites URL, and a different browser have separate databases. Clearing website data, deleting a profile, or private browsing can remove records. Export backups after monthly updates. To move records, export from the old browser and restore in the new one.

JSON backups are readable text, not encrypted. Keep real imports and backups outside this repository. Use fictional data in examples, screenshots, and test fixtures. Never enter brokerage login details or account numbers.

## Recovery

Open **Data & backup → Choose backup file**, select a Wealth Tracker JSON backup, review its date and record counts, and confirm **Replace & restore**. You can export current records before replacing them. Invalid or failed restores preserve existing records; successful restores replace rather than merge them.

If the hosted Site is unavailable, run the application locally or redeploy its code, then import the backup. Recovery includes only the state recorded when the backup was exported.

## Deployment and version control

GitHub tracks source, documentation, the dependency lockfile, and fictional test data. GitHub Actions runs tests and production builds for pushes and pull requests. Local IDE files, build output, dependencies, private-data folders, and named backup exports are ignored.

Sites hosts the static `dist/` build using `.openai/hosting.json`. GitHub and Sites have separate source remotes; publish the same reviewed source revision to both. Keep personal data out of build inputs and deployment archives. The configured Site address is [Wealth Tracker](https://wealth-tracker-yykido.beigehake2.chatgpt.site); it becomes available after a successful private deployment.

## Documentation

- [Product requirements](docs/product.md)
- [Architecture](docs/architecture.md)
- [Decisions](docs/decisions.md)

## Screenshot import

Open **Expenses → Import screenshot**. Choose a PNG, JPEG, or WebP image (up to 10 MB), set English/German recognition and the year for dates that omit it, then scan. Review and correct each row before importing selected payments. You can also paste or correct the recognized text.

Start with a clear list containing dates, merchants, and signed euro amounts. Arbitrary bank layouts and blurry photos may need corrections. Incoming, unsigned, transfer-like, and ambiguous rows are not selected automatically. Duplicate warnings can be overridden only when you confirm a genuinely separate payment.

A manual category/month total overrides payment sums. When a screenshot overlaps one, explicitly keep the manual total or replace it with all recorded outgoing payments for that category/month. Replacing a full monthly total with a partial screenshot can understate spending; the review shows the new amount.

Images and raw extracted text are transient and never saved in backups or uploaded. OCR worker, WASM, and English/German models are copied from npm dependencies to ignored `public/ocr/` assets before development and builds, and served from the same origin. The first scan downloads recognition assets to the browser. No paid API or backend is used.

Backups now use version 2 and include payments; version 1 backups remain readable and migrate with an empty payment collection. Older app versions cannot restore version 2 exports.

CSV imports, shared family synchronization, live brokerage data, and a backend remain outside scope. Use GitHub Issues to track future work.

## Verification

The current release passed 25 domain/database checks and five end-to-end Chrome workflows, including real English/German screenshot OCR, bulk review, duplicate handling, manual-total conflicts, scan cancellation, schema migration, editing, reload persistence, export/restore, projections, and mobile layout. Desktop and mobile screenshots were visually reviewed using fictional records. GitHub Actions runs the domain/database checks and production build.
