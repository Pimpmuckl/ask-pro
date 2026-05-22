# Changelog

## Unreleased

### Changed

- Add the ask-pro logo as the Codex marketplace plugin icon and keep its
  manifest path validator-clean.
- Refresh root-level plugin assets into the local Codex plugin cache.
- Require the Codex plugin validator in the local signoff loop before
  plugin-facing commits.
- Remove a developer-specific local marketplace name from public docs.
- Rename the package and binary surface to `ask_pro` / `ask-pro`.
- Change normal CLI stdout to compact TOON-style agent telemetry and keep
  browser progress on stderr/session logs.
- Add compact browser preflight fields to agent telemetry when known, including
  profile mode/path, Chrome mode, and language steering.
- Surface recoverable non-temporary ChatGPT `conversation_url` in agent
  telemetry when known.
- Add `--prompt-file` for multiline prompts and stdin handoffs without fragile
  shell quoting.
- Add `--artifacts` / `--response-zip` as the explicit response bundle opt-in.
- Normalize `--files` inputs from Windows backslash paths, absolute paths inside
  the project cwd, and directory paths into stable relative manifest paths, with
  realpath containment checks.
- Treat ChatGPT's visible bare `Pro` picker label as the current Pro target
  instead of requiring a dated model label.
- Request the visible ChatGPT `Pro` surface for ask-pro browser runs, then
  select Standard/Extended Pro thinking effort separately, matching the split
  model/effort selector UI.
- Leave Pro thinking effort unchanged by default; only `--extended` forces the
  effort selector, avoiding accidental resets from persisted Extended Pro to
  Instant or Thinking.
- Accept split-picker `Pro · Extended` selection when ChatGPT closes the picker
  but keeps the composer pill as an effort label like `Heavy`.
- Wake ChatGPT's hidden blank-composer `Model` pill with a temporary draft
  before model selection, then restore the composer without submitting.
- Treat ChatGPT's current `Intelligence` picker tiers (`Instant`, `Medium`,
  `High`, and `Pro 5+ min`) as the live model selector, with `Pro 5+ min` as
  the Extended Pro thinking target for `--extended`.
- Reject non-Extended ask-pro thinking overrides so Heavy/Standard/Light remain
  test-only setup states, never accepted runtime modes.
- Stop adding the generated response zip request to every wrapper prompt; agents
  should ask for `ask-pro-response.zip` only when the task needs that bundle.
- Mark suspicious preamble-only answers without valid artifacts as
  `INCOMPLETE_ANSWER` instead of `COMPLETED`.
- Keep `ask-pro --harvest` as raw `ANSWER.md` output so agents can pipe or read
  the Pro answer without a metadata wrapper.
- Keep npm publishing out of scope until a human explicitly approves release.
- Narrow the product to browser-backed ChatGPT Pro escalation with project-local
  `.ask-pro/` sessions and a persistent
  `~/.agents/skills/ask-pro/browser-profile`.
- Remove the old Oracle API provider, Gemini, MCP, TUI, bridge, remote-service,
  image, notifier, multi-model, and ad hoc browser-debug surfaces from V1.
- Trim runtime dependencies to the ask-pro browser closure.
- Document manual clone/link plus Codex marketplace installation instead of
  treating npm as the current install path.
- Replace the long public README with a compact install/use guide centered on
  Codex marketplace installation.
- Change the repo marketplace entry to the Git-backed root-plugin source shape
  so `codex plugin marketplace add` exposes the plugin in Codex.
- Make the cached plugin runner bootstrap Git marketplace installs by installing
  dependencies and building `dist` when the cached source has not been built yet.
- Clarify that ask-pro prompts must include cold-start context because ChatGPT
  Pro does not know local repo history, user preferences, or Codex thread state.
- Recommend `--no-temporary` for repo advisories, review rounds, large bundles,
  and recoverability-sensitive runs.
- Mark context redaction as best-effort in manifests and docs instead of
  overstating strict secret safety.

