FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm --filter @convoguard/database db:generate
RUN pnpm --filter @convoguard/dashboard-backend... --workspace-concurrency=1 build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/ ./
EXPOSE 3005
CMD ["node", "apps/dashboard-backend/dist/server.js"]

