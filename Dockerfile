# syntax=docker/dockerfile:1.7
# OA Lab application image: NestJS API + Next.js web UI in one container.
# Sandboxed challenge code runs in separate sibling containers via the mounted Docker socket.
FROM node:22-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git openssl \
 && rm -rf /var/lib/apt/lists/* && corepack enable
# Optional extra CA for TLS-inspecting corporate proxies (docker build --secret id=extra_ca,src=ca.crt)
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then cp /run/secrets/extra_ca /usr/local/share/ca-certificates/oa-extra-ca.crt && update-ca-certificates; fi
ENV NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
COPY --from=docker:27-cli /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker:27-cli /usr/local/libexec/docker/cli-plugins/docker-buildx /usr/local/libexec/docker/cli-plugins/docker-buildx
WORKDIR /app

FROM base AS build
COPY . .
RUN rm -rf imports data prisma/*.db && pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ARG NEXT_PUBLIC_WS_URL=ws://localhost:4000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL NEXT_PUBLIC_WS_URL=$NEXT_PUBLIC_WS_URL
RUN pnpm build

FROM base AS app
COPY --from=build /app /app
ENV NODE_ENV=production API_HOST=0.0.0.0 API_PORT=4000 OA_DATA_DIR=/app/data OA_IMPORTS_DIR=/app/data/imports
EXPOSE 3000 4000
ENTRYPOINT ["bash", "/app/scripts/docker-entrypoint.sh"]
