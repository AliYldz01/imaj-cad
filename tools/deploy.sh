#!/bin/sh
set -e
cd "$(dirname "$0")/.."
npx tsc --noEmit -p . && npx vite build >/dev/null 2>&1
# oturum bağlantısı: CLAUDE_SESSION ortam değişkeni (varsa)
MSG="$1

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
[ -n "$CLAUDE_SESSION" ] && MSG="$MSG
Claude-Session: $CLAUDE_SESSION"
git add -A && git commit -qm "$MSG"
git fetch -q origin && git rebase -q origin/main && git push -q origin HEAD:main
URL=$(git remote get-url origin); rm -rf /tmp/pages && mkdir /tmp/pages && cp -r dist/. /tmp/pages/ && touch /tmp/pages/.nojekyll
cd /tmp/pages && git init -q -b gh-pages && git add -A && git commit -qm "Deploy" && git remote add origin "$URL" && git push -qf origin gh-pages 2>/dev/null
echo deployed
sleep 75; curl -s https://aliyldz01.github.io/imaj-cad/sw.js | grep -o "imajcad-v[0-9]*"
