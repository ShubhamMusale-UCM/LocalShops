# syntax=docker/dockerfile:1

FROM node:20-alpine AS base
WORKDIR /app

FROM base AS deps
COPY package*.json ./
COPY server/package*.json ./server/
COPY packages/shared/package*.json ./packages/shared/
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run prisma:generate --workspace=server
RUN npm run build --workspace=server

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/prisma ./server/prisma
COPY --from=build /app/packages/shared ./packages/shared

EXPOSE 5000
CMD ["node", "server/dist/app.js"]
