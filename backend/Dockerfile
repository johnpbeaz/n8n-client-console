# syntax=docker/dockerfile:1.7

FROM node:20-slim AS base

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src

RUN npm run build
RUN npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 4000

CMD ["node", "dist/src/index.js"]
