# TreasuryOS

**Treasury Risk Intelligence with Onchain Attestations**

> Read-only treasury scanning, risk scoring, stress testing, and verifiable KeeperHub attestations.

TreasuryOS scans Sepolia treasury addresses, scores detected wallet assets, stress tests portfolios, and publishes immutable risk attestations through KeeperHub.

## Architecture

```
Sepolia Treasury Wallet
        ↓
Blockchain Service (Viem)
        ↓
Treasury Analytics Engine
        ↓
Risk Report + Hash
        ↓
KeeperHub Attestation Publish
        ↓
Attestation Indexer + PostgreSQL
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, TypeScript, Tailwind |
| Backend | Next.js Route Handlers, Server Actions |
| Database | PostgreSQL, Drizzle ORM |
| Blockchain | Sepolia, Viem |
| Indexing | packages/indexer |
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
7. The indexer decodes `AttestationPublished` and persists proof history
8. The Attestations page links every proof to Sepolia Etherscan

## V1 Verified Flow

TreasuryOS v1 has been verified end to end on Sepolia:

```
Treasury Address
        ↓
Real Wallet Balances
        ↓
Risk Score
        ↓
Stress Test
        ↓
Report Hash
        ↓
KeeperHub Publish
        ↓
AttestationPublished Event
        ↓
Database History
        ↓
Etherscan Verification
```

The scanner intentionally returns less data rather than invented data. Empty wallets show `$0`, no positions, and `N/A` risk rating.

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
| `ATTESTATION_REGISTRY_ADDRESS` | Yes | Sepolia AttestationRegistry address |
| `NEXT_PUBLIC_CHAIN` | Yes | Use `sepolia` |
## Database Setup

```bash
npm run db:push --workspace=web
```

The `attestations` table stores indexed `AttestationPublished` events. Blockchain logs remain the source of truth; the database is the app's queryable history.

## V2 Adapter System

TreasuryOS V2 introduces protocol adapters. The scanner still reads wallet ETH and ERC20 balances, then appends positions discovered by enabled adapters.

Current adapter support:

| Adapter | Network | Positions |
|---------|---------|-----------|
| Uniswap V3 | Ethereum Sepolia | LP NFTs via NonfungiblePositionManager |

Protocol deployment addresses live in `packages/indexer/src/protocols`. If protocol reads fail, TreasuryOS falls back to V1 wallet scanning without inventing positions.

## API Endpoints

- `POST /api/report` — Scan, score, stress test, and hash a risk report
- `POST /api/attestation` — Simulate or publish a KeeperHub attestation
- `GET /api/attestations` — List persisted attestation history
- `GET /api/treasury?wallet=0x...` — Legacy treasury dashboard data

## Analytics Engine

| Metric | Formula |
|--------|---------|
| Treasury Value | Sum of asset USD values |
| Runway | Treasury Value / Monthly Burn |
| Concentration | Largest asset ÷ Treasury value |
| Idle Capital | Assets untouched for 30+ days |
| Risk Score | Aggregate of runway, concentration, idle capital |

## License

MIT
