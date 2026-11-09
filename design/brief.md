# QMS payment streaming — design brief

Status: two visual directions are ready for selection. Eight editable screens are saved in `design/explorations.pen`; readable exports and the comparison index are in `design/exports` and `design/review.md`. The application and contracts have not been implemented.

## Product

A payment-streaming app on QMS Testnet. A sender deposits QMS into a contract. The recipient can withdraw progressively as the payment unlocks. Cancelling a stream preserves the recipient's unlocked entitlement and returns the unallocated portion to the sender according to the contract's rules.

The working name is **Rill**. This is a provisional name for design exploration, not a final brand decision.

Primary users are small crypto teams and independent contributors. The first useful experience is a real one-minute stream that a visitor can create and withdraw from using their own wallet.

## What the first visit must accomplish

Within the opening screen, the visitor should understand:

- What a stream does: a funded payment becomes available over time.
- What they can try: send 1 test QMS back to themselves over one minute.
- What happens to their money: it is held by the contract until withdrawn, with network fees paid separately.
- What they need: an EVM wallet, QMS Testnet, and test tokens from the faucet.

The primary action is **Try a 1-minute stream**. The secondary action is **Create a stream**. A wallet connection is requested when it becomes necessary to perform the chosen action.

## The demonstration

1. Select **Try a 1-minute stream**.
2. Connect an EVM wallet and switch to QMS Testnet if necessary.
3. If the balance is insufficient, copy the wallet address and open the official faucet. Preserve this flow while the visitor completes the faucet captcha; check the balance when the app becomes active again.
4. Review a fixed 1 QMS payment, a 60-second duration, and the connected wallet as recipient. Estimate the network fee before submitting.
5. Sign the transaction. Distinguish waiting for a wallet decision from waiting for a block.
6. On confirmed creation, open the stream detail view. Show how much has unlocked, how much has been withdrawn, and how much remains scheduled.
7. Withdraw the available amount. The final withdrawal should reclaim all remaining entitlement at the end of the stream.
8. Link creation and withdrawal receipts to QMSScan. Keep the stream accessible after refresh.

Success means the visitor completes real contract calls and can inspect the resulting transactions. A preview or design sample must never be presented as a live transaction.

## Main screens

| Screen | Main job | Required states |
| --- | --- | --- |
| First visit | Explain and start a stream | Disconnected, connected with no streams, insufficient test QMS |
| Streams | Find incoming and outgoing payments | Active, completed, cancelled, empty; self-directed demo appears consistently |
| Create | Set recipient, amount, and duration | Valid entry, address errors, insufficient balance, review, wallet rejection |
| Stream detail | Understand and act on a payment | Running, ready to withdraw, withdrawn, completed, cancelled |
| Transaction feedback | Explain what is happening | Awaiting signature, submitted, confirmed, failed, replaced or cancelled in wallet |

Use the same information and terminology on desktop and mobile. A desktop panel can become a dedicated mobile screen; touch controls must remain comfortably sized.

## Money and time

- **Unlocked** is the cumulative entitlement earned by the payment schedule.
- **Withdrawn** is the amount already transferred from the contract.
- **Available to withdraw** is unlocked minus withdrawn.
- **Still scheduled** is the part that has not yet unlocked.
- Use native test QMS throughout the first version. Do not invent dollar prices or imply a stablecoin deployment.
- Read authoritative amounts and transaction status from the chain. A visual interpolation must not fabricate a confirmed balance.
- Show the maximum precision needed for the task. Keep number widths stable as they update.
- The duration starts when the creation transaction executes; do not silently start the timer while the signature is still pending.
- Do not call a submitted transaction successful. Do not rely on QMS's currently unavailable finalized-block state.

## Consistent demonstration snapshot

Use this internally consistent state in the initial detail-screen concepts:

