<div align="center">

# TreasuryOS

### AI Treasury Intelligence with Owner-Controlled Execution

![Next.js](https://img.shields.io/badge/Next.js-15-black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)
![Ethereum](https://img.shields.io/badge/Network-Sepolia-627EEA)
![Uniswap](https://img.shields.io/badge/Protocol-Uniswap_V3-FF007A)
![License](https://img.shields.io/badge/License-MIT-green)
![Stage](https://img.shields.io/badge/Stage-1_Complete-success)

Analyze treasury risk, generate deterministic execution plans, execute supported onchain actions, and publish verifiable proof.

[Live Demo](https://treasuryos-web.vercel.app) • [Architecture](#architecture) • [Features](#features) • [Quick Start](#quick-start)

</div>

---

## Overview

TreasuryOS is an AI-native treasury operating system for onchain organizations.

It combines treasury analytics, deterministic execution planning, and verifiable onchain attestations into a single workflow.

TreasuryOS is designed around a simple operating model:

```
Scan
→ Analyze
→ Plan
→ Execute
→ Attest
```

Unlike autonomous AI agents, TreasuryOS is **non-custodial**.

Every execution requires explicit wallet approval from the treasury owner.

---

# Why TreasuryOS?

Most treasury dashboards stop at reporting.

TreasuryOS extends treasury intelligence into execution by combining portfolio analysis, deterministic execution planning, owner-controlled transactions, and verifiable onchain proof within a single workflow.

Instead of switching between multiple tools, treasury operators can:

- Discover treasury positions
- Understand portfolio risk
- Review AI-assisted recommendations
- Execute supported onchain actions
- Produce verifiable proof of execution

—all from one platform.

---

# Features

## Treasury Intelligence

- Wallet asset discovery
- Protocol position discovery
- Unified treasury portfolio
- Portfolio valuation
- Risk scoring
- Stress simulation
- AI treasury briefing

---

## Owner-Controlled Execution

- Deterministic execution planning
- Wallet ownership verification
- Execution simulation
- Wallet-signed execution
- Receipt verification

---

## Verifiable Proof

- Report hashing
- KeeperHub integration
- Onchain attestation
- Proof history
- Audit trail

---

# Current Stage

TreasuryOS Stage 1 is complete.

Current capabilities include:

- Wallet Intelligence
- Uniswap V3 Position Discovery
- Uniswap V3 Swap Execution
- Risk Engine
- Recommendation Engine
- Execution Planner
- Execution Adapter Registry
- KeeperHub Attestations

Current network:

- Ethereum Sepolia

---

# Architecture

```
Wallet Adapter
        │
        ▼
Protocol Position Adapters
        │
        ▼
Unified Portfolio
        │
        ▼
Risk Engine
        │
        ▼
Recommendation Engine
        │
        ▼
Execution Planner
        │
        ▼
Execution Adapter Registry
        │
        ▼
Uniswap V3 Execution Adapter
        │
        ▼
Simulation
        │
        ▼
Wallet Signature
        │
        ▼
Execution
        │
        ▼
Receipt Verification
        │
        ▼
KeeperHub Attestation
```

---

# Execution Flow

TreasuryOS follows an owner-controlled execution model.

```
Connect Wallet
        │
        ▼
Scan Treasury
        │
        ▼
Risk Analysis
        │
        ▼
Recommendation
        │
        ▼
Execution Plan
        │
        ▼
Simulation
        │
        ▼
Wallet Signature
        │
        ▼
Execute Transaction
        │
        ▼
Verify Receipt
        │
        ▼
Publish Attestation
```

TreasuryOS never executes autonomously.

The connected wallet remains the only transaction signer.

---

# Supported Integrations

## Wallet Adapter

- Native ETH
- ERC20 balances

## Position Adapters

| Protocol | Status |
|----------|--------|
| Wallet | ✅ |
| Uniswap V3 Positions | ✅ |

## Execution Adapters

| Adapter | Status |
|---------|--------|
| Uniswap V3 Router | ✅ |

---

# Tech Stack

| Layer | Technology |
|--------|------------|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | Next.js Route Handlers |
| Blockchain | Ethereum Sepolia, Viem |
| Smart Contracts | Solidity |
| Database | PostgreSQL, Drizzle ORM |
| AI | OpenAI |
| Attestation | KeeperHub |

---

# Quick Start

## Clone

```bash
git clone https://github.com/pk1427/treasuryos.git

cd treasuryos
```

## Install

```bash
npm install
```

## Configure

```bash
cp apps/web/.env.example apps/web/.env.local
```

Configure:

```
SEPOLIA_RPC_URL=

DATABASE_URL=

OPENAI_API_KEY=

KEEPERHUB_API_KEY=

ATTESTATION_REGISTRY_ADDRESS=

NEXT_PUBLIC_CHAIN=sepolia
```

## Run

```bash
npm run dev
```

Open

```
http://localhost:3000
```

---

# Project Structure

```
apps/
└── web/
    ├── app/
    ├── components/
    ├── lib/
    └── server/

packages/
├── contracts/
├── indexer/
├── risk-engine/
├── simulator/
├── attestation/
└── shared/
```

---

# Roadmap

## ✅ Stage 1

- Wallet Intelligence
- Unified Portfolio
- Risk Engine
- Recommendation Engine
- Uniswap Position Adapter
- Uniswap Execution Adapter
- Execution Planner
- KeeperHub Attestations

---

## 🚧 Stage 2

- Additional Position Adapters
- Additional Execution Adapters
- Cross-protocol treasury management

---

## 📈 Stage 3

- Treasury PnL
- Treasury Accounting
- x402 API Monetization

---

# Security Principles

TreasuryOS follows four principles.

- Non-custodial
- Owner-controlled execution
- Deterministic planning
- Verifiable onchain proof

TreasuryOS never holds user funds.

---

# License

MIT
