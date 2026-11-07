# Kumbara app image. Built and run by deploy/compose.yml; see "Deploying" in the README.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json prisma.config.ts ./
COPY prisma ./prisma
RUN npm ci
COPY . .
# The build loads the env checks but never connects; real values come from .env at run time.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build \
    AUTH_SECRET=build-time-placeholder-never-used-at-run-time \
    npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    RECEIPTS_DIR=/data/receipts
WORKDIR /app
# Dev dependencies stay: migrations (prisma), the seed and the rates script (tsx) run from this image.
COPY --from=build --chown=node:node /app ./
RUN mkdir -p /data/receipts && chown node:node /data/receipts
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
# Apply any new migrations, then serve.
CMD ["sh", "-c", "npx prisma migrate deploy && exec npx next start -H 0.0.0.0 -p $PORT"]
