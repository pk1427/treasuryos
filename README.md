# TreasuryOS

**AI CFO for Onchain Protocols**

> The operating system for protocol treasuries. Analyze, decide, and execute treasury actions autonomously.

TreasuryOS continuously monitors protocol treasury health on Base, detects risks like low runway and asset concentration, generates AI-powered recommendations, and executes treasury operations through KeeperHub while maintaining a complete audit trail.

## Architecture

```
Base Treasury Wallet
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
| Blockchain | Base, Viem |
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

Open [http://localhost:3000](http://localhost:3000) and click **Launch Dashboard**, then **Connect Demo Treasury** to run the full demo flow.

## Demo Flow

1. Connect demo treasury wallet on Base
2. TreasuryOS analyzes $1M treasury (90% USDC, 8.3 month runway)
3. Detects concentration, runway, and idle capital risks
4. AI CFO generates recommendations
5. Click **Execute** — KeeperHub simulates and executes transfer
6. Audit trail updates on Executions page

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
│   ├── blockchain/     # Viem + Base integration
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
| `DATABASE_URL` | No | PostgreSQL connection (demo mode works without) |
| `BASE_RPC_URL` | No | Base RPC endpoint |
| `OPENAI_API_KEY` | No | Enables AI-generated explanations |
| `KEEPERHUB_API_KEY` | No | Enables live KeeperHub execution |
| `USE_DEMO_DATA` | No | Force demo treasury data |

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
