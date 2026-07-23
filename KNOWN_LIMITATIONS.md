# TreasuryOS — Known Limitations

This document captures verified gaps, constraints, and carry-forward items discovered across v5.0–v5.3. It is intended as a single source of truth for future reviewers so that context does not need to be re-derived from commit history or issue threads.

---

## 1. KeeperHub simulation runs from a default address, not the user's wallet

- **What happens:** KeeperHub's simulation endpoint executes from address `0x1DB018D456bC00810BD02E76787be42CAD7F60cF` (a default simulation caller), not from the treasury owner's connected wallet.
- **What this means:** Simulation validates **plan structure and connectivity** — steps are well-formed, KeeperHub is reachable, responses parse correctly — but it does **not** validate whether the actual treasury owner's wallet can execute the plan (sufficient balance, existing approvals, correct debt state, etc.).
- **How we know:** During v5.2 testing, Aave `repay` simulation reverted with a generic `CALL_EXCEPTION` / "missing revert data" across exact-amount, max-uint, and 1-wei test values. Additional probes (different `onBehalfOf` addresses, view-call attempts) confirmed the simulation environment has no Aave position for the user's wallet. The failure is caused by the simulation address having no debt position, not by the repay amount logic.
- **When it resolves:** v5.4 (User Wallet Simulation) is scoped specifically to replace default-address simulation with the connected user's own wallet as the simulation context.

---

## 2. SIGNED → STALE transition is proven at the code level, not directly end-to-end

- **What is proven:** `APPROVED → STALE` has been demonstrated twice via real rescans with genuine hash drift:
  - **v5.1 round:** Liquidatable wallet `0x616074f143306b4CeFe272E546f73044e85C6d6d` produced Hash A (`0x2f060c1f6a7bcef2d2056694dfffb4e0472e454c99d48e278884360d15cc2b79`) and Hash B (`0xc0f53df2f932add99a72c3dd60bd63ebb06450d76c2d5c38da93fefaaf4fd14c`) across a 45s rescan. New plan creation triggered `markStaleIfReportChanged`, flipping the prior `APPROVED` plan to `STALE` in Postgres with no manual database edits.
  - **v5.3 round:** Same liquidatable wallet produced Hash A (`0x867727aa26398766d5453e6c4ee002a26de393807594ce704076a0e9c5515aaa`) and Hash B (`0xb58fc5e7d184e1bed7eb7daa2ac3e0d625ca93e8f25630bf341241c33e94f419`) across a 60s rescan, again triggering `APPROVED → STALE` purely through the real scan → new-plan-creation flow.
- **What is NOT yet proven:** `SIGNED → STALE` has not been directly observed end-to-end with a real signed plan going stale via a real rescan.
- **Why the gap exists:** No available test wallet has **both** (a) a private key we can sign with and (b) volatile onchain state that changes hash within a usable test window.
- **Code-level evidence:** `markStaleIfReportChanged` uses a single shared condition:
  ```ts
  or(
    eq(schema.executionPlans.status, "APPROVED"),
    eq(schema.executionPlans.status, "SIGNED")
  )
  ```
  This is structurally identical logic for both statuses — not separate branches — so the APPROVED evidence transfers tightly, but it has not been independently verified with a real signed-and-staled plan.
- **When it resolves:** v5.4. Wallet-based simulation will require testing with a wallet that has real state volatility and real key access anyway. The SIGNED→STALE test should be the **first thing verified** once that setup exists, before any other v5.4 work is accepted.

---

## 3. Liquidatable-wallet timing constraint

- **Affected wallet:** `0x616074f143306b4CeFe272E546f73044e85C6d6d` and similar high-activity wallets can go stale within seconds due to Aave interest accrual and Chainlink price ticks.
- **User-facing impact:** For volatile wallets, the entire `approve → simulate → sign` flow must complete in one fast, uninterrupted session, or the plan invalidates mid-flow.
- **Is this a bug?** No. This is **correct behavior** — it protects the user from acting on outdated financial data. But it is a real production UX constraint.
- **Current mitigations:** v5.2 introduced a snapshot-lock (`approved_snapshot` / `approved_snapshot_at` columns) so simulation can proceed against the approval-time snapshot even if live state has drifted. Signing does **not** use the snapshot lock — it still requires hash match at sign-time.
- **Candidate future mitigations (not committed, just noted):**
  - A visible freshness indicator / countdown in the UI showing how old the plan's snapshot is.
  - A "quick-regenerate" flow that pre-fetches steps 2/3/4 before the user even clicks approve, reducing the window between approval and signature.

