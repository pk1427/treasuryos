# TreasuryOS

**AI CFO for Onchain Protocols**

> The operating system for protocol treasuries. Analyze, decide, and execute treasury actions autonomously.

TreasuryOS scans Sepolia treasury addresses, scores detected wallet assets, stress tests portfolios, and publishes immutable risk attestations through KeeperHub.

## Architecture

```
Sepolia Treasury Wallet
        ↓
Blockchain Service (Viem)
        ↓
Treasury Analytics Engine
        ↓
AI CFO Agent
        ↓
KeeperHub Execution Engine
        ↓
Audit Trail (PostgreSQL)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, TypeScript, Tailwind, shadcn/ui |
| Backend | Next.js Route Handlers, Server Actions |
| Database | PostgreSQL, Drizzle ORM |
| Blockchain | Sepolia, Viem |
| AI | OpenAI, LangChain |
| Execution | KeeperHub MCP / API |

## Quick Start

```bash
# Install dependencies
cd treasuryos
npm install

# Copy environment variables
cp apps/web/.env.example apps/web/.env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), click **Launch Dashboard**, and scan a Sepolia treasury address.

## V1 Flow

1. Enter a Sepolia treasury address
2. TreasuryOS reads native ETH and supported ERC20 balances
3. Risk engine scores concentration, counterparty, and liquidity exposure
4. Stress simulator runs scenarios for detected assets
5. Risk report is hashed
6. KeeperHub simulates and publishes the attestation onchain

## Project Structure

```
apps/web/
├── app/
│   ├── dashboard/      # Main treasury dashboard
│   ├── treasury/       # Asset holdings view
│   ├── decisions/      # AI recommendations
│   ├── executions/     # Audit trail
│   └── api/            # REST endpoints
├── components/
│   ├── charts/         # Asset allocation charts
│   ├── analytics/      # Metrics grid
│   ├── risks/          # Risk cards
│   ├── decisions/      # Recommendation cards
│   └── treasury/       # Sidebar, connect wallet
├── lib/
│   ├── blockchain/     # Viem integration
│   ├── analytics/      # Runway, concentration, risk scoring
│   ├── ai/             # AI CFO agent
│   ├── keeperhub/      # Simulation + execution
│   └── db/             # Drizzle client
├── server/
│   ├── services/       # Treasury service orchestration
│   └── repositories/   # Data access layer
├── drizzle/            # Schema + migrations
└── types/              # Shared TypeScript types
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | No | PostgreSQL connection |
| `SEPOLIA_RPC_URL` | Yes | Sepolia RPC endpoint |
| `OPENAI_API_KEY` | No | Enables AI-generated explanations |
| `KEEPERHUB_API_KEY` | No | Enables live KeeperHub execution |

## Database Setup (Optional)

```bash
cd apps/web
npm run db:push
```

## API Endpoints

- `GET /api/treasury?wallet=0x...` — Fetch treasury dashboard data
- `POST /api/treasury` — Connect and analyze treasury
- `POST /api/execute` — Execute a decision via KeeperHub

## Analytics Engine

| Metric | Formula |
|--------|---------|
| Treasury Value | Sum of asset USD values |
| Runway | Treasury Value ÷ Monthly Burn |
| Concentration | Largest asset ÷ Treasury value |
| Idle Capital | Assets untouched for 30+ days |
| Risk Score | Aggregate of runway, concentration, idle capital |

## License

MIT
