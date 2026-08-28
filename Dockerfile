# dsg-one-v1 container image.
# Runtime boundary: this image contains app code only. Secrets must be
# supplied through the hosting platform's env/secret store, never baked in.

FROM node:24-bookworm-slim AS deps
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-bookworm-slim AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# NEXT_PUBLIC_* values are compiled into the Next.js client bundle at build time.
# These are public configuration values, not secrets.
ARG NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL
ARG NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL=$NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_URL
ENV NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_DSG_ONE_V1_SUPABASE_PUBLISHABLE_KEY

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# The repository currently has no public/ directory. Create it so the runtime
# image COPY remains deterministic while preserving support for future assets.
RUN mkdir -p public
RUN npm run build

# next.config.ts sets output: 'standalone', so the build produces a
# self-contained server at .next/standalone that only needs the static
# and public assets copied alongside it — no full node_modules in the
# final image.
FROM node:24-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 8080
CMD ["node", "server.js"]
