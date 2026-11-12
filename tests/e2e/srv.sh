#!/bin/sh
curl -s -o /dev/null http://localhost:4173/ || (cd "$(dirname "$0")/../.." && nohup npx vite preview --port 4173 > /tmp/preview.log 2>&1 &) ; sleep 3