---

## 4. AI Action Planner required multiple correctness fixes before being trustworthy

- **Context:** During v5.1 testing, the planner was validated against a real, "messy" wallet with actual liquidation risk (`0x616074f143306b4CeFe272E546f73044e85C6d6d`). Testing against clean/trivial wallets would not have surfaced the bugs below.
- **Bugs found and fixed, in discovery order:**
  1. **Step duplication** — overlapping risk factors generated duplicate steps (e.g., multiple identical repay actions) because deduplication was missing.
  2. **Dropped repay step** — the deduplication logic incorrectly dropped the repay step during consolidation, even when it was the only action addressing actual liquidation risk.
  3. **Unit-conversion bug** — swap amounts were computed by using the USD value directly as token quantity. For ETH, this meant the plan proposed swapping ~1000x the actual holdings (USD ~$7,700 passed as wei).
  4. **Aspirational expectedOutcome** — the `expectedOutcome` block showed improved Health Factor / exposure numbers even when the plan's actual steps could not have produced that outcome (e.g., swap that never executed).
- **Implication for future planner changes:** Any new planner logic (multi-asset repay, partial fills, multi-protocol plans, etc.) should be treated with the same suspicion and tested against real worst-case wallet data before being trusted. Clean/trivial wallets are not sufficient validation.

---

## 5. `projectedFinalState` accuracy is bounded by simulation-address limitation

- **What was fixed in v5.2:** `projectedFinalState` now derives from actual step success/failure rather than the plan's aspirational/intended outcome. When all steps fail, it correctly shows current-state values (before) instead of optimistic planned values (after).
- **Remaining bound:** Because simulation cannot validate from the real user's wallet (see item 1), a simulation showing "all steps passed" only means the steps passed from a no-balance default address's perspective for whatever KeeperHub could evaluate structurally. It is **not** a guarantee the same steps will succeed for the actual treasury owner's wallet.
- **User-facing implication:** Simulation results should be displayed with a clear disclaimer that a clean simulation is not a stronger guarantee than it is. The current UI includes `snapshotWarning` for snapshot age; a similar explicit note about simulation-address limitations should be present near simulation results.

---

## 6. Wallet connect UX is minimal

- **Current implementation:** Raw `window.ethereum` via a lightweight `WalletProvider` context. Supports MetaMask, Rabby, Coinbase Wallet, and other injected providers on desktop.
- **Not supported:** Mobile wallet apps, WalletConnect-only wallets, multi-account switching UI, chain-switching prompts.
- **Severity:** Not a correctness issue — a coverage/reach limitation. Revisit before wider public release.

---

## 7. Preconditions for v5.5 (Real Execution) — go/no-go checklist

> Treat this as a hard checklist, not a suggestion list. Do not scope v5.5 until every item is verified with actual evidence, not code inspection.

- **[ ] Item 1 resolved:** Real execution must simulate/validate against the user's **actual connected wallet** as the transaction context (balance, approvals, debt state), not a default address.
- **[ ] Item 2 resolved:** `SIGNED → STALE` has been independently verified end-to-end with a real signed plan going stale via a real rescan, not just via the shared-code-path argument.
- **[ ] Item 3 resolved (or accepted):** The liquidatable-wallet timing constraint has either a production UX mitigation in place, or has been explicitly accepted as a known constraint with monitoring.
- **[ ] Item 4 risk mitigated:** Any planner logic changes made after this doc was written have each been tested against the same class of "messy, real liquidation risk" wallet used to catch the original four bugs — not just clean/trivial wallets.
- **[ ] Wallet-ownership enforcement verified:** Connected wallet == plan's `wallet_address` is confirmed consistently across **every** relevant endpoint — approve, reject, sign, and simulate — not just the sign endpoint. Audit with test output, not just a code-read claim.
- **[ ] Address comparison normalized:** Checksum vs. lowercase normalization is confirmed consistent across all of the above endpoints and the UI's own display/comparison logic.
- **[ ] No `EXECUTED` / `SUBMITTED` status paths:** Full audit confirms no code path anywhere sets status to `EXECUTED` or `SUBMITTED`, and no real transaction hash is ever written as a result of simulation or signing.

Until every box is checked with actual verification evidence, v5.5 should not be considered ready to scope, regardless of how clean any individual v5.4 test result looks.

---

*Last updated: 2026-07-23 — covers v5.0 through v5.3.*
