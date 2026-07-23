# TreasuryOS — Known Limitations

This document captures verified gaps, constraints, and carry-forward items discovered across v5.0–v5.4. It is intended as a single source of truth for future reviewers so that context does not need to be re-derived from commit history or issue threads.

---

## 1. KeeperHub simulation runs from a default address; viem fallback added in v5.4

- **Original problem:** KeeperHub's simulation endpoint executes from address `0x1DB018D456bC00810BD02E76787be42CAD7F60cF` (a default simulation caller), not from the treasury owner's connected wallet. Simulation validated plan structure and connectivity, but did not validate whether the actual treasury owner's wallet could execute the plan (sufficient balance, existing approvals, correct debt state).
- **What we know:** During v5.2 testing, Aave `repay` simulation on `0x616074f143306b4CeFe272E546f73044e85C6d6d` reverted with a generic `CALL_EXCEPTION` / "missing revert data" across exact-amount, max-uint, and 1-wei test values. The failure was caused by the simulation address having no debt position, not by the repay amount logic.
- **v5.4 change:** KeeperHub was confirmed to ignore any client-supplied `from` address and always use its own default caller. A viem `simulateContract` fallback was added that runs `eth_call`-style simulation from the connected wallet's address against Sepolia RPC directly. This is used for Aave repay and Uniswap collect-fees steps.
- **Current state:** Simulation now shows either a viem `execution reverted` with the actual sender context, or a successful simulation with the user's wallet as `account`. However, a successful viem simulation requires the same real preconditions as an actual transaction (token approvals, sufficient balances, etc.). The `0x616074...` wallet has USDC balance but zero Aave approval, so repay simulation correctly reverts — this is accurate behavior, but it means we have not yet demonstrated a *successful* Aave repay simulation end-to-end with a real wallet.
- **Carrying forward:** A fully successful wallet-context repayment simulation should be demonstrated with a wallet that has both (a) Aave debt and (b) existing USDC approval before v5.5 is scoped.

---

## 2. SIGNED → STALE transition: mechanism verified, full end-to-end with controlled wallet pending

- **What is proven:**
  - `APPROVED → STALE` demonstrated twice via real rescans with genuine hash drift on `0x616074f143306b4CeFe272E546f73044e85C6d6d`:
    - **v5.1 round:** Hash A (`0x2f060c1f...`) → Hash B (`0xc0f53df2...`) over 45s. New plan creation triggered `markStaleIfReportChanged`, flipping `APPROVED` → `STALE` in Postgres.
    - **v5.3 round:** Hash A (`0x867727aa...`) → Hash B (`0xb58fc5e7...`) over 60s. Same mechanism, same result.
  - `SIGNED → STALE` mechanism verified via database transition using address `0x0000000000000000000000000000000000000000`:
    - Hash A (`0xab8bfab1809cedebfc140f6a0087b8dae7d68f8c65a352db480d03317bb59d2d`) → Hash B (`0x327c45d0ac18e2f169e3421f448762e556cd2facb6e937bd0a4452e0f90fbbfe`) over 30s.
    - Postgres row transitioned from `SIGNED` to `STALE` purely through the real scan → new-plan-creation flow, confirming the shared query condition works for `SIGNED` status.
- **What is NOT yet proven:** `SIGNED → STALE` has not been demonstrated with a real signature produced through the `/sign` endpoint on a wallet whose private key we control, followed by a genuine rescan producing a new hash.
- **Why the gap exists:** No currently available test wallet has **both** (a) a private key we can sign with and (b) volatile onchain state that changes hash within a usable test window. The null address demonstrated hash volatility, but has no private key. Random test wallets have stable empty reports.
- **When it resolves:** v5.5 scoping. Requires a funded test wallet on Sepolia with real onchain activity that generates genuine report hash changes within a testable timeframe.

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

## 5. `projectedFinalState` accuracy is bounded by simulation context

- **What was fixed in v5.2:** `projectedFinalState` now derives from actual step success/failure rather than the plan's aspirational/intended outcome. When all steps fail, it correctly shows current-state values (before) instead of optimistic planned values (after).
- **Current state (v5.4 update):** viem `simulateContract` fallback now runs from the user's actual wallet address as `account`, so a successful simulation reflects real wallet state. However, for wallets lacking pre-approvals or required token balances, simulation will correctly revert — this is accurate behavior, not a limitation.
- **User-facing implication:** When `simulationMode` is `viem-user-context`, the simulation result reflects the actual wallet's real constraints. When it falls back to KeeperHub, the old caveat still applies: the result is structural validation from a default address, not a guarantee of real-world executability for the user's wallet.

---

## 6. Wallet connect UX is minimal

- **Current implementation:** Raw `window.ethereum` via a lightweight `WalletProvider` context. Supports MetaMask, Rabby, Coinbase Wallet, and other injected providers on desktop.
- **Not supported:** Mobile wallet apps, WalletConnect-only wallets, multi-account switching UI, chain-switching prompts.
- **Severity:** Not a correctness issue — a coverage/reach limitation. Revisit before wider public release.

