#!/usr/bin/env bash
#
# Registry consume smoke test -- the single most valuable gate in this repo.
#
# It is the ONLY check that exercises the real distribution path: build the
# registry, serve it, install every item into a clean project with the shadcn
# CLI, and typecheck the result. Nothing else catches a malformed registry item,
# a missing registryDependency, or a broken import alias before a consumer does.
#
# It has already caught two real defects:
#   - components installed without lib/utils.ts (undeclared registryDependency)
#   - an `interface ... extends` collision with the native `prefix` attribute
#
# Usage: scripts/registry-smoke-test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WWW="$ROOT/apps/www"
PORT="${SMOKE_PORT:-4599}"
WORKDIR="$(mktemp -d)"
SERVER_PID=""

cleanup() {
  [ -n "$SERVER_PID" ] && kill "$SERVER_PID" 2>/dev/null || true
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

echo "==> Building tokens and registry"
pnpm --filter @vianova/tokens build >/dev/null
(cd "$WWW" && pnpm registry:build >/dev/null)

# Fail loudly on a stale server from an interrupted run: otherwise the install
# step silently talks to the old registry and the failure looks like a code bug.
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "ERROR: port $PORT is already in use (likely a server left by an interrupted run)." >&2
  echo "       Free it with: pkill -f \"http.server $PORT\"   — or set SMOKE_PORT to another port." >&2
  exit 1
fi

echo "==> Serving registry on :$PORT"
(cd "$WWW/public" && python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1) &
SERVER_PID=$!
for _ in $(seq 1 30); do
  curl -sf "http://127.0.0.1:$PORT/r/registry.json" >/dev/null 2>&1 && break
  curl -sf "http://127.0.0.1:$PORT/r/button.json" >/dev/null 2>&1 && break
  sleep 0.5
done

# Every registry:ui / registry:lib item, derived -- never hand-listed.
ITEMS="$(python3 -c "
import json,sys
d=json.load(open('$WWW/registry.json'))
print(' '.join('@vianova/'+i['name'] for i in d['items'] if i['type']!='registry:theme'))
")"
THEME="$(python3 -c "
import json
d=json.load(open('$WWW/registry.json'))
print(next(('@vianova/'+i['name'] for i in d['items'] if i['type']=='registry:theme'), ''))
")"
echo "    items: $ITEMS"

echo "==> Scaffolding a clean consumer"
cd "$WORKDIR"
mkdir -p app lib
cat > package.json <<'JSON'
{ "name": "registry-smoke", "version": "0.0.0", "private": true, "type": "module" }
JSON
cat > tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022", "lib": ["DOM","DOM.Iterable","ES2022"],
    "jsx": "preserve", "module": "ESNext", "moduleResolution": "Bundler",
    "strict": true, "noEmit": true, "esModuleInterop": true, "skipLibCheck": true,
    "allowJs": true, "isolatedModules": true, "resolveJsonModule": true,
    "baseUrl": ".", "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx"]
}
JSON
cat > components.json <<JSON
{
  "\$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york", "rsc": true, "tsx": true,
  "tailwind": { "config": "", "css": "app/globals.css", "baseColor": "neutral", "cssVariables": true },
  "iconLibrary": "lucide",
  "aliases": { "components": "@/components", "ui": "@/components/ui", "lib": "@/lib", "hooks": "@/hooks", "utils": "@/lib/utils" },
  "registries": { "@vianova": "http://127.0.0.1:$PORT/r/{name}.json" }
}
JSON
printf '@import "tailwindcss";\n' > app/globals.css

echo "==> Installing every registry item"
# shellcheck disable=SC2086
npx --yes shadcn@latest add $ITEMS --yes >/dev/null
[ -n "$THEME" ] && npx --yes shadcn@latest add "$THEME" --yes >/dev/null

echo "==> Asserting the theme delivered both modes"
python3 - <<'PY'
import re, sys
css = open("app/globals.css").read()
for sel in (":root", ".dark"):
    if not re.search(re.escape(sel) + r"\s*\{", css):
        sys.exit(f"FAIL: theme did not emit a {sel} block")
for var in ("--primary", "--origin", "--chart-1"):
    if css.count(var + ":") < 2:
        sys.exit(f"FAIL: {var} is not defined in both light and dark")
print("    theme OK: light + dark blocks present")
PY

echo "==> Installing peer dependencies"
npm i --silent --no-audit --no-fund \
  react@^19 react-dom@^19 @types/react@^19 @types/react-dom@^19 typescript@^5.7 \
  @radix-ui/react-slot @radix-ui/react-select class-variance-authority \
  clsx tailwind-merge lucide-react >/dev/null 2>&1

echo "==> Typechecking the consumer"
if npx tsc --noEmit; then
  echo
  echo "PASS: every registry item installs into a clean project and typechecks."
else
  echo
  echo "FAIL: the installed components do not compile. See errors above."
  exit 1
fi
