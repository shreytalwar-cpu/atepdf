#!/usr/bin/env bash
set -euo pipefail
beta_dir="$(cd -P "$(dirname "$0")" && pwd)"
if command -v node >/dev/null 2>&1; then
  beta_node="$(command -v node)"
elif [[ -x "$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node" ]]; then
  beta_node="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node"
else
  echo 'Node.js is required. No server was stopped.' >&2
  exit 1
fi
"$beta_node" "$beta_dir/beta.mjs" web stop
