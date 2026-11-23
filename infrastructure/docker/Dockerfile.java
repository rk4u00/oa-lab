# syntax=docker/dockerfile:1.7
# Runtime for Java / Spring Boot (Maven) debugging challenges.
FROM maven:3.9-eclipse-temurin-17
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates git procps less vim-tiny \
 && rm -rf /var/lib/apt/lists/* \
 && (id -u 1000 >/dev/null 2>&1 && userdel -r "$(id -nu 1000)" || true) \
 && groupadd -g 1000 runner && useradd -m -u 1000 -g 1000 -s /bin/bash runner
# Optional extra CA (corporate / TLS-inspecting proxies): pnpm runtimes:build with OA_EXTRA_CA_CERT=/path/ca.crt
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then cp /run/secrets/extra_ca /usr/local/share/ca-certificates/oa-extra-ca.crt && update-ca-certificates; fi
ENV SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    PIP_CERT=/etc/ssl/certs/ca-certificates.crt \
    NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt
RUN if [ -f /usr/local/share/ca-certificates/oa-extra-ca.crt ]; then \
      keytool -importcert -noprompt -cacerts -storepass changeit -alias oa-extra-ca -file /usr/local/share/ca-certificates/oa-extra-ca.crt; fi
# Generates Maven settings with an HTTP(S) proxy when HTTPS_PROXY is set (used by the preparation step).
COPY runtimes/java/oa-maven-settings.sh /usr/local/bin/oa-maven-settings
ENV MAVEN_OPTS="-Xmx768m"
USER runner
WORKDIR /workspace