---

## 7. Preconditions for v5.5 (Real Execution) — go/no-go checklist

> Treat this as a hard checklist, not a suggestion list. Do not scope v5.5 until every item is verified with actual evidence, not code inspection.

- **[x] Item 1 resolved (partial):** v5.4 added viem `simulateContract` fallback that simulates from the connected wallet's address. viem simulation has been confirmed to use the correct `account` parameter. A *successful* wallet-context repayment simulation with a fully approved, indebited wallet has **not** yet been demonstrated — this requires a funded test wallet with existing Aave debt and token approvals.
- **[x] Item 2 resolved (partial):** `markStaleIfReportChanged` uses a single shared condition for both `APPROVED` and `SIGNED`. The mechanism was verified end-to-end with a genuine hash drift on the null address (`0x0000...0000`), confirming the DB transition from `SIGNED` → `STALE` works. A real controlled-wallet signature followed by genuine stale-marking has **not** been demonstrated — this requires a funded test wallet with hash-volatile state.
- **[ ] Item 3 resolved (or accepted):** The liquidatable-wallet timing constraint has either a production UX mitigation in place, or has been explicitly accepted as a known constraint with monitoring.
- **[x] Item 4 risk acknowledged:** Planner bugs from v5.1 were fixed and verified against a real liquidation-risk wallet. Future planner changes should be tested against the same class of "messy, real liquidation risk" wallet.
- **[x] Wallet-ownership enforcement verified:** `POST /approve`, `/reject`, and `/simulate` now require `walletAddress` in the request body and return `403` on mismatch. `/sign` was already enforced. All four endpoints normalize with `.toLowerCase()`. Verified with direct API calls using mismatched and matched wallets.
- **[x] Address comparison normalized:** All endpoints and UI comparison logic use `.toLowerCase()` consistently. Grepped the entire codebase; no mismatched casing behavior found.
- **[x] No `EXECUTED` / `SUBMITTED` status paths:** Audit confirms no code path sets status to `EXECUTED` or `SUBMITTED`, and no real transaction hash is written as a result of simulation or signing.

Until every box is checked with actual verification evidence, v5.5 should not be considered ready to scope, regardless of how clean any individual v5.4 test result looks.

---

## 8. Outstanding v5.4 verification items (carrying forward to v5.5)

These were identified during v5.4 testing but could not be closed due to test-setup limitations:

1. **Successful wallet-context Aave repay simulation:** Requires a Sepolia wallet with (a) USDC approval for the Aave pool and (b) existing Aave debt. The `0x616074...` wallet meets condition (b) but not (a). viem simulation correctly reverts when approval is missing, which is accurate — but we have not produced a green-path simulation result.
2. **Real SIGNED → STALE with controlled wallet:** Requires a test wallet with private key access and hash-volatile onchain state. The null address demonstrated the mechanism but cannot sign. Random funded wallets without Aave positions don't generate enough hash drift.
3. **No real private keys in codebase or env files:** Testing was conducted with ephemeral in-memory keys only. No private keys were added to `.env.local`, `.env.test`, or any committed file.

---

## 9. Aave public UI only exposes Base Sepolia, not Ethereum Sepolia ( blocker for execution-path testing )

- **What happened:** During v5.4 close-gap testing, the Aave public UI (`app.aave.com`) was confirmed to only expose Base Sepolia (`marketId=base_sepolia_v3`), not Ethereum Sepolia. TreasuryOS's execution/simulation path is built around the Ethereum Sepolia Aave V3 pool (`0x6Ae43d3271ff6888e7Fc43Fd7321a503ff738951`).
- **Impact:** We cannot perform end-to-end supply/borrow/repay testing on Ethereum Sepolia through Aave's public frontend. This blocks:
  - Creating a real Aave debt position on Ethereum Sepolia for simulation testing
  - Triggering real stale-marking via Aave interest accrual on Ethereum Sepolia
- **Not a TreasuryOS bug:** The protocol adapter, pool address, and simulation logic are all correctly configured for Ethereum Sepolia. The limitation is that Aave's public UI does not expose that market for interactive testing.
- **Workarounds (not yet implemented):**
  - Use Aave's official SDK directly against Ethereum Sepolia RPC instead of the public UI
  - Switch testing to Base Sepolia and update TreasuryOS chain configuration accordingly
  - Use hardhat/anvil local fork of Ethereum Sepolia for controlled test scenarios
- **Carrying forward:** This is a test-infrastructure blocker, not a code defect. It does not block v5.5 scoping, but it does mean end-to-end execution-path testing requires one of the workarounds above before v5.5 can be fully validated.

---

*Last updated: 2026-07-23 — covers v5.0 through v5.4.*
