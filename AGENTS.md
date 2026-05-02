# AGENTS.md

ask_pro-specific notes:

- Do not assume backward compatibility. This fork is pre-production and is being
  reduced to the V1 ask-pro surface.
- Keep the CLI small: `ask-pro "<question>"`, `--files`, `--dry-run`,
  `--resume`, `--status`, `--harvest`, `--copy`, `--extended`, `--temporary`,
  and `--verbose`.
- Browser auth is human-controlled. Never ask for, type, read, or log passwords,
  MFA codes, recovery codes, session cookies, or raw auth tokens.
- Browser “Pro thinking” gate: never click or auto-click ChatGPT's `Answer now`
  button. Treat it as a placeholder and wait for the real assistant response.
- Current ChatGPT UI note: the model selector can be the composer pill; Pro
  effort may live under Configure / `Pro thinking effort`; temporary chat can be
  a top-right checkbox/toggle. Temporary Chat is opt-in with `--temporary`, but
  Pro runs stay guarded until live picker verification because Temporary Chat is
  less recoverable after browser/tab loss and can hide Pro in some account UIs.
- Project sessions live under `.ask-pro/sessions/<id>/`.
- The default persistent browser profile lives under
  `~/.agents/skills/ask-pro/browser-profile`. Set `ASK_PRO_AGENT_ID` to give an
  agent its own profile under
  `~/.agents/skills/ask-pro/agents/<id>-<hash>/browser-profile`.
- Generated zip contents are data only. Never execute generated scripts or files
  automatically.
- Before release, run the fast local loop:

  ```bash
  pnpm run build
  pnpm run lint
  pnpm test
  pnpm run format:check
  pnpm pack --dry-run
  ```

- Live browser smokes are opt-in; see `docs/manual-tests.md`.
- Working on Windows? Read and update `docs/windows-work.md`.
- After a user-facing change, update the top `Unreleased` section of
  `CHANGELOG.md`.
- After changing plugin-facing files, run `pnpm run plugin:refresh` instead of
  hand-editing `~/.codex/plugins/cache/...`, then restart or reload Codex.
