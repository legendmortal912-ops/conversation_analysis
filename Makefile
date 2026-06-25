# ═══════════════════════════════════════════════════════════
# ConvoGuard — Development Commands
# ═══════════════════════════════════════════════════════════

.PHONY: dev infra stop build test clean migrate seed train deploy

# ─── Development ──────────────────────────────────────────

## Start all services (infra + apps)
dev:
	docker compose up -d
	@echo "✅ All services started. Dashboard: http://localhost:5173"

## Start only infrastructure (databases, cache, storage)
infra:
	docker compose -f docker-compose.infra.yml up -d
	@echo "✅ Infrastructure started"
	@echo "  PostgreSQL:  localhost:5432"
	@echo "  Redis:       localhost:6379"
	@echo "  immudb:      localhost:3322"
	@echo "  immugw:      localhost:3323"
	@echo "  MinIO:       localhost:9000 (console: 9001)"
	@echo "  TimescaleDB: localhost:5433"

## Stop all containers
stop:
	docker compose down
	docker compose -f docker-compose.infra.yml down

## View logs for a specific service
logs:
	docker compose logs -f $(service)

# ─── Database ─────────────────────────────────────────────

## Run Prisma migrations
migrate:
	pnpm --filter @convoguard/database db:migrate

## Generate Prisma client
generate:
	pnpm --filter @convoguard/database db:generate

## Seed database with demo data
seed:
	pnpm --filter @convoguard/database db:seed

## Open Prisma Studio
studio:
	pnpm --filter @convoguard/database db:studio

# ─── Build & Test ─────────────────────────────────────────

## Build all packages and apps
build:
	pnpm turbo build

## Run all tests
test:
	pnpm turbo test

## Lint all code
lint:
	pnpm turbo lint

## Clean all build artifacts
clean:
	pnpm turbo clean
	rm -rf node_modules/.cache

# ─── ML Model ────────────────────────────────────────────

## Generate synthetic training data
training-data:
	cd apps/analysis-engine && uv run python src/training/generate_training_data.py

## Train the manipulation classifier
train:
	cd apps/analysis-engine && uv run python src/training/train_classifier.py

# ─── Docker ───────────────────────────────────────────────

## Build all Docker images
docker-build:
	docker compose build

# ─── Kubernetes ───────────────────────────────────────────

## Deploy to Kubernetes
deploy:
	kubectl apply -f k8s/namespace.yaml
	kubectl apply -f k8s/

## Dry-run Kubernetes manifests
deploy-dry:
	kubectl apply -f k8s/ --dry-run=client

# ─── Utilities ────────────────────────────────────────────

## Copy .env.example to .env
env:
	cp .env.example .env
	@echo "✅ Created .env — edit it with your values"

## Install all dependencies
install:
	pnpm install
	cd apps/analysis-engine && uv sync
	@echo "✅ All dependencies installed"

## Full setup from scratch
setup: env install infra migrate seed
	@echo "✅ ConvoGuard is ready! Run 'make dev' to start."
