# TreasuryOS — Stage 1.5: KeeperHub Execution Layer
### Architecture, Phases & Execution Plan

**Status:** 🚧 In Progress (Hackathon Build)
**Depends on:** Stage 1 (✅ Complete, Deployed — Ethereum Sepolia)
**Feeds into:** Stage 3 — Protocol Execution
**Principle:** *Additive only. Zero modification to Stage 1's working, deployed code path.*

---

## 1. Why This Stage Exists

Stage 1 shipped owner-controlled execution directly against the Uniswap V3 Router. That path is **live, tested, and stays exactly as-is**.

Stage 1.5 does not replace it — it adds a **second execution transport**: KeeperHub. The Deterministic Execution Planner already produces adapter-agnostic plans; the Execution Adapter Registry already exists to hold multiple adapters. Stage 1.5 is the exercise of that design, not a redesign of it.

**Non-goals for this stage:**
- No changes to `UniswapV3ExecutionAdapter`
- No changes to Risk Engine, Portfolio Scanner, or AI Recommendation Engine internals
- No breaking changes to the Execution Planner's plan schema
- No changes to existing dashboard flows (only additive UI)

---

## 2. High-Level Architecture

```
                         ┌────────────────────────────┐
                         │   AI Recommendation Engine  │
                         └──────────────┬──────────────┘
                                        │ generates intent
                                        ▼
                         ┌────────────────────────────┐
                         │ Deterministic Execution      │
                         │ Planner (UNCHANGED)          │
                         └──────────────┬──────────────┘
                                        │ ExecutionPlan (adapter-agnostic)
                                        ▼
                         ┌────────────────────────────┐
                         │  Execution Adapter Registry  │
                         │  (UNCHANGED — just add one)  │
                         └───────┬───────────────┬─────┘
                                 │               │
                 ┌───────────────┘               └───────────────┐
                 ▼                                                ▼
   ┌─────────────────────────────┐              ┌─────────────────────────────┐
   │ UniswapV3ExecutionAdapter    │              │ KeeperHubExecutionAdapter    │
   │ (Stage 1 — untouched)        │              │ (NEW — Stage 1.5)            │
   │ Direct RPC → Router          │              │ MCP/CLI → KeeperHub          │
   └──────────────┬───────────────┘              └──────────────┬───────────────┘
                  │                                              │
                  ▼                                              ▼
        ┌───────────────────┐                     ┌───────────────────────────┐
        │ Ethereum Sepolia    │                     │ KeeperHub Execution Layer  │
        │ (owner-signed tx)   │                     │  • Simulation              │
        └───────────────────┘                     │  • Smart Gas Estimation    │
                                                    │  • Private/MEV-safe route │
                                                    │  • Gas sponsorship        │
                                                    │  • Audit trail            │
                                                    └──────────────┬─────────────┘
                                                                   ▼
                                                    ┌───────────────────────────┐
                                                    │ Ethereum (Sepolia/Mainnet) │
                                                    └───────────────────────────┘

                 ┌───────────────────────────────────────────────────┐
                 ▼                                                   ▼
     ┌─────────────────────────┐                     ┌─────────────────────────┐
     │ TreasuryOS Proof Trail    │  ◄── merge ──────  │ KeeperHub Audit Trail    │
     │ (Stage 1 — extended)      │                     │ (trigger/sim/gas/tx/ts)  │
     └─────────────────────────┘                     └─────────────────────────┘
                 │
                 ▼
     ┌─────────────────────────┐
     │ Dashboard: Execution Mode │
     │ Toggle (Direct/KeeperHub) │
     └─────────────────────────┘
```

---

## 3. Phases

### Phase 1.5.1 — Integration Setup (Foundation)
**Goal:** Get KeeperHub reachable from TreasuryOS without touching production code.

- [ ] Provision KeeperHub MCP server / CLI access
- [ ] Add KeeperHub config to a new isolated env block (`.env.keeperhub`, not merged into existing config)
- [ ] Stand up a sandbox branch: `feature/stage-1.5-keeperhub`
- [ ] Verify connectivity: simple MCP call → KeeperHub health/capabilities check
- [ ] Document required scopes/permissions for the agentic wallet (x402/MPP)

**Exit criteria:** TreasuryOS backend can successfully call KeeperHub's MCP server and receive a valid capabilities response.

---

### Phase 1.5.2 — KeeperHubExecutionAdapter (Core Build)
**Goal:** Implement the adapter to the same interface contract as `UniswapV3ExecutionAdapter`, so the Registry and Planner require zero changes.

- [ ] Define adapter interface conformance (see §4 below)
- [ ] Implement `KeeperHubExecutionAdapter.simulate(plan)`
- [ ] Implement `KeeperHubExecutionAdapter.execute(plan)` via MCP tool calls
- [ ] Implement `KeeperHubExecutionAdapter.getStatus(txRef)`
- [ ] Wire smart gas estimation pass-through
- [ ] Wire private/MEV-safe routing flag
- [ ] Register adapter in Execution Adapter Registry under key `"keeperhub"`

**Exit criteria:** Registry can resolve and invoke `KeeperHubExecutionAdapter` exactly like it resolves the Uniswap adapter today — same call shape, different transport.

---

### Phase 1.5.3 — Execution Flow Wiring
**Goal:** Let a plan actually flow end-to-end through KeeperHub.

- [ ] Add adapter selection param to execution request (`executionMode: "direct" | "keeperhub"`), defaulting to `"direct"` so existing behavior is unaffected
- [ ] Route `"keeperhub"` mode plans through the new adapter
- [ ] Confirm Transaction Simulation & Receipt Verification module works against KeeperHub's simulation response shape (may need a thin response adapter — not a rewrite)
- [ ] Test one real Sepolia swap executed via KeeperHub end-to-end

