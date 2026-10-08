#!/bin/sh
set -e

# Install on a Linux-native path. npm can misbehave when package.json
# lives on a Windows (/mnt/c) bind mount under Docker Desktop + WSL.
DEPS=/tmp/aria-deps
mkdir -p "$DEPS"
cp /app/package.json /app/package-lock.json "$DEPS/"
cd "$DEPS"

# Local Docker Desktop / corporate TLS inspection often breaks npm's
# CA chain (UNABLE_TO_GET_ISSUER_CERT_LOCALLY). Safe for local compose.
npm config set strict-ssl false

# npm may still print "Exit handler never called" on this host; treat a
# present vite binary as success.
npm install --no-audit --no-fund || true

if [ ! -x "$DEPS/node_modules/.bin/vite" ]; then
  echo "ERROR: vite missing after npm install" >&2
  exit 1
fi

mkdir -p /app/node_modules
rm -rf /app/node_modules/*
cp -a "$DEPS/node_modules"/. /app/node_modules/
cd /app
exec ./node_modules/.bin/vite --host
