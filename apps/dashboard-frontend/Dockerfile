FROM node:20-alpine AS builder
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app
COPY . .
RUN pnpm install
RUN pnpm --filter @convoguard/database db:generate
RUN pnpm --filter @convoguard/dashboard-frontend... --workspace-concurrency=1 build

FROM nginx:alpine AS runner
COPY --from=builder /app/apps/dashboard-frontend/dist /usr/share/nginx/html
COPY apps/dashboard-frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

