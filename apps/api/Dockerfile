# syntax=docker/dockerfile:1.7
FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@10.24.0 --activate
WORKDIR /repo

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/
COPY packages/contracts/package.json packages/contracts/
COPY packages/taxonomy/package.json packages/taxonomy/
COPY packages/tsconfig/package.json packages/tsconfig/
COPY packages/eslint-config/package.json packages/eslint-config/
RUN pnpm install --frozen-lockfile --filter @how-about-me/api...

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm --filter @how-about-me/taxonomy build && pnpm --filter @how-about-me/contracts build \
 && pnpm --filter @how-about-me/api prisma:generate && pnpm --filter @how-about-me/api build \
 && pnpm --filter @how-about-me/api deploy --prod --legacy /out \
 && cp -r apps/api/prisma /out/prisma \
 && cd /out && /repo/apps/api/node_modules/.bin/prisma generate --schema prisma/schema.prisma
# pnpm 10 needs --legacy for non-injected workspace deps; the deployed @prisma/client is
# regenerated inside /out because `pnpm deploy` reinstalls it ungenerated.

FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app
RUN addgroup -S app && adduser -S app -G app
COPY --from=build /out ./
COPY --from=build /repo/apps/api/dist ./dist
USER app
EXPOSE 4000
# Railway injects PORT and ignores Docker HEALTHCHECK; kept for plain docker runs.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- "http://127.0.0.1:${PORT:-4000}/health/live" || exit 1
# Migrations run as a separate pipeline step before deploy (deploy-staging.yml); the image has no Prisma CLI.
CMD ["node", "dist/main.js"]
