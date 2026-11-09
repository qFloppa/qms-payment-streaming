# Interaction notes for the selected direction

These requirements accompany the visual exploration. The screenshots are static samples, so motion, wallet behaviour, chain reads, and contract calls still need implementation and verification.

## First visit to first withdrawal

| Situation | User-facing behaviour | State to preserve |
| --- | --- | --- |
| Visitor selects the one-minute trial | Explain the 1 test QMS deposit, 60-second duration, and return to their connected wallet; request the wallet connection when needed | The selected trial |
| Wallet is on another network | Offer QMS Testnet switching; retain the flow if the user declines | Wallet and trial parameters |
| Not enough test QMS | Show the required deposit plus estimated fee, copy-address control, and official faucet link; explain that the faucet opens separately | Recheck the balance on return without resetting the flow |
| Ready to review | Show recipient, deposit, duration, network, and estimated network fee; the timer has not started | Recipient, amount, and duration |
| Awaiting signature | Say that the wallet needs confirmation; prevent duplicate submissions | Exact transaction intent |
| Transaction submitted | Show a pending state and an explorer link when the hash exists | Transaction hash and intent across refresh |
| Signature rejected | Return to a reviewable form with the entered values intact | All form values |
| Transaction failed | Explain the failure and offer a deliberate retry; do not show a stream as created | Form values and any available receipt |
| Creation confirmed | Open the stream's shareable detail URL; derive the schedule from the contract's actual start timestamp | Stream identifier |
| Withdrawal submitted | Keep the confirmed withdrawn amount until the receipt succeeds; show the pending action clearly | Withdrawal hash and stream identifier |
| Stream fully unlocked | Explain that the remaining amount can be withdrawn; remove the time-left state | Final entitlement and withdrawal history |
| Stream completely withdrawn | Show completion, receipts, and a clear create-another-stream action | The stream remains accessible |

The chain's target block interval is roughly 10 seconds and can vary. A visual timer may explain elapsed time, but it must not present interpolated values as an authoritative confirmed balance. Refresh contract data after receipts, new blocks, and tab restoration. The current network's `safe` and `finalized` tags are unsuitable for determining completion.

## Cancellation

Only the authorised sender gets the cancellation control. Before signing, explain the recipient's retained entitlement and the sender's refund using current contract data. If those values can change before execution, identify them as estimates. After confirmation, show the exact settled amounts. Cancellation must not erase the recipient's unlocked entitlement.

## UI craft

Use tabular figures and stable amount containers so changing numbers do not shift adjacent controls. Long addresses must be inspectable and copyable; truncated labels are for display only. Form errors belong beside the field and should not wipe the user's input.

Buttons give immediate press feedback, using a subtle scale change over roughly 120–160 ms. Menus and feedback transitions use a short ease-out, generally 150–220 ms. Frequent navigation and keyboard actions should be immediate. Avoid bouncing financial values or celebratory effects on routine withdrawals. Respect reduced-motion preferences and restrict hover effects to devices that actually support hover.

Keyboard focus, validation announcements, disabled and pending states, address-copy feedback, touch ergonomics, and screen-reader behaviour require browser verification in the implemented app. Colour is supported by labels; it must never be the only way to understand a stream's state.

## Remaining visual states

Design these in the chosen system before the corresponding app flow is implemented: connected empty state; stream list with several entries; wallet/network selection; faucet handoff; creation review; awaiting signature; submitted transaction; rejected signature; failed transaction; no available balance; final withdrawal; completed stream; cancelled stream; cancellation confirmation; manual-recipient form errors; mobile creation and review.
