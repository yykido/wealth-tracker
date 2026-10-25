# Product requirements

Last updated: 2026-10-25

## Purpose

Give an invited household a consistent view of spending, recorded assets, and hypothetical investment growth across browsers and devices. The app records and analyzes information; it does not execute trades or log in to a brokerage.

## Access and shared records

- Require ChatGPT sign-in. Only accounts admitted by both private Sites access and the server allowlist may read or write financial records.
- Initially admit only the owner. Additional accounts can be invited later and may edit the same household.
- All admitted accounts see the same central records. Refresh periodically while not editing and provide a manual refresh button.
- Reject stale edits rather than silently overwriting another member's changes. Validate records on the server.
- Keep real records, personal emails, secrets, and backups out of GitHub and frontend bundles.
- Restore, deletion, and loading fictional examples affect every household member. State this clearly before confirmation.

## Expenses and payments

- Add, edit, and delete one manual total per category and month, with an optional note.
- Let users create categories and display euro amounts with German formatting.
- Import a list of payments from a PNG, JPEG, or WebP screenshot/photo, or from pasted text.
- Run English/German OCR on the device using same-origin assets. Keep original images and raw OCR text transient; upload only the structured records the user confirms.
- Review dates, positive amounts, outgoing/incoming direction, optional descriptions, and category suggestions. Allow corrections, deselection, and adding missed rows.
- Leave incoming, unsigned, ambiguous, and transfer-like rows unselected by default. Require explicit review of possible duplicates.
- A manual category/month total takes priority over outgoing payment sums. Never add both. Require a choice before replacing an overlapping manual total, and show that a partial screenshot can understate a full month.
- Incoming payments are stored but excluded from spending. Editing and deleting recorded payments update calculated totals.
- Expenses describe spending; they do not automatically change asset snapshots.

## Assets and cash flows

- Create brokerage, bank, and savings accounts using nicknames, without account numbers or login credentials.
- Record dated cash and investment market values separately. Preserve previous dates and edit rather than duplicate an account/date snapshot.
- Show when values were recorded; do not claim they are live prices.
- Sum latest recorded account values with their dates disclosed, avoiding double counting brokerage cash and investments.
- Record contributions, withdrawals, and paired internal transfers separately. Incomplete cash-flow history does not support reliable investment performance claims.

## Projections

- Enter initial value, monthly contribution, assumed annual return, duration, and optional inflation adjustment.
- Save scenarios separately from actual financial records.
- Show contributed capital and hypothetical growth separately, with clear contribution timing and compounding assumptions.
- Treat any assumed rate as a scenario, not a forecast. Exclude taxes and fees initially and label that limitation.
- Use fictional examples rather than household details from the discussion.

## Migration, backups, and recovery

- Keep existing browser-only IndexedDB records intact. After authorized sign-in, offer a separate browser-only backup or a migration preview.
- Do not upload prior browser records automatically. Preview counts and require explicit confirmation before replacing shared data.
- Export all supported collections and settings as a versioned JSON backup.
- Restore version 1 and 2 backups after complete validation. Reject invalid or unsupported files without modifying current records.
- Restore replaces the shared household atomically; merging is outside scope. Offer a backup of current records before replacement.
- Clearing browser data does not delete centrally stored records. A backup recovers only its exported state.
- JSON backups are readable and unencrypted and must be kept private outside the repository.

## Storage boundaries

| Location                     | Contents                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------ |
| Sites-managed D1             | Shared household records and revision metadata                                 |
| Runtime secret settings      | Account admission allowlist, never exposed in browser code                     |
| Browser memory               | Current authorized view, original screenshot, raw OCR text, and unsaved review |
| Legacy IndexedDB             | Earlier browser-only records, retained for reviewed migration                  |
| GitHub and deployment source | Code, schema-only migrations, documentation, and fictional tests               |
| User's backup file           | Exported financial records and settings                                        |

## Outside current scope

- Public access to financial records, view-only member roles, and multiple independent households.
- Spring Boot, an always-on personal machine, tunnels, or a separate hosted backend provider.
- Brokerage APIs, trade execution, live price feeds, CSV/Excel imports, or PDF extraction.
- Multi-currency conversion, tax filing, investment recommendations, and probabilistic forecasts.

## Acceptance criteria

1. Anonymous and uninvited requests return no household data and cannot mutate storage.
2. Two admitted accounts can read and edit the same shared household across separate browsers.
3. A stale update fails without changing the winning records, and failed writes roll back.
4. Prior browser data remains local until migration is reviewed and confirmed.
5. Expenses and assets avoid duplicate counting; actual records stay separate from projections.
6. Bulk import supports optional descriptions, duplicate review, and explicit manual-total conflict handling.
7. Backups recover all supported records; invalid or failed restores leave shared data unchanged.
8. Original screenshots and raw OCR text remain on-device, and source control contains no personal financial data.
9. The deployed service works independently of the owner's Mac and starts with only the owner admitted.
