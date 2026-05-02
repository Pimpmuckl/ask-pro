# Changelog

## Unreleased

### Changed

- Rename the package and binary surface to `ask_pro` / `ask-pro`.
- Keep npm publishing out of scope until a human explicitly approves release.
- Narrow the product to browser-backed ChatGPT Pro escalation with project-local
  `.ask-pro/` sessions and a persistent
  `~/.agents/skills/ask-pro/browser-profile`.
- Remove the old Oracle API provider, Gemini, MCP, TUI, bridge, remote-service,
  image, notifier, multi-model, and ad hoc browser-debug surfaces from V1.
- Trim runtime dependencies to the ask-pro browser closure.
- Document manual clone/link plus Codex marketplace installation instead of
  treating npm as the current install path.

### Added

- Add the minimal V1 CLI: `ask-pro "<question>"`, `--files`, `--dry-run`,
  `--resume`, `--status`, `--harvest`, `--copy`, `--extended`, and `--verbose`.
- Add the `$ask-pro` Codex skill and plugin skeleton.
- Add `pnpm run plugin:refresh` to refresh the local Codex plugin cache from
  the repo source without hand-copying generated cache files.
- Add `ASK_PRO_AGENT_ID` support for per-agent persistent browser profiles.
- Add generated response zip discovery, download, validation, extraction, and
  `PRO_OUTPUT_MANIFEST.json` metadata.
- Add a non-resubmitting `--resume` harvest path for submitted, waiting, and
  timed-out browser sessions.

### Fixed

- Browser: recognize ChatGPT's composer-pill model picker and Configure /
  `Pro thinking effort` dialog.
- Browser: request Extended Pro thinking when available.
- Browser: default ask-pro runs to normal Pro thinking effort; use `--extended`
  to request Extended Pro thinking for deep, multi-hour escalations.
- Browser: launch ask-pro runs with ChatGPT's `?temporary-chat=true` URL so new
  Pro escalations start in Temporary Chat without relying on the UI toggle.
- Browser: force an English browser locale for ask-pro runs to reduce selector
  drift from localized ChatGPT UI.
- Browser: detect the current top-right temporary-chat control shape without
  treating the inactive toggle as an active temporary chat.
- Browser: preserve successful sends when ChatGPT does not immediately render
  sent-message attachment UI.
- Browser: prefer ChatGPT's `Copy response` action over `Copy message` when
  capturing browser markdown.
- Browser: stop treating transient reasoning placeholders as completed answers.
- Browser: gracefully close completed ask-pro Chrome runs while keeping
  incomplete/reattachable runs available.
- Plugin: normalize the Codex plugin identity to `ask-pro`, add required YAML
  frontmatter, and tighten the skill text into a concise agent runbook.

### Docs

- Rewrite the README and manual smoke docs around local pre-publish usage,
  manual auth, context bundles, response zip fallback, and the reduced V1
  validation loop.
