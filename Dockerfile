FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --chown=node:node scripts/database.mjs scripts/backup-loop.mjs scripts/healthcheck.mjs scripts/profiles.mjs ./scripts/
COPY --chown=node:node package.json ./
RUN mkdir -p /app/data && chown node:node /app /app/data
USER node
ENV PORT=8788 HUTONG_DB=/app/data/mvp.sqlite
EXPOSE 8788
HEALTHCHECK --interval=30s --timeout=8s --start-period=20s --retries=3 CMD ["node","scripts/healthcheck.mjs"]
CMD ["node","server/index.mjs"]
