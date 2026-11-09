# Rill implementation specification

The user selected Direction A and authorised implementation. The visual authority is `design/exports/a-first-visit.png`, `a-active-stream.png`, `a-create-stream.png`, and `a-mobile.png`. Product behaviour is described in `design/brief.md` and `design/interaction-notes.md`.

## Architecture

Use Vite, React, TypeScript, viem, and standard CSS. Serve as a static application with hash routes so it works on any static host. No database, server authentication, or offchain custody is needed. Discover injected EVM wallets through EIP-6963 with an EIP-1193 fallback; never collect private keys. Persist only wallet connection preference, the verified contract address, and pending transaction metadata in versioned local storage. The wallet remains the signing authority.

QMS Testnet: chain ID **19480**, RPC **https://rpc.testnet.qms.finance**, explorer **https://testnet.qmsscan.io**, native currency **QMS**, 18 decimals. Use the official faucet **https://faucet.testnet.qms.finance**. Default chain data always comes from QMS; explicit development environment overrides allow local-chain integration tests.

## Contract

Implement `RillStream` in Solidity, compiled for the Paris EVM. No administrator, upgradeability, token minting, or protocol fee. Deposit native currency at creation and unlock it linearly. Accept durations from **60 seconds to 365 days**, positive deposits, and nonzero recipients. Stream identifiers start at 1.

The stored stream has sender, recipient, deposit, withdrawn, refunded, startTime, endTime, and cancelledAt. `createStream(address recipient,uint64 duration)` is payable and returns the ID. `withdraw(uint256 streamId)` transfers all presently available entitlement only to the authorised recipient. `cancel(uint256 streamId)` is sender-only, stops accrual before the scheduled end, and immediately returns the still-scheduled amount to the sender. Unlocked recipient funds stay claimable after cancellation. All mutating fund methods must defend against reentrancy and update state before external transfers. Failed transfers revert state changes.

Views: `getStream(uint256)`, `balances(uint256)` returning unlocked/available/scheduled, `streamCount(address)`, `streamsFor(address,uint256 cursor,uint256 limit)` returning unique IDs and next cursor. A self-directed stream is indexed once. Limit pages to 100 entries. Emit creation, withdrawal, and cancellation events with stream ID and relevant amounts.

The accounting invariant is `deposit = withdrawn + available + scheduled + refunded`. Accrual clamps to the effective end; final withdrawal returns all rounding dust. All money arithmetic in the app uses bigint. All displayed spendable values derive from an identified latest block, not a wall-clock animation.

## Deployment and contract identity

Support `VITE_STREAM_CONTRACT_ADDRESS`, a previously saved address, or a `contract` URL query parameter. Before enabling fund transactions verify the contract's runtime bytecode hash against the compiled artifact and verify the selected chain. A missing or mismatched contract cannot be represented as a working deployment.

Provide a separate `#/setup` route for a one-time deployment through the connected browser wallet. Dynamically import deployment bytecode only on that route. After a confirmed deployment, verify code, store the address, and produce a shareable app URL containing the address. Shared links are safe to use only after the same runtime hash check. No private keys in client code, source control, logs, or chat.

## App routes and states

- `#/`: first visit matching the approved screen; previews are labelled. Connected visitors with streams can access the list.
- `#/streams`: incoming/outgoing/all filtering, genuine onchain items, useful empty and error states; one row for a self stream.
- `#/create`: recipient, amount, duration, optional self shortcut, cancellation explanation and review. The one-minute trial prefills recipient with the connected wallet, 1 QMS and 60 seconds.
- `#/streams/:id`: confirmed amounts, timeline, stream facts, events/receipts, withdrawal and sender-only cancellation. Refresh and direct sharing work.
- `#/activity`: wallet-related creation/withdrawal/cancellation history.
- `#/setup`: wallet-based contract deployment and share link.

Wallet, network switching, faucet handoff, review, awaiting-signature, submitted, confirmed, rejected, failed, timed-out-pending, and cancellation confirmation states must be explicit. Pending hashes survive refresh. Do not treat a timeout as a mined failure. Revalidate the account, network, balance, and verified contract immediately before sending. Preserve form values after rejection. Network/account changes must invalidate stale action context.

## Visual and interaction requirements

Match A's 214 px desktop sidebar, main 56 px horizontal padding, warm #FAF9F6 background, #F2F0EB rail, #252721 ink, #66685F secondary text, #B95E40 chart accent, #A44D32 accent text, and #EEE8DE soft panels. Use Instrument Serif for display text and DM Sans for controls and numbers, served locally. Use Lucide icons. Keep the three homepage onboarding columns, the dedicated stream page, and the payment preview next to the creation form.

At mobile widths use the approved 390 px layout: header replaces sidebar, 20 px content padding, stacked details, 48 px primary buttons, and at least 44 px interactive touch targets. Visible keyboard focus, labelled fields, accessible dialogs, Escape handling, focus restoration, and reduced motion are required. Use tabular figures. Animate only purposeful state changes and button presses.

## Verification and delivery

Use actual local EVM transactions for contract and browser integration tests. Verify conservation, authorization, cancellation, self-stream indexing, exact completion, failures, and reentrancy. Test the first-visit-to-withdrawal flow, wallet rejection/retry, refresh, wrong network, and insufficient funds. Inspect screenshots at 1440×1000 and 390 px width against the selected Pen exports. Browser plugin is absent; use Playwright with installed Chrome. Do not claim QMS deployment until an actual receipt is available.

Publish the finished code to the existing private GitHub repository, with setup/run/deploy instructions and clear current deployment status. The user's previous request to push this project to GitHub remains applicable.
