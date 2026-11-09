# Rill contributor workspace

The user approved the contributor-payment direction and authorized a new deployment. Implement in the existing feature checkout and retain the warm neutral, Instrument Serif / DM Sans design. The deliverable is a working product upgrade, not a submission to the builder program.

## Product

- Connected home becomes a wallet overview: available incoming funds, incoming scheduled funds, outgoing commitments, active streams, a seven-day scheduled-release chart, and upcoming endings. Totals cover every stream page at one confirmed block. Self-streams are identified and excluded from the two-party cash-flow chart.
- A contributor creates a payment request containing recipient, amount, duration, and optional name. The shareable URL encodes those terms and the selected network/contract. Opening it shows a reviewable form; funding always requires the payer's wallet. Requests are unsigned proposals, not proof of an invoice, identity, or payment status.
- Names persist on chain for new V2 streams and appear in lists, details, and request reviews. Names are public and limited to 80 UTF-8 bytes.
- Contacts are wallet-scoped browser-local recipient labels. They can be added, selected in forms, and removed. The UI discloses their local storage. Templates provide one-minute trial, weekly contributor payment, and monthly retainer presets.
- Batch payouts accept editable recipient/amount rows or a CSV with recipient,amount,name headers. One shared duration applies to the batch. Review lists all recipients, exact total, and fee. One atomic transaction creates up to 25 separately withdrawable/cancellable streams.

## Contract and compatibility

Preserve the current `createStream`, `getStream`, `balances`, `withdraw`, `cancel`, and discovery ABI. Add `createNamedStream(address,uint64,string)`, `createStreams((address recipient,uint256 amount,uint64 duration,string label)[])`, and `streamLabel(uint256)`. Batch value must equal the sum of all deposits. All entry points retain reentrancy protection; every item uses the same validation and accrual rules as a single stream. Invalid items revert the entire batch. No administrator, protocol fee, upgradeability, or custody changes.

Recognize the immutable V1 runtime hash for existing stream management. Detect V2 by its separately compiled runtime hash. V1 supports the dashboard and unnamed request funding; names and batch payouts offer a visible setup link. Setup deploys V2 through the user's wallet, verifies the runtime, and produces a persistent share URL. Do not report a public deployment without a successful receipt and matching code.

## State and accounting

Use bigint for all amounts. Dashboard data is block-consistent, paginated, concurrency-limited, and never silently truncated. Forecasts reflect currently funded schedules, not an assertion of automatic wallet payments. Confirmed balances update on chain polling. Pending batch recovery retains action identity, receipt matching, and all resulting stream IDs; account/chain changes invalidate reviews. Local contacts are isolated by wallet and chain, with storage failures visible.

## Validation and delivery

Contract tests cover atomicity, exact value, bounds, labels, ownership, conservation, and individual claims after a batch. Domain tests cover CSV/request validation, pagination-independent aggregates, cancellation, self-streams, and seven-day forecast math. Browser tests run real local-chain transactions for requests, batch review/funding, recipient withdrawal, contacts, refresh recovery, existing trial flows, and mobile layouts. Browser plugin is absent; use the repository's Playwright/Chrome harness. Document deployment state and builder positioning/90-day roadmap without inventing traction.
