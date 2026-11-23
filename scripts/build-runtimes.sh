#!/usr/bin/env bash
# Build the sandbox runtime images.
#   OA_EXTRA_CA_CERT=/path/ca.crt   trust an extra CA (TLS-inspecting corporate proxy)
#   HTTPS_PROXY / HTTP_PROXY        forwarded to the build when set
set -euo pipefail
cd "$(dirname "$0")/.."
args=()
if [ -n "${OA_EXTRA_CA_CERT:-}" ]; then args+=(--secret "id=extra_ca,src=$OA_EXTRA_CA_CERT"); fi
for v in HTTPS_PROXY HTTP_PROXY NO_PROXY https_proxy http_proxy no_proxy; do
  if [ -n "${!v:-}" ]; then args+=(--build-arg "$v"); fi
done
if [ -n "${HTTPS_PROXY:-}${https_proxy:-}" ]; then args+=(--network host); fi
targets=("${@:-python node java}")
for t in ${targets[@]}; do
  echo "==> oa-lab-$t"
  DOCKER_BUILDKIT=1 docker build "${args[@]}" -t "oa-lab-$t:latest" -f "infrastructure/docker/Dockerfile.$t" .
done
