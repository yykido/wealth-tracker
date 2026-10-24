# Decisions

Last updated: 2026-10-24

Accepted decisions describe agreed intent, not completed implementation. This log records the current direction and meaningful superseded choices rather than the full conversation.

## D001: Tracking and hypothetical projections

Status: accepted.

Track spending and asset values without executing trades. Keep actual balances, contributions, and hypothetical scenarios separate. A particular portfolio allocation or assumed return is not a fixed application requirement.

## D002: React, TypeScript, and Vite

Status: accepted; exact versions pending scaffolding.

Use React for the interface, TypeScript for domain types and calculations, and Vite for local development and static builds. Use Recharts for charts and Dexie for IndexedDB access. CSV parsing libraries can wait until CSV import is implemented.

Reason: all first-version behavior can run in a browser with static hosting.

## D003: Browser-local financial records

Status: reinstated and accepted under D009.

Use IndexedDB as the source of truth. Data is specific to a website origin and browser profile. No automatic cross-device sharing is implied. Backup and restore are essential because browser storage can be cleared.

## D004: Manual updates before file imports

Status: accepted; narrowed to manual entry for the first version.

Start with monthly expense totals per category and dated account snapshots. Preserve previous snapshot dates, and edit rather than duplicate a total for the same month/category or account/date. Track cash flows separately when available.

CSV imports, transaction-level expenses, and brokerage integrations are later enhancements. This keeps the initial tracker small and avoids import-format complexity.

## D005: GitHub contains code, not personal data

Status: accepted.

Commit application code, documentation, dependency lockfiles, and fictional examples. Keep real records, backups, account identifiers, and credentials outside the repository. Review files before committing; private repository visibility does not replace data separation.

Updating personal data is a browser operation, not a Git commit or deployment.

## D006: Develop locally and host the personal app on Sites

Status: accepted; deployment not yet configured.

Develop and verify locally, version the source on GitHub, and deploy static application files through Sites. Start the Site with a private audience. The deployed personal tracker stores records in each user's browser and does not require the developer's Mac to remain running.

A production bundle may contain fictional examples, never personal records. GitHub and Sites are separate source destinations whose release revisions must remain identifiable.

## D007: Markdown documentation and GitHub tasks

Status: accepted.

Use the README as an entry point, product.md for requirements, architecture.md for technical design, and this file for decisions. Use GitHub Issues for implementation tasks when work starts.

## D008: Local Spring Boot backend

Status: superseded by D009; never implemented.

A local Spring Boot service and PostgreSQL database were considered to support backend-managed persistence. The user subsequently selected a simpler browser-only design to avoid backend operation, sleep-related availability, and secure remote access requirements.

Revisit a backend only if concrete requirements such as shared household access, synchronization, or background integrations justify it.

## D009: Simplify the first version

Status: accepted.

Use a browser-only tracker with manual monthly expenses, asset snapshots, projections, and JSON export/restore. No backend, database server, tunnel, service manager, or always-on machine is required.

Reason: meet the tracking needs with fewer operational dependencies while retaining GitHub version control and Sites hosting.

Consequence: browser databases are separate across devices and origins. Users move data manually through backups. CSV import follows the manual workflow rather than blocking the first release.

## D010: Versioned JSON backup and replacement restore

Status: accepted.

Export all supported records and settings as a versioned JSON file. Read restores locally, validate completely, preview counts and date, warn about replacement, and require confirmation. Offer an export of existing records before replacing them atomically.

Reason: support recovery after browser data loss and manual migration to another browser, device, or origin.

Consequence: invalid or failed restores preserve existing records. Merge is outside scope. Recovery includes only data present at export. Plain JSON is not encrypted and must be stored privately outside GitHub. The app can be redeployed from source or run locally before restoring if Sites is unavailable.

## Open decisions

- Interface styling and exact compatible dependency versions.
- CSV formats and transaction-level tracking, after the first manual release.
- Individual investment holdings, if account-level snapshots prove insufficient.
- Whether future shared family use warrants synchronization and authentication.