| Field | Value |
| --- | --- |
| Total funded | 1.00000 QMS |
| Duration | 60 seconds |
| Elapsed | 45 seconds |
| Unlocked | 0.75000 QMS |
| Withdrawn | 0.25000 QMS |
| Available to withdraw | 0.50000 QMS |
| Still scheduled | 0.25000 QMS |
| Sender and recipient | The same demonstration wallet |

These are design sample values, not a claim that a contract has been deployed.

## Two visual directions

### Direction A — light, spacious, typographic

A quiet page of payment records with a strong typographic hierarchy. A narrow navigation rail gives way to broad open content, carefully aligned amounts, and a readable stream timeline. Detail appears in a focused side panel or its own mobile view.

Explore a warm near-white ground, dark ink text, and a restrained rust accent. Pair a characterful serif at large editorial sizes with a clear sans serif for every control and financial label. Keep rules, spacing, and alignment precise. Use a custom stream mark rather than decorative stock artwork.

### Direction B — dark, compact, time-focused

A horizontal application header and a payment list alongside a prominent stream detail area. Time and entitlement form the main composition: a clear linear progression, a stable amount, and immediate withdrawal controls.

Explore charcoal surfaces, soft light text, and a restrained pale green accent. Use a clean sans serif and carefully chosen numeric typography. Depth comes from proportion, contrast, and subtle separators. The app should remain calm and readable during repeated use.

Both directions must include first visit, active stream detail, creation flow, and a mobile composition. Colour alone is not the difference between the directions.

## Interaction craft

- Show immediate press feedback and preserve focus through state changes.
- Keep frequent actions fast; reserve motion for explaining a change or maintaining spatial continuity.
- Preserve entered values after a rejected signature or a failed request.
- Give pending transactions a clear next step, including an explorer link once a hash exists.
- Explain the recipient's retained amount and sender's return before cancellation.
- Support keyboard operation, visible focus, touch devices, and reduced motion.
- Avoid layout shifts when balances change or messages appear.
- Keep long addresses copyable and inspectable without allowing them to break the layout.
- Test repeated clicks, rapid navigation, refresh, and tab restoration.

## Design artifacts and review

Use Pen as the editable design source. Build the selected direction into reusable components and shared typography, colour, spacing, and motion decisions. Keep a relationship between the design variables and implementation tokens.

Export the core screens at readable native dimensions. Inspect the exports before presenting them. After a direction is selected, complete the remaining states in the same system and compare the implemented screens against the design at desktop and mobile sizes.

## Scope of the first implementation

- Native QMS payment streams, funded at creation.
- Creation, progressive withdrawal, cancellation, and clear handling of the remaining amounts.
- A guided self-directed one-minute demo.
- Incoming/outgoing stream discovery and individual shareable stream URLs.
- Wallet connection, network switching, faucet guidance, transaction feedback, and explorer links.
- A responsive interface with accessible forms and deliberate motion.

Contract invariants to verify include conservation of deposited funds, bounded withdrawals, recipient entitlement after cancellation, exact completion despite rounding, authorization, and the self-directed demonstration. The interface and tests must reflect the final contract semantics.

## Confirmed environment

- Node v24.21.0 and Google Chrome are available.
- Pen CLI v0.3.15 is installed at `/tmp/qms-pen-tooling/node_modules/.bin/pen`.
- Pen sign-in is verified active. The editable document and eight native-size screen exports are saved.
- Playwright is installed under `/tmp/qms-design-tools` for browser verification. The Browser plugin is not exposed in this session.
- Emil's design-engineering skill is installed in `.agents/skills/emil-design-eng`.

## Sources

- [QMS network and RPC](https://docs.qms.finance/for-developers/network-and-rpc/)
- [QMS first transaction and faucet](https://docs.qms.finance/onboarding/make-your-first-transaction/)
- [Pen CLI](https://docs.pen.dev/for-developers/pen-cli)
- [Pen design and code workflow](https://docs.pen.dev/design-and-code/design-to-code)