**Exit criteria:** One verifiable, real transaction executed via KeeperHub, with a transaction hash you can link in the hackathon submission.

---

### Phase 1.5.4 — Audit Trail Merge
**Goal:** Combine KeeperHub's audit trail with your existing Proof Trail for double-sourced verification.

- [ ] Pull KeeperHub audit log fields: trigger, simulation result, submitted tx, gas used, outcome, timestamp
- [ ] Extend Proof Trail schema with an optional `keeperhubAuditRef` block (additive field — existing Proof Trail entries for direct executions are unaffected)
- [ ] Cross-reference tx hash between TreasuryOS Proof Trail and KeeperHub Audit Trail
- [ ] Surface both in the Proof Trail viewer UI

**Exit criteria:** A single Proof Trail entry shows both TreasuryOS's own record and KeeperHub's independent audit record for the same transaction.

---

### Phase 1.5.5 — Dashboard: Execution Mode Toggle
**Goal:** Make the difference demoable and visible, without touching existing dashboard views.

- [ ] Add a new toggle component: "Direct Execution" vs "KeeperHub Execution" (additive UI element, not a replacement of existing execution controls)
- [ ] Show KeeperHub-specific indicators when active: MEV protection status, gas sponsorship status, private routing status
- [ ] Show merged audit trail entry when KeeperHub mode was used

**Exit criteria:** A judge or user can visibly see and select KeeperHub execution mode and see its guarantees reflected in the UI.

---

### Phase 1.5.6 — Testing, Demo & Submission Prep
**Goal:** Package the work for hackathon judging.

- [ ] Run full regression on Stage 1 flows to confirm zero regressions (direct execution path untouched)
- [ ] Record demo video: agent decides → plan generated → KeeperHub execution → onchain confirmation → audit trail shown
- [ ] Collect: GitHub link, demo video, transaction link (KeeperHub-executed)
- [ ] Optional: write up integration notes as a candidate for the "Best Onboarding UX" bounty (tutorial / teardown of the adapter integration)

**Exit criteria:** Submission-ready BUIDL with all three required links.

---

## 4. Adapter Interface Contract (must match existing adapter shape)

```ts
interface ExecutionAdapter {
  id: string; // "uniswap-v3" | "keeperhub"
  discover(snapshot: TreasurySnapshot): Promise<ExecutableAction[]>;
  quote(step: PlanStep): Promise<ExecutionQuote>;
  buildTransaction(step: PlanStep, walletAddress: Address): PreparedTransaction;
  simulate(step: PlanStep, walletAddress: Address): Promise<{ success: boolean; estimatedGas?: string; note?: string; error?: string }>;
}

interface KeeperHubExecutionAdapter extends ExecutionAdapter {
  id: "keeperhub";

  // KeeperHub-specific, exposed as optional extensions —
  // does not break the base ExecutionAdapter contract
  routing?: "public" | "private";
  gasStrategy?: "standard" | "smart-backoff";
  gasSponsored?: boolean;
  auditTrailRef?: string; // pointer to KeeperHub's own audit record
}
```

**Rule:** `ExecutionPlan` (produced by the Planner) is never modified to accommodate KeeperHub. Any KeeperHub-specific data lives in the adapter layer, not upstream. The KeeperHubExecutionAdapter wraps the existing `@/lib/keeperhub` HTTP client internally — it is a thin conformance layer, not new HTTP logic.

---

## 5. Data Flow Summary

```
AI Recommendation → ExecutionPlan → Registry.resolve(executionMode)
   → [direct]    → UniswapV3ExecutionAdapter → Sepolia RPC → Proof Trail
   → [keeperhub] → KeeperHubExecutionAdapter → KeeperHub MCP
                     → simulate → gas estimate → private route → submit
                     → Sepolia/Mainnet tx → KeeperHub Audit Trail
                     → merged into → Proof Trail (extended schema)
```

---

## 6. Risk & Rollback Plan

| Risk | Mitigation |
|---|---|
| KeeperHub MCP integration breaks build | Isolated feature branch; Stage 1 main branch never merges until Phase 1.5.6 passes regression |
| KeeperHub simulation response shape differs from Uniswap's | Thin response-mapping layer inside the adapter, not a change to the Simulation module's core logic |
| Hackathon deadline missed on a sub-phase | Phases 1.5.1–1.5.3 are the only *required* path for a valid submission (real tx via KeeperHub). Phases 1.5.4–1.5.5 are high-value but can slip to post-hackathon if needed |
| Existing users on Direct mode affected | `executionMode` defaults to `"direct"`; KeeperHub is strictly opt-in per execution |

---

## 7. Updated Roadmap Position

```
✅ Stage 1   — Wallet Intelligence & Owner-Controlled Execution   [deployed, untouched]
🚧 Stage 1.5 — KeeperHub Execution Layer                          [this document]
🔄 Stage 2   — Protocol Intelligence                              [unchanged]
🔄 Stage 3   — Protocol Execution                                 [now inherits KeeperHub transport by default]
🌐 Stage 4   — Cross-Network Treasury
📊 Stage 5   — Treasury Intelligence Platform
💼 Stage 6   — Treasury Infrastructure
```

---

## 8. One-Line Summary (for release notes / X)

> Stage 1.5: TreasuryOS now executes onchain through KeeperHub — MEV-protected, gas-optimized, fully auditable execution, added as a new adapter alongside our existing owner-controlled Uniswap V3 path with zero disruption to Stage 1.