#!/usr/bin/env bash
# Generates a local self-signed TLS certificate (server.pem/server.key) so
# server.py can serve Pulse over HTTPS during development.
#
# For production, replace these files with a certificate from a trusted CA
# (e.g. Let's Encrypt) instead of using a self-signed cert.
set -euo pipefail
cd "$(dirname "$0")"

if [ -f server.pem ] || [ -f server.key ]; then
  echo "server.pem/server.key already exist. Remove them first if you want to regenerate."
  exit 1
fi

openssl req -x509 -newkey rsa:4096 -sha256 -days 365 -nodes \
  -keyout server.key -out server.pem \
  -subj "/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 server.key
echo "Created server.pem and server.key. Restart server.py to serve over HTTPS."
