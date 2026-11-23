# syntax=docker/dockerfile:1.7
# Runtime for C / C++ (CMake) debugging challenges. python3 runs OA Lab's output graders.
FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates build-essential cmake ninja-build gdb valgrind python3 git procps less vim-tiny \
 && rm -rf /var/lib/apt/lists/*
# Optional extra CA (corporate / TLS-inspecting proxies)
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then cp /run/secrets/extra_ca /usr/local/share/ca-certificates/oa-extra-ca.crt && update-ca-certificates; fi
RUN groupadd -g 1000 runner && useradd -m -u 1000 -g 1000 -s /bin/bash runner
USER runner
WORKDIR /workspace
