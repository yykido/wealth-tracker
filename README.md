# Wealth Tracker

A private, shared household finance tracker for invited ChatGPT accounts. Track monthly expenses, dated asset balances, bulk screenshot payments, and hypothetical investment projections.

[Open the private tracker](https://wealth-tracker-yykido.beigehake2.chatgpt.site)

## Shared data and access

Invited accounts see and edit the same centrally stored household. Only the owner is enabled initially. Sites enforces its private access policy, and the application separately checks a server-only email allowlist on every read and write. Missing identity or configuration fails closed. Financial records are never committed to GitHub or included in the frontend bundle.

Records are stored in a Sites-managed Cloudflare D1 database. They survive browser clearing and can be accessed from another device after sign-in. The app checks for updates every 15 seconds while not editing; Refresh records loads changes immediately. Concurrent stale writes return a conflict instead of overwriting another member's changes.

Restore, deletion, and loading examples change the shared household for everyone. Review confirmations and export a backup before destructive changes.

## Existing browser-only records

On the same browser and Site origin, the app detects the earlier IndexedDB records after authorized sign-in. It does not upload or remove them automatically. Use **Export browser-only backup** to preserve a copy, or **Review browser migration** to inspect and explicitly confirm replacing the shared household.

You can also restore an existing JSON backup through **Data & backup**. Versions 1 and 2 remain supported. Restore replaces shared records rather than merging them, and affects all members. Plain JSON backups are readable and unencrypted; keep them private, outside this repository.

## Run locally

Requires Node.js **22.13 or newer** (Node 22 LTS recommended).

```bash
npm ci
cp .dev.vars.example .dev.vars
npm run build
```

Apply each pending local schema migration once:

```bash
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_jittery_the_professor.sql
npm run dev
```

Open the printed loopback URL. The Sites starter simulates sign-in locally as `seedy@sites.test`; the example development allowlist admits only that fictional identity. This mock is not included in production builds. Local and hosted databases are separate. Keep real credentials and data out of local test fixtures.

```bash
npm test             # Domain, legacy recovery, authorization, SQLite concurrency
npm run typecheck
npm run test:browser # Chrome on macOS; install Chromium elsewhere
npm run build
npm start            # Preview the built Worker locally
```

Browser tests reset the loopback preview household with fictional data before each case. Do not run them against a local database containing records you want to keep; export a backup first. They refuse to reset anything other than the fictional loopback identity. On Linux, install Chromium with `npx playwright install --with-deps chromium`.

## Inviting an editor later

The owner must do both:

1. Add the person's ChatGPT account email through Sites sharing, preserving the custom/private audience.
2. Add the same email to the comma-separated **server secret** `WEALTH_ALLOWED_EMAILS` in Sites runtime settings and deploy to apply it.

All app-allowlisted members have household edit access. Sites project editing privileges are separate and are not required to edit financial records. Removing the email from either access layer denies further service access. Do not expose the server allowlist or real email addresses in client code, hosting manifests, migrations, or GitHub.

## Screenshot import

Open **Expenses → Import screenshot**. Choose a PNG, JPEG, or WebP image up to 10 MB, set English/German recognition and the year for dates without one, and scan. Review dates, amounts, optional descriptions, direction, and suggested categories before importing selected payments. Pasted payment lists are also supported.

Original images and raw OCR text remain on the device. OCR assets are served from the same Site; only confirmed structured payment records are saved to shared storage. Incoming, unsigned, ambiguous, and transfer-like rows are not selected automatically. Possible duplicates require review. Clear screenshots work best; arbitrary layouts and blurry photos may need corrections.

Manual category/month totals override payment sums. Overlapping imports require a choice to keep a manual total or replace it with all recorded outgoing payments for that group. A partial screenshot can understate a full month's costs when replacing a manual total.

## Development and deployment

The React interface runs on the Sites Vinext starter with a server API and D1. Keep the supplied Sites integration, .openai/hosting.json, and immutable Drizzle migrations. Generate new schema migrations with `npm run db:generate`; do not edit previously applied migrations. Sites applies hosted schema changes during deployment. The source repository and GitHub are separate destinations; publish the same reviewed revision.

Shared requests and datasets are bounded to 10 MB. Data is split into bounded database chunks, and revision updates and chunk writes occur in one transaction. Invalid input, stale edits, and failed transactions preserve the previous records.

## Documentation

- [Product requirements](docs/product.md)
- [Architecture](docs/architecture.md)
- [Decisions](docs/decisions.md)

Independent project; not affiliated with Trade Republic. No trades are executed. Projections use editable assumptions and exclude taxes and costs.
