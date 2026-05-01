#!/usr/bin/env bash
set -euo pipefail

required=(
  "README.md"
  "AGENTS.md"
  "skills/ask-pro/SKILL.md"
  ".codex-plugin/plugin.json"
  "docs/01-agent-mission.md"
  "docs/02-upstream-pr-triage.md"
  "docs/03-cherrypick-order.md"
  "docs/04-rip-out-plan.md"
  "docs/07-pro-answer-zip-contract.md"
  "docs/10-testing-acceptance.md"
  "config/ask-pro.config.example.json"
)

for f in "${required[@]}"; do
  if [[ ! -f "$f" ]]; then
    echo "missing: $f" >&2
    exit 1
  fi
done

echo "ask_pro doc drop looks complete"
