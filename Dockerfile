# Wedding planner — Next.js + Socket.IO on one HTTP server.
#
# Not `output: standalone`. That traces the modules Next itself needs, and this
# app is started by server.ts, which Next knows nothing about — the trace drops
# socket.io and the Prisma engine. So the runtime stage carries real
# node_modules instead, and pays a larger image for a server that actually boots.

# ---- deps -------------------------------------------------------------------
FROM node:22-alpine AS deps
WORKDIR /app

# Prisma's engines need libc compatibility on Alpine.
RUN apk add --no-cache libc6-compat openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma
# postinstall runs `prisma generate`, which needs the schema — hence the copy
# above this line rather than below it.
RUN npm ci

# ---- build ------------------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next inlines NEXT_PUBLIC_* at build time. Nothing secret is passed here: the
# secrets this app holds (AUTH_SECRET, DATABASE_URL, S3 keys) are read at
# runtime, so they belong in the environment, not in a layer anyone can peel.
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:22-alpine AS runtime
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY --from=build /app/public ./public
COPY --from=build /app/src ./src
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/server.ts ./server.ts
COPY --from=build /app/tsconfig.json ./tsconfig.json
COPY --from=build /app/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh

# Not root. A container that only ever serves HTTP has no business being able to
# write to its own system directories.
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 3000

# server.ts binds 0.0.0.0 already (listen(port) with no host), which is what a
# container needs — a process bound to localhost is unreachable from outside it.
ENTRYPOINT ["./docker-entrypoint.sh"]
