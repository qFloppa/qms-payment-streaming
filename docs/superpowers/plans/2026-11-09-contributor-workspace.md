# Contributor Workspace Implementation Plan

> Execute inline in this session, retaining the project's prior solo implementation preference. Use the executing-plans workflow and meaningful test-first coverage for money and transaction behavior.

**Goal:** Deliver a QMS contributor-payment workspace with atomic batch payouts and payment request links.

**Architecture:** Keep the static React/viem client and add a backward-compatible V2 Solidity contract. Query complete wallet portfolios at a fixed block; keep contact metadata local and stream names on chain.

**Tech Stack:** React 19, TypeScript, Vite, viem, Solidity 0.8.38/Paris, Node tests, Anvil, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-09-contributor-workspace-design.md`

## Global constraints

- QMS Testnet chain 19480, native QMS with 18 decimals; no fabricated fiat prices or usage.
- Existing V1 streams remain manageable; new deployment is explicitly V2.
- Durations 60 seconds to 365 days; 25 batch recipients maximum; names at most 80 UTF-8 bytes.
- Tests and client must retain wallet review, rejection, replacement, pending recovery, and runtime verification.

### 1. V2 atomic payments

Files: `contracts/RillStream.sol`, `tests/contracts.test.mjs`, generated `contracts/artifacts` and `src/contracts`.

- [x] Add failing tests for `createStreams([{recipient,amount,duration,label}])`: distinct IDs/owners/labels, exact total, invalid item rollback, bounds, individual withdrawal/cancellation.
- [x] Run the added cases against the current artifact and confirm the missing V2 API.
- [x] Extract `_createStream(recipient,duration,amount,label)`; preserve `createStream`; add named and batch entry points and public `streamLabel` mapping.
- [x] Recompile and run the full contract suite.

### 2. Portfolio and request domain

Files: `src/lib/workspace.ts`, `src/lib/chain.ts`, `src/hooks/useSnapshot.ts`, `tests/workspace.test.ts`, `package.json`.

- [x] Add failing examples for mixed sender/recipient/self/cancelled portfolio accounting; hand-derived forecast deltas; strict request URL and CSV parsing.
- [x] Implement `summarizeStreams(streams,wallet,timestamp)`, `parsePayoutCsv(text)`, `parsePaymentRequest(params)`, and safe request URL construction with bigint validation.
- [x] Add V1/V2 runtime identification and fixed-block full portfolio reads using bounded concurrent page/stream calls. Retrieve labels only on V2.
- [x] Run unit tests and TypeScript checks.

### 3. Transaction integration

Files: `src/context/RillContext.tsx`, `src/lib/transactions.ts`, `src/components/ReviewDialog.tsx`, `src/pages/Setup.tsx`, `tests/wallet.test.ts`.

- [x] Extend pending action parsing for batches; verify malformed batch identity is rejected.
- [x] Encode named and batch calls, preserve exact calldata through pending recovery, and navigate successful batches to stream lists.
- [x] Show all payout recipients/names/amounts in review; detect wallet changes and duplicate sends through existing gates.
- [x] Expose V2 deployment and distinguish an existing legacy deployment from a new compatible V2 deployment.

### 4. Contributor UI

Files: new dashboard, request, batch, and contacts pages; `src/hooks/useContacts.ts`; existing create/list/detail/shell; `src/styles/workspace.css`.

- [x] Write browser scenarios for request creation to funding, named batch review to independent withdrawal, and contact persistence.
- [x] Implement wallet overview with exact metrics, current schedules chart, upcoming endings, and empty states.
- [x] Add request links, named forms/templates, editable payout rows/CSV import, local contacts, and consistent navigation.
- [x] Verify mobile overflow, keyboard controls, real receipt feedback, and retained trial flow through Playwright.

### 5. Delivery

Files: README, deployment guidance, builder program roadmap; local QA screenshots outside source control.

- [x] Run contract/unit/browser suites, typecheck, and production build; inspect desktop/mobile screenshots and review the complete diff.
- [x] Document V2 availability, V1 compatibility, local metadata, request semantics, current deployment status, and a realistic 90-day plan.
- [x] Deploy on QMS only if an authorized signer is actually available; otherwise leave the tested wallet deployment flow ready and state the precise remaining signature requirement.

## Delivery state

Implementation and local verification are complete: 21 contract tests, 14 unit tests, and 18 browser tests passed. The production build includes TypeScript verification. Desktop and mobile screenshots were inspected; the production preview on port 4174 detects the real QMS V1 deployment and exposes the V2 wallet deployment flow without browser errors or warnings.

The user deployed V2 on QMS Testnet at `0xC53B89bd7e67B8cC6bdbae64E068F6710C719Efc`. Source and ABI were verified on November 9, 2026; QMSScan reports partial match because compiler metadata was omitted, while full creation/runtime bytecode match exactly. The example and local configuration now select V2. Implementation is on `main`; deployment evidence is recorded in `docs/rill-verification.md`.
