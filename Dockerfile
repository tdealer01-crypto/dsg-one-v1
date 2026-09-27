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

# The exact Git commit is non-secret build provenance. It is baked into the
# server image so the live readiness response can prove which source is running.
ARG DSG_BUILD_SOURCE_SHA
ENV DSG_BUILD_SOURCE_SHA=$DSG_BUILD_SOURCE_SHA

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
FROM node:24-trixie-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=8080
ARG DSG_BUILD_SOURCE_SHA
ENV DSG_BUILD_SOURCE_SHA=$DSG_BUILD_SOURCE_SHA

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/automation_spacetime ./automation_spacetime
COPY --from=builder /app/scripts/dsg-one-container-entrypoint.sh /usr/local/bin/dsg-one-container-entrypoint

RUN apt-get update \
    && apt-get upgrade -y \
    && apt-get install -y --no-install-recommends ca-certificates python3 python3-venv \
    && python3 -m venv /opt/dsg-automation \
    && /opt/dsg-automation/bin/pip install --no-cache-dir -r /app/automation_spacetime/requirements.txt \
    && chmod 0755 /usr/local/bin/dsg-one-container-entrypoint \
    && rm -rf /var/lib/apt/lists/*

ENV DSG_AUTOMATION_PYTHON=/opt/dsg-automation/bin/python \
    DSG_AUTOMATION_ENGINE=/app/automation_spacetime/engine.py \
    DSG_AUTOMATION_ENGINE_VERSION=1.18.0

EXPOSE 8080
CMD ["/usr/local/bin/dsg-one-container-entrypoint"]
