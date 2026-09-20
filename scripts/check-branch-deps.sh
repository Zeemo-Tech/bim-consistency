#!/usr/bin/env sh

set -eu

OLD_REF="${1:-}"
NEW_REF="${2:-HEAD}"

if [ -z "$OLD_REF" ]; then
  exit 0
fi

if ! git diff --name-only --no-renames "$OLD_REF" "$NEW_REF" | grep -Eq '^(package\.json|pnpm-lock\.yaml|\.nvmrc|\.npmrc)$'; then
  exit 0
fi

printf '\n[dependency sync required]\n'
printf 'Detected package/toolchain changes after switching branches.\n'
printf 'Run: pnpm install --frozen-lockfile\n\n'
