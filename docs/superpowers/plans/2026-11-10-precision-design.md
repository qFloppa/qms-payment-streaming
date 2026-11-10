# Precision design implementation plan

**Goal:** Apply the user's selected Precision fintech concept to the working Rill app, including its logo, photography, and deliberate motion.

**Reference:** `design/concepts/precision.png` and `design/concepts/precision.html`, selected by the user on 2026-11-10. Preserve the existing payment workflows and navigation.

**Architecture:** Keep React/Vite and the current page structure. Add a reusable SVG mark and an isolated illustrative preview component; update shared CSS tokens and component treatments. Use CSS for interface motion and an isolated timer for the preview. Financial data outside the illustrative preview remains chain-derived.

**Constraints:** White `#ffffff`, rail `#f7f8fa`, navy `#182c48`, blue action `#2f5dda`, muted `#687585`, rules `#e4e8ef`. DM Sans throughout. Follow the reference's 226px rail, 55px desktop gutters, three-line heading, grayscale water strip, framed preview, action cards, and onboarding band. Extend the same system to mobile with readable labels and 44px touch targets. Keep all existing core copy; accepted editorial additions are “Always in flow.” and “Your first stream.”

## 1. Brand and shared design system

- [x] Add `src/components/RillMark.tsx` with the accepted double-channel r geometry; apply it in `Shell.tsx` and `public/rill.svg`.
- [x] Update `shell.css`, `pages.css`, `workspace.css`, and `dialogs.css` to the selected palette, typography, surfaces, control states, and responsive sizes. Keep semantic error/success colors distinct.
- [x] Add `src/styles/motion.css`: short CSS entrances, hover/press feedback, dialogs, notices, navigation, and timeline state transitions. Respect reduced motion and touch hover behavior.

## 2. First visit and working preview

- [x] Verify browser tests in `tests/e2e/design.spec.ts` for preview progress, pause/resume, replay, offscreen suspension, hidden-tab suspension, accounting consistency, and reduced-motion default. Implementation and the first three tests were already present when this session resumed; this verification does not claim a fresh test-first cycle.
- [x] Add `StreamPreview.tsx`: start at the accepted 45-second snapshot, progress to 60 seconds, stop at completion, offer replay from 45 seconds. Pause when hidden/offscreen; do not auto-play with reduced motion. Preview values and time must remain internally consistent.
- [x] Implement the accepted first visit composition in `Home.tsx` and `src/styles/home.css`; bundle the existing water photograph as `public/stream-water.jpg` and record its source.

## 3. Verification and publishing

- [x] Run the new browser tests, existing unit tests, production build, and existing transaction browser suite.
- [x] Inspect the accepted concept and latest screenshot at 1536 × 1024. Compare copy, typography, layout, palette, logo, imagery, timeline, and spacing. Check mobile and intermediate widths, focus, reduced motion, form review, and real local-chain creation/withdrawal.
- [x] Review the complete UI diff against the plan, including listener/timer cleanup, wallet isolation, responsive navigation, semantic status colors, and reduced motion. Reviewed directly because the user explicitly prohibited subagents; no independent agent review was performed.
- [x] Update the design records and README, including the current screenshot and photograph attribution.

Publishing follows the user's existing GitHub instruction: commit and push to `main`, then check the GitHub/Vercel statuses and the production URL. Report the observed release status in the handoff.

## Verification evidence — 2026-11-10

`npm test`: 14 passed. `npm run test:contracts`: 21 passed. `npm run test:e2e`: 22 passed. `npm run build`: passed. Generated contract artifacts remain unchanged.

Playwright Chromium was used because the Browser plugin was unavailable. Direct `view_image` inspection compared `design/concepts/precision.png` with the final 1536 × 1024 screenshot, now saved at `docs/images/rill-desktop.png`. Also inspected mobile home, funded workspace, active stream, batch form, payment request, and transaction review screenshots.

| Before | After | Why |
| --- | --- | --- |
| Desktop labels and action text were larger than the reference | Reference typography and spacing restored | Preserves the selected composition and first-screen fit |
| Dashboard and horizontal-link glyphs differed from the concept | Grid and diagonal-link icons in navigation and home actions | Matches the selected icon meanings and treatment |
| Menu control had a 36px width and an unchanged accessible name | 44px target, open/close names, controlled-region relationship | Improves touch and screen-reader use |
| Open mobile navigation could remain visible after resizing | Mobile menu hidden at desktop widths | Keeps one visible navigation system |
| Test screenshots could catch translucent dialog entrance frames | Screenshots finish decorative animations before capture | Makes visual evidence represent settled UI |

Seven routes were checked at widths 320, 390, 768, 980, 1024, 1280, and 1536: 49 combinations without horizontal overflow or console/page errors. Keyboard skip-link focus, wallet dialog dismissal and focus restoration, trial navigation, mobile navigation, and resizing were exercised. The browser suite verifies real disposable-chain creation, progressive and final withdrawals, cancellation, batches, requests, refresh recovery, and account/network changes.

Reference checks covered layout/gutters, DM Sans hierarchy, white/navy/blue palette, logo geometry, water crop and grayscale treatment, timeline colors, action cards, onboarding, and visible copy. No unapproved above-the-fold copy additions or omissions. The live preview replaces the static snapshot; reduced motion shows a play control, mobile uses larger labels and stacked content, and the network indicator remains a truthful status label. No material visual mismatch remains. Production wallet transactions and non-Chromium browsers were not exercised during this design pass.
