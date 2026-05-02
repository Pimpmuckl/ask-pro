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
  `--resume`, `--status`, `--harvest`, `--copy`, `--extended`, `--temporary`,
  `--no-temporary`, and `--verbose`.
- Add the `$ask-pro` Codex skill and plugin skeleton.
- Add `pnpm run plugin:refresh` to refresh the local Codex plugin cache from
  the repo source without hand-copying generated cache files.
- Document the source-checkout CLI fallback for agents when `ask-pro` is not on
  `PATH`.
- Add `ASK_PRO_AGENT_ID` support for per-agent persistent browser profiles.
- Clarify that `ASK_PRO_AGENT_ID` should be unset for ordinary single-agent
  use and stable/reusable for isolated agent profiles.
- Add generated response zip discovery, download, validation, extraction, and
  `PRO_OUTPUT_MANIFEST.json` metadata.
- Add a non-resubmitting `--resume` harvest path for submitted, waiting, and
  timed-out browser sessions.

### Fixed

- Browser: recognize ChatGPT's composer-pill model picker and Configure /
  `Pro thinking effort` dialog.
- Browser: harden Pro model selection when ChatGPT keeps the composer pill on
  an effort-only label such as `Standard`, `Extended`, or `Pro`.
- Browser: harden Standard/Extended Pro thinking selection across Configure /
  `Pro thinking effort` and selected-row trailing effort controls.
- Browser: recognize the German ChatGPT picker labels observed in the ask-pro
  profile, including `Länger Pro`, `Konfigurieren...`, and `Denkaufwand Pro`.
- Browser: remove the local Chrome `AutomationControlled` feature flag from
  ask-pro launches.
- Browser: seed ask-pro-managed Chrome profiles with English-first
  `accept_languages`, `selected_languages`, and spellcheck dictionaries before
  launch.
- Browser: request Extended Pro thinking when available.
- Browser: default ask-pro runs to normal Pro thinking effort; use `--extended`
  to request Extended Pro thinking for deep, multi-hour escalations.
- Browser: add `--temporary` to launch ask-pro runs with ChatGPT's
  `?temporary-chat=true` URL when ephemeral ChatGPT history is more important
  than closed-tab recovery.
- Browser: make fresh ask-pro runs try Temporary Chat by default and retry in
  normal ChatGPT when the default Temporary Chat path hides Pro.
- Browser: persist the configured ChatGPT URL in browser metadata for relaunch
  resume paths.
- Browser: make auth resume reopen the managed submission when login happened
  before runtime metadata was saved.
- Browser: preserve requested Extended Pro thinking across auth and submitted
  session resume paths.
- CLI: persist requested `--extended` and `--temporary` modes in session status
  so plain `--resume` preserves dry-run intent.
- CLI: add `--no-temporary` for retrying a Temporary Chat session in normal
  ChatGPT.
- CLI: keep explicit `--temporary` strict so callers can require Temporary Chat
  instead of accepting the default normal-ChatGPT fallback.
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
- Plugin: make `pnpm run plugin:refresh` use a Node entrypoint so the package
  script is not Windows-shell-specific.
- CLI: preserve the source-checkout `pnpm start` launcher in generated resume
  commands.

### Docs

- Rewrite the README and manual smoke docs around local pre-publish usage,
  manual auth, context bundles, response zip fallback, and the reduced V1
  validation loop.