### Added

- Add the minimal V1 CLI: `ask-pro "<question>"`, `--files`, `--dry-run`,
  `--prompt-file`, `--artifacts`, `--response-zip`, `--resume`, `--status`, `--harvest`, `--copy`,
  `--extended`, `--temporary`, `--no-temporary`, and `--verbose`.
- Add the `$ask-pro` Codex skill and plugin skeleton.
- Add `pnpm run plugin:refresh` to refresh the local Codex plugin cache from
  the repo source without hand-copying generated cache files.
- Document the cached plugin CLI fallback for agents when `ask-pro` is not on
  `PATH`.
- Add a cached plugin CLI runner so agents can use the last synced plugin
  snapshot instead of the mutable development checkout when `ask-pro` is not on
  `PATH`.
- Add `ASK_PRO_AGENT_ID` support for per-agent persistent browser profiles.
- Clarify that `ASK_PRO_AGENT_ID` should be unset for ordinary single-agent
  use and stable/reusable for isolated agent profiles.
- Add generated response zip discovery, download, validation, extraction, and
  `PRO_OUTPUT_MANIFEST.json` metadata.
- Add a non-resubmitting `--resume` harvest path for submitted, waiting, and
  timed-out browser sessions.

### Fixed

- Browser: leave reused manual-login Chrome running when a parallel ask-pro tab
  completes, closing only the completed run's isolated tab, and clean up the
  owned temporary-profile launch blank/new-tab page after submit.
- Browser: add a local managed Chrome post-submit CDP input guard so accidental
  human input is ignored while ChatGPT Pro is generating, and strengthen
  Stop-button defocus diagnostics after submit.
- Browser: on Windows, launch fresh managed Chrome runs minimized after
  ask-pro has recorded the profile as auth-ready from a completed run, while
  keeping first login, resume/recovery, and stale auth visible or restorable for
  human action.
- CLI: make `--harvest` status-aware so it does not print placeholder answers
  or mark non-answer-bearing sessions as harvested.
- CLI: keep `--harvest` able to recover a real captured `ANSWER.md` when later
  status bookkeeping is stale.
- CLI: make dry-run stdout reflect persisted `--extended`, `--temporary`, and
  `--no-temporary` status fields after resume-command updates.
- Browser: skip response-zip harvesting for inline-default sessions and record
  `responseZip.status = "not_requested"` when artifacts were not requested.
- Browser: preserve response-zip harvesting when an artifact session completes
  through `--resume`.
- Browser: persist default Temporary Chat fallback to normal ChatGPT in session
  status, browser metadata, and stored resume commands, and clear stale status
  reasons after successful transitions.
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
- Browser: ignore stale saved DevTools profile metadata during resume when the
  advertised port is no longer reachable, then relaunch to recover the session.
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
- Browser: move focus away from ChatGPT's stop control after submit when
  possible, so accidental human input is less likely to cancel a Pro run.
- Browser: remove automation paths that could activate ChatGPT's stop control
  while waiting for a Pro response.
- Browser: prefer ChatGPT's `Copy response` action over `Copy message` when
  capturing browser markdown.
- Browser: stop treating transient reasoning placeholders as completed answers.
- Browser: gracefully close completed ask-pro Chrome runs while keeping
  incomplete/reattachable runs available, and keep incomplete-answer browser
  sessions open for temporary debugging.
- Plugin: normalize the Codex plugin identity to `ask-pro`, add required YAML
  frontmatter, and tighten the skill text into a concise agent runbook.
- Plugin: make `pnpm run plugin:refresh` use a Node entrypoint so the package
  script is not Windows-shell-specific.
- CLI: preserve the active cached/source launcher in generated resume commands.

### Docs

- Rewrite the README and manual smoke docs around local pre-publish usage,
  manual auth, context bundles, response zip fallback, and the reduced V1
  validation loop.
- Polish the public README and cached-runner skill guidance for source installs
  and local Codex plugin usage.
