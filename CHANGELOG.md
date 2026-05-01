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
- Include plugin manifest and skill files in the eventual npm tarball while
  documenting that npm install does not auto-register Codex plugins.

### Added

- Add the minimal V1 CLI: `ask-pro "<question>"`, `--files`, `--dry-run`,
  `--resume`, `--status`, `--harvest`, `--copy`, and `--verbose`.
- Add the `$ask-pro` Codex skill and plugin skeleton.
- Add generated response zip discovery, download, validation, extraction, and
  `PRO_OUTPUT_MANIFEST.json` metadata.
- Add a non-resubmitting `--resume` harvest path for submitted, waiting, and
  timed-out browser sessions.

### Fixed

- Browser: recognize ChatGPT's composer-pill model picker and Configure /
  `Pro thinking effort` dialog.
- Browser: request Extended Pro thinking when available.
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
