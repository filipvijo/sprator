# Sprator

**Autonomous business cashflow agent** — monitors spend, recovers revenue, executes approved Stripe operations.

Built for the [Hermes Agent Accelerated Business Hackathon](https://x.com/NousResearch/status/2066921443548348436) by NVIDIA, Stripe, and Nous Research.

## What it does

Sprator is an AI agent that acts as an autonomous CFO for solo founders and small teams. It:

- **Monitors spend** — tracks all Stripe subscriptions, detects waste, unused services, and cost anomalies
- **Recovers revenue** — chases failed payments with automated dunning sequences and Stripe payment links
- **Acts within guardrails** — auto-executes low-risk cancellations (under a configurable $/mo threshold) on its own, and escalates anything bigger or anomalous for human approval. Hard monthly spend cap on agent-initiated purchases.
- **Spends autonomously** — provisions/pays for services it needs via real Stripe payment links (Stripe Skills for Hermes)
- **Reports net P&L** — a single "Net Agent Impact" figure = revenue recovered + annualized savings realized
- **Reaches out proactively** — a `pulse` endpoint a Hermes cron polls to ping you on Telegram *unprompted* when something needs attention
- **Maintains a full audit trail** — every action timestamped and reconciled to Stripe references

## Architecture

```
sprator/
├── src/
│   ├── app/
│   │   ├── page.tsx                  # Dashboard entry
│   │   ├── dashboard-client.tsx      # Full dashboard UI
│   │   └── api/
│   │       ├── overview/             # Stats + agent feed
│   │       ├── subscriptions/        # List subscriptions
│   │       ├── cancel/               # Cancel subscription (Stripe)
│   │       ├── failed-payments/      # List failed payments
│   │       ├── dunning/              # Send dunning email
│   │       ├── audit/                # Audit trail
│   │       ├── approvals/            # List + approve/reject
│   │       ├── payment-link/         # Create Stripe payment link
│   │       ├── sync/                 # Sync from Stripe + analyze
│   │       ├── agent/audit/          # Agent "audit this month" command
│   │       └── health/               # Health check
│   └── lib/
│       ├── db.ts                     # SQLite (better-sqlite3)
│       ├── stripe.ts                 # Stripe client + operations
│       ├── analysis.ts               # Spend analysis engine
│       └── audit.ts                  # Audit log + feed + approvals
├── scripts/
│   └── seed.mjs                      # Demo data seeder
├── package.json
├── tsconfig.json
├── next.config.js
└── .env.example
```

## Quick Start

```bash
# Clone
git clone https://github.com/filipvijo/sprator.git
cd sprator

# Install
npm install

# Seed demo data
npm run db:seed

# Run
npm run dev
# Open http://localhost:3000
```

## Environment Variables

Copy `.env.example` to `.env.local`:

| Var | Required | Purpose |
|-----|----------|---------|
| `STRIPE_SECRET_KEY` | For live Stripe | Stripe API key (`sk_tes...n`) |
| `SPRATOR_PORT` | No | Dev server port (default: 3000) |
| `SPRATOR_DB_PATH` | No | SQLite path (default: `./sprator.db`) |
| `CRON_KEY` | No | Auth key for `/api/sync` endpoint |
| `TELEGRAM_BOT_TOKEN` | For agent | Telegram bot for notifications |

> **Demo mode:** Without Stripe keys, the app runs fully on seeded local data. Stripe calls are gracefully skipped.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/overview` | Dashboard stats + agent feed |
| GET | `/api/subscriptions` | All subscriptions |
| POST | `/api/cancel` | Cancel a subscription |
| GET | `/api/failed-payments` | Failed payment invoices |
| POST | `/api/dunning` | Trigger dunning for a payment |
| GET | `/api/audit` | Audit trail |
| GET | `/api/approvals` | Pending + completed approvals |
| POST | `/api/approvals` | Approve/reject an action |
| POST | `/api/payment-link` | Create Stripe payment link |
| POST | `/api/sync` | Sync from Stripe + run analysis |
| POST | `/api/agent/audit` | Agent "audit this month" — auto-handles within guardrails, escalates the rest |
| POST | `/api/agent/provision` | Agent provisions/pays for a service (real Stripe link, spend-cap enforced) |
| GET | `/api/agent/pulse` | Proactive alert feed for cron-driven Telegram pings |
| GET | `/api/health` | Health check |

## Agent Integration

Sprator is designed to be operated by a Hermes Agent via Telegram. The agent can:

1. Call `POST /api/agent/audit` to run a full audit
2. Read `GET /api/overview` to summarize the financial state
3. Call `POST /api/approvals` to approve/reject pending actions
4. Call `POST /api/cancel` to execute approved cancellations
5. Call `POST /api/dunning` to chase failed payments
6. Call `POST /api/payment-link` to generate recovery links

## Demo Script

1. `npm run db:seed` — load realistic demo data
2. Open dashboard — see 12 subscriptions, 3 pending approvals, 6 failed payments
3. Click "Approve" on "Cancel Notion AI" — watch it execute and appear in audit trail
4. Click "Cancel" on a flagged subscription in Spend Monitor — see approval modal
5. Run `curl -X POST http://localhost:3000/api/agent/audit` — agent runs full audit
6. Check agent activity feed — new entries appear from the audit

## Tech Stack

- **Next.js 15** (App Router, API routes)
- **Stripe** (subscriptions, payment links, webhooks)
- **better-sqlite3** (local DB, no external DB required)
- **TypeScript**

## License

MIT
