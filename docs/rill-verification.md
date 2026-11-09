# Rill implementation and verification

This document records the original **V1** release. The current source builds **V2**, adding named streams and atomic contributor payouts. V2 has a different runtime hash and is not yet deployed on QMS Testnet; see the current [README](../README.md) and [builder notes](builder-program.md). The V1 deployment and source-verification evidence below remain historical evidence for that original contract.

Direction A remains the approved design. Implementation resumed on `feat/rill-app` from `1fe7d97044c9319b6282f5f86a84e56a4417d55b`. Work was performed solo as requested; the plan's independent-agent review was replaced by a separate manual review of contract invariants, wallet state, receipt handling, data queries, and rendering.

## Runtime and deployment

The app is a static React/Vite client using native QMS escrow. `src/contracts/rill.ts` exports `rillAbi` and `rillRuntimeHash`; `src/contracts/deployment.ts` exports `rillBytecode` and is loaded dynamically on setup. Solidity 0.8.38 targets Paris with deterministic optimizer/metadata settings.

Expected deployed runtime hash:

`0xf2c103e279572ac31806764e3b405b9e4c43651d3d4ac3356d818d0b21cc9b27`

The owner deployed Rill on QMS Testnet through their wallet on November 9, 2026. The browser tests independently deploy and verify the same bytecode on disposable Anvil.

## QMS Testnet deployment

- Network: QMS Testnet, chain ID `19480` (`0x4c18`).
- Contract: [`0x5AB83339041a650214D7D1086c4f8dD428701BCE`](https://testnet.qmsscan.io/address/0x5AB83339041a650214D7D1086c4f8dD428701BCE?tab=contract).
- Deployment transaction: [`0xe6dc9cc35e076d447725ba2453eaaa50435f8342fa0054a1b0ec79b5dddac608`](https://testnet.qmsscan.io/tx/0xe6dc9cc35e076d447725ba2453eaaa50435f8342fa0054a1b0ec79b5dddac608).
- Compiler: `v0.8.38+commit.1835d247`; EVM target: `paris`; optimizer: enabled, 200 runs.
- Metadata settings: `bytecodeHash: "none"`, `appendCBOR: false`; no constructor arguments or external libraries.
- Source and ABI published through QMSScan's Solidity standard JSON input verification endpoint at `2026-11-09T19:06:17.475304Z`.

Verification recompiled `contracts/RillStream.sol` with the artifact's compiler settings. The creation bytecode matched both the artifact and explorer deployment input exactly. Runtime bytecode from the public RPC and explorer also matched the artifact exactly, with the runtime hash above. The source returned by QMSScan was compared with the repository source and matched.

QMSScan reports `is_verified: true`, `is_partially_verified: true`, and **Contract source code verified (partial match)** in its UI. The build omits CBOR compiler metadata; Blockscout's verifier requires matching CBOR metadata to classify a match as full. The partial label is retained here even though the complete creation and runtime bytecode match. The explorer's published contract name, compiler version, optimizer settings, source, and ABI were checked after submission.

## Functional coverage

Final local result: **37 tests passed** (18 contract, 8 unit, 11 browser); TypeScript and the production build passed. A clean `npm ci` succeeded. The built production site and lazy setup route were also checked in Chrome with no page or console errors.

Commands: `npm test`, `npm run test:contracts`, `npm run typecheck`, `npm run build`, and `npm run test:e2e`.

The contract suite covers conservation, exact 45-second accrual after a prior withdrawal, final dust, withdrawal/cancellation authorization, duration and recipient validation, unique self indexing, pagination, nonexistent IDs, rejected transfers, reentrancy across all fund entry points, extreme arithmetic, and deployment CLI chain checks.

Browser flows use a test-only EIP-1193 adapter forwarding real transactions to an owned Anvil process. Production code contains no fixture wallet or connected-screen sample data. Coverage includes trial creation, partial and final withdrawal, cancellation with retained entitlement, refreshed pending hashes, declined signatures and retry, changed accounts, network switching, insufficient funds and faucet handoff, contract mismatch rejection, wallet deployment and share links, deduplicated lists, and live activity after loading historical pages.

Two initial harness defects were corrected: Anvil's transaction pool rejects costs above uint128 (the overflow fixture now seeds escrow state and exercises the deployed EVM), and wall-clock mining could shift the fixed design snapshot during browser interaction (browser tests now control block timestamps). Normal contract funding tests use actual native deposits.

## Review findings resolved

- Network switching could invalidate its own account synchronization. The final network and accounts are now read together and guarded by the wallet revision.
- A recovered replacement could have a successful receipt while representing a cancelled stream action. Recovery now retains replacement intent and checks receipt sender, target, event, and stream ID before reporting success.
- Loading older activity initially stopped watching the latest range. Historical and recent ranges now update together; queried ranges replace old events so orphaned entries are not retained in those ranges.
- A configured empty environment variable could mask the saved deployment. Empty configuration now falls through to the chain-specific saved address.
- The approximate rate now rounds independently from spendable balances; the one-minute preview reads approximately 0.01667 QMS/sec. Spendable amounts always truncate and reveal small nonzero dust.
- Mobile cancellation moved below activity; the mobile From/to row and numerical proportions now follow the approved composition. The skip link focuses content without changing the hash route.

## Visual verification

Browser plugin not available; regular Playwright with installed Chrome is the fallback. Accepted exports and actual screenshots were inspected with `view_image`. Desktop viewport: 1440 × 1000. Mobile viewport: 390 × 844, with full-page captures.

| Comparison           | Accepted reference                   | Implementation check                                                                                |
| -------------------- | ------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Copy and hierarchy   | `design/exports/a-first-visit.png`   | Exact headline, trial CTA, secondary link, preview label, and three onboarding steps                |
| Shell and spacing    | All desktop A exports                | 214 px rail, 56 px main gutters, open composition and warm rail/background                          |
| Typography and money | First visit and active stream        | Local Instrument Serif and DM Sans, tabular figures, matched number spacing and hierarchy           |
| Palette and icons    | All A exports                        | Warm `#FAF9F6`, ink `#252721`, rust `#B95E40`, soft `#EEE8DE`, Lucide stroke icons                  |
| Form composition     | `design/exports/a-create-stream.png` | Recipient, large amount, four duration choices, terms, and adjacent payment preview                 |
| Timeline             | `design/exports/a-active-stream.png` | Sixty ticks, quarter-duration labels, withdrawn/available/scheduled segments and balances           |
| Responsive detail    | `design/exports/a-mobile.png`        | Header, 20 px gutters, stacked amounts/details, full-width withdrawal, activity then cancellation   |
| Keyboard and motion  | Interaction notes                    | Native modal focus trap, Escape and focus restoration, visible focus, touch targets, reduced motion |

Above-the-fold first-visit copy matches the approved screen. Functional differences are deliberate: real addresses, balances and timestamps replace samples; local testing names the local network; a share control and confirmed-block note make live data inspectable; a mobile menu exposes navigation. QMSScan links use QMS deployment data and are not invented for local transactions. Form errors, status messages and setup reflect actual state.

Temporary screenshots, traces, and fidelity evidence are under `/tmp/qms-qa`; they are not application assets or source-control content. The original A/B gallery stays in README and the original exports are unchanged. Related dialog, empty, list, completion, cancellation and mobile form states have been added to `design/explorations.pen`.

## Delivery checks

CI installs locked dependencies, recompiles and checks generated contract artifacts, runs unit and contract tests, checks TypeScript, builds the static client, and runs browser integration tests. Native deployment bytecode remains a separate output chunk. No private keys are stored in the client or repository.
