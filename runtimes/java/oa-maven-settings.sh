#!/bin/sh
# Prints a Maven settings.xml. If HTTPS_PROXY/HTTP_PROXY is set, configures it as a Maven proxy.
P="${HTTPS_PROXY:-${https_proxy:-${HTTP_PROXY:-$http_proxy}}}"
echo '<settings><proxies>'
if [ -n "$P" ]; then
  HOSTPORT=$(echo "$P" | sed -E 's#^[a-z]+://##; s#^[^@]*@##; s#/.*$##')
  HOST=${HOSTPORT%:*}; PORT=${HOSTPORT##*:}; [ "$PORT" = "$HOST" ] && PORT=80
  for proto in http https; do
    echo "<proxy><id>oa-$proto</id><active>true</active><protocol>$proto</protocol><host>$HOST</host><port>$PORT</port><nonProxyHosts>localhost|127.0.0.1</nonProxyHosts></proxy>"
  done
fi
echo '</proxies></settings>'
