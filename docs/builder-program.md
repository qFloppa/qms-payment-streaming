# Rill · QMS Builder Program

## Project description

Rill helps QMS teams fund contributor payments upfront and release them over time, with transparent balances and recipient-controlled withdrawals. Teams can create up to 25 independent payment streams in one atomic transaction. Contributors can share a payment request containing their wallet, amount, duration, and an optional public stream name. A wallet overview shows withdrawable balances, commitments, and upcoming release schedules.

## Why QMS

The initial users are QMS ecosystem teams and contributors who need to pay each other in native QMS. Rill gives them a payment workflow, a shared onchain record, and a simple way to try QMS with a one-minute stream. EVM compatibility lets Rill use existing wallets and development tools. Potential support from the QMS team includes introductions to pilot teams and guidance on supported account features.

Rill currently uses conventional EVM wallet signing. It does not claim to implement post-quantum accounts, useful-work settlement, or capabilities that are not integrated and tested.

## Evidence available

- Original V1 contract on QMS Testnet: `0x5AB83339041a650214D7D1086c4f8dD428701BCE`, with published source and exact bytecode comparison documented in `docs/rill-verification.md`.
- V2 contract on QMS Testnet: [`0xC53B89bd7e67B8cC6bdbae64E068F6710C719Efc`](https://testnet.qmsscan.io/address/0xC53B89bd7e67B8cC6bdbae64E068F6710C719Efc?tab=contract). Source and ABI are verified with the explorer's partial-match label; full creation and runtime bytecode match a fresh compilation exactly. The generated artifact, CI workflow, local-chain contract tests, and browser tests are in the repository.
- Working flows for batch funding, request-to-stream funding, independent withdrawals, cancellation, receipt recovery after refresh, and legacy deployment compatibility.
- No external pilot users or adoption metrics have been established in this work. Local test accounts and self-directed trials are not customer traction.

## Suggested demonstration

1. Open the connected overview and explain incoming funds and outgoing commitments.
2. Import a two-person CSV payout, showing each wallet, amount, and name in the review.
3. Fund the batch in one transaction and open the resulting independent streams.
4. Switch to a contributor wallet, let part of the payment unlock, and withdraw it.
5. Create a payment request, open its shareable link, and show the payer's editable review.

Use testnet labels throughout. The overview is derived from actual chain state; do not present sample data as adoption.

## 90-day plan

| Period     | Deliverable                                                                                                                                             | Evidence to collect                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Days 1–30  | Deploy and verify V2, host a public demo, recruit 3–5 QMS contributor teams, improve onboarding from observed problems.                                 | Completed sender-to-recipient flows, permissioned pilot feedback, abandoned-step reasons.                  |
| Days 31–60 | Improve batch payouts and reporting from pilot usage; add reusable payout drafts and deliberate renewals if teams need them.                            | Repeat payers, distinct participating recipients, successful withdrawals, repeat workflow completion.      |
| Days 61–90 | Refine recurring contributor workflows; evaluate scheduled starts or stable-value assets only against confirmed ecosystem availability and user demand. | Retention, support volume, documented product decisions, and the next reviewed contract scope if required. |

These are planned milestones and recruitment targets, not completed traction. Scheduled starts, cliffs, top-ups, shared projects, and public grant pages are future options and are not part of the current release.

## Before submitting

Provide a hosted HTTPS demo, reviewer access to the repository, the V2 explorer address after deployment, a short demonstration video, and accurate founder/project links. The existing repository is private; arrange reviewer access or deliberately publish it before using it as accessible shipping evidence.

Official program guidance: https://qms.finance/builders-program (reviewed November 9, 2026). The page highlights shipping evidence, a clear reason for QMS, a verifiable team, a 90-day plan, and real users.
