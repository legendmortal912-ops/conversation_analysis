# 🛡️ ConvoGuard

**"See what your AI is really doing to your users."**

ConvoGuard is a production-ready, real-time AI manipulation detection and analytics platform. It ingests conversations between end users and AI systems (chatbots, sales bots, support bots), analyzes each AI turn for manipulation patterns, scores conversations with a **TiltScore**, and surfaces insights on a live dashboard.

Built for companies who want to audit their AI for compliance, ethics, and brand safety — and for regulators/auditors who need verifiable evidence.

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    API Gateway (:3000)                   │
│              REST + WebSocket + Rate Limiting            │
└─────────┬──────────┬──────────┬──────────┬──────────────┘
          │          │          │          │
    ┌─────▼────┐ ┌───▼────┐ ┌──▼───┐ ┌───▼─────┐
    │  Ingest  │ │  Auth  │ │Billing│ │  Alert  │
    │  :3001   │ │  :3002 │ │ :3003 │ │  :3004  │
    └────┬─────┘ └────────┘ └──────┘ └─────────┘
         │
    ┌────▼─────────────────┐
    │   BullMQ (Redis)     │
    │   Analysis Queue     │
    └────┬─────────────────┘
         │
    ┌────▼─────────────────┐    ┌──────────────────┐
    │  Analysis Engine     │    │ Dashboard Backend │
    │  Python/FastAPI      │    │ GraphQL :3005     │
    │  :8001               │    └────────┬─────────┘
    │  • DistilBERT        │             │
    │  • Rule-based NLP    │    ┌────────▼─────────┐
    │  • TiltScore         │    │ Dashboard Frontend│
    └──────────────────────┘    │ React SPA :5173   │
                                └──────────────────┘

    ┌─────────────────────────────────────────────┐
    │              Data Layer                      │
    │  PostgreSQL │ immudb │ Redis │ TimescaleDB  │
    │  MinIO      │ immugw                        │
    └─────────────────────────────────────────────┘
```

## 🔍 Manipulation Patterns Detected

| Pattern | Description |
|---------|-------------|
| **Topic Hijacking** | AI answers partially then pivots to its own agenda |
| **Opinion Injection** | AI presents opinions as facts without evidence |
| **False Urgency** | AI creates artificial time pressure |
| **Concern Dismissal** | AI acknowledges then ignores user concerns |
| **Agenda Persistence** | AI repeatedly returns to the same topic despite user redirecting |

## 🔐 Cryptographic Integrity

All conversation data is stored in an **append-only, tamper-evident ledger** (immudb):

- **Hash Chain**: Every record is SHA-256 linked to its predecessor
- **Merkle Tree**: Hourly signed checkpoints enable independent verification
- **Ed25519 Signatures**: Checkpoints are cryptographically signed
- **Public Verification API**: Anyone can verify record integrity without trusting ConvoGuard
- **Neural Tamper Detection**: LSTM autoencoder monitors chain structure for anomalies

## 📦 Quick Start

### Prerequisites

- Node.js 20+
- pnpm 9+
- Docker + Docker Compose
- Python 3.11+ (for analysis engine)

### Setup

```bash
# Clone the repo
git clone https://github.com/convoguard/convoguard.git
cd convoguard

# Install dependencies
make install

# Create .env from template
make env

# Start infrastructure (Postgres, Redis, immudb, MinIO)
make infra

# Run database migrations
make migrate

# Seed with demo data
make seed

# Start all services
make dev
```

### Access Points

| Service | URL |
|---------|-----|
| API Gateway | http://localhost:3000 |
| Dashboard | http://localhost:5173 |
| GraphQL Playground | http://localhost:3005/graphql |
| MinIO Console | http://localhost:9001 |

## 🔌 SDK Integration

### JavaScript / TypeScript

```bash
npm install convoguard-js
```

```typescript
import { ConvoGuard } from 'convoguard-js';

const cg = new ConvoGuard({
  apiKey: 'cg_live_...',
  projectId: 'proj_...',
});

const conv = await cg.startConversation({
  externalId: 'chat_123',
  userMetadata: { plan: 'premium', region: 'US' },
});

await cg.addTurn(conv.id, { speaker: 'user', content: userMessage });
const result = await cg.addTurn(conv.id, { speaker: 'ai', content: aiResponse });

if (result.analysis?.flags.length > 0) {
  console.warn('Manipulation detected!', result.analysis.flags);
}

const final = await cg.endConversation(conv.id);
console.log(`TiltScore: ${final.tiltScore}/100 (${final.grade})`);
```

### Python

```bash
pip install convoguard-py
```

```python
from convoguard import ConvoGuard

cg = ConvoGuard(api_key="cg_live_...", project_id="proj_...")

with cg.conversation(external_id="chat_123") as conv:
    cg.add_turn(conv.id, "user", user_message)
    result = cg.add_turn(conv.id, "ai", ai_response)
    
    if result.analysis and result.analysis.flags:
        print("Manipulation detected!", result.analysis.flags)
```

## 💰 Plans

| Feature | Free | Starter ($49/mo) | Growth ($199/mo) | Enterprise |
|---------|------|-------------------|-------------------|------------|
| Turns/month | 500 | 10,000 | 100,000 | Unlimited |
| Projects | 1 | 3 | 10 | Unlimited |
| Exports | — | CSV | All | All |
| Retention | 7 days | 30 days | 90 days | 1 year |
| Support | — | Email | Priority | Dedicated |

## 🧪 Testing

```bash
# Run all tests
make test

# Train the ML classifier (optional)
make training-data  # Generate synthetic training data
make train          # Fine-tune DistilBERT
```

## 🚀 Production Deployment

```bash
# Build Docker images
make docker-build

# Deploy to Kubernetes
make deploy

# Dry-run
make deploy-dry
```

## 📁 Repository Structure

```
ConvoGuard/
├── apps/
│   ├── api-gateway/           # Public REST + WebSocket gateway
│   ├── ingest-service/        # Conversation ingestion + BullMQ workers
│   ├── analysis-engine/       # Self-hosted ML classifier (Python/FastAPI)
│   ├── auth-service/          # JWT + API key authentication
│   ├── billing-service/       # Stripe billing integration
│   ├── alert-service/         # Alert triggering & delivery
│   ├── dashboard-backend/     # GraphQL API (Apollo Server)
│   └── dashboard-frontend/    # React SPA (Vite + Tailwind)
├── packages/
│   ├── shared/                # Common types, constants, Zod schemas
│   ├── hash-chain/            # Cryptographic hash chain + Merkle tree
│   ├── database/              # Prisma schema, immudb client, Redis
│   ├── sdk-js/                # JavaScript/TypeScript SDK
│   └── sdk-python/            # Python SDK
├── k8s/                       # Kubernetes manifests
├── docker-compose.yml         # Full stack (dev)
├── docker-compose.infra.yml   # Infrastructure only
├── Makefile                   # Dev commands
└── turbo.json                 # Turborepo config
```

## License

Proprietary. All rights reserved.
