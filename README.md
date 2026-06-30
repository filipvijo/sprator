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
│   │       ├── agent/provision/       # Agent provisions/pays for a service
│   │       └── agent/pulse/           # Proactive alert feed (for cron)
│   └── lib/
│       ├── db.ts                     # In-memory store (auto-seeds; Vercel-friendly)
│       ├── stripe.ts                 # Stripe client + operations
│       ├── analysis.ts               # Spend analysis engine
│       ├── impact.ts                 # Net P&L + guardrails config
│       └── audit.ts                  # Audit log + feed + approvals
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

# Run (the in-memory store auto-seeds with demo data on first request)
npm run dev
# Open http://localhost:3000
```

## Environment Variables

Copy `.env.example` to `.env.local`:

| Var | Required | Purpose |
|-----|----------|---------|
| `STRIPE_SECRET_KEY` | For live Stripe | Stripe API key (use a `sk_test_…` key — runs in sandbox, no real money) |
| `SPRATOR_AUTO_APPROVE_UNDER` | No | Guardrail: agent auto-cancels subscriptions at/under this $/mo (default: `25`) |
| `SPRATOR_MONTHLY_SPEND_CAP` | No | Guardrail: hard ceiling on agent-initiated spend, $/mo (default: `2000`) |
| `CRON_KEY` | No | Auth key for the `/api/sync` endpoint |

> **Demo mode:** Without a Stripe key, the app runs fully on the in-memory seed data and Stripe calls are gracefully skipped. With a `sk_test_…` key, cancellations, payment links, and provisioning hit the real Stripe **test** API (sandbox — no real money moves).

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

Sprator is operated by a **Hermes Agent over Telegram** — there is no dedicated Sprator bot; Hermes *is* the agent, driving the HTTP API. The agent can:

1. `POST /api/agent/audit` — run a monthly audit. The agent **auto-executes** cancellations within its guardrail and **escalates** the rest (and anomalies) for human approval.
2. `GET /api/overview` — summarize the financial state, including the Net Agent Impact (earn + save) and active guardrails.
3. `POST /api/approvals` — approve/reject pending actions.
4. `POST /api/cancel` / `POST /api/dunning` / `POST /api/payment-link` — execute approved cancellations, chase failed payments, generate recovery links.
5. `POST /api/agent/provision` — **autonomously spend**: provision/pay for a service via a real Stripe (test) link, enforced against the spend cap.
6. `GET /api/agent/pulse` — polled on a cron; when something needs attention the agent **pings the user on Telegram unprompted**.

## Demo Flow (Telegram + dashboard)

Run side by side: your Hermes Telegram chat on the left, the dashboard on the right.

1. **`audit this month`** → the agent auto-cancels low-cost waste (within the guardrail) and lists the bigger items for your approval.
2. **`approve Figma and Zoom, hold AWS`** → approved actions execute; everything is written to the audit trail with Stripe refs.
3. **`provision Anthropic API credits at $40/mo`** → the agent creates a real Stripe test payment link, within its spend cap.
4. Watch the dashboard's **Net Agent Impact** and activity feed update live.

## Tech Stack

- **Next.js 15** (App Router, API routes)
- **Stripe** (test mode — subscriptions, payment links, provisioning)
- **In-memory store** (auto-seeds with demo data; zero-config, Vercel-friendly)
- **Hermes Agent** (operates Sprator over Telegram via the `sprator-agent` skill)
- **TypeScript**

## License

MIT
