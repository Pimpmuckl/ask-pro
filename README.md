# ask-pro

`ask-pro` is a Codex plugin and CLI that lets coding agents ask ChatGPT Pro for
a focused second opinion through a human-logged-in browser session.

Use it for architecture calls, production-risk reviews, migrations, debugging
strategy, and implementation planning. The calling agent still owns the work:
`ask-pro` collects the consult, stores the answer, and never applies generated
code automatically.

## Install

Add this repository as a Codex plugin marketplace:

```powershell
codex plugin marketplace add Pimpmuckl/ask-pro
```
Install the plugin or open `/plugins`, install `ask-pro`:
```powershell
codex plugin add ask-pro@ask-pro
```

Upgrade the plugin manually:
```powershell
codex plugin marketplace upgrade ask-pro
```

If the marketplace does not appear after adding or upgrading it, restart Codex.
The repository marketplace exposes the root plugin through a Git-backed plugin
entry, so no manual copy into `~/.codex/plugins/cache` is needed.

For local development from a checkout:

```powershell
pnpm install
pnpm run build
pnpm run plugin:refresh
```

`pnpm run plugin:refresh` updates the local Codex plugin cache from the source
checkout. By default it refreshes the installed Git marketplace cache under
`~/.codex/plugins/cache/ask-pro/ask-pro/<version>`, so no separate local
marketplace install is needed for development. Do not edit
`~/.codex/plugins/cache/...` by hand.

Git marketplace installs cache the source checkout. If `ask-pro` is not on
`PATH`, agents should use the cached runner under
`~/.codex/plugins/cache/<marketplace>/ask-pro/<version>/scripts/run-cached-cli.mjs`.
The first runner call may install dependencies and build `dist` in that cache.

## Requirements

- Node.js 24+
- pnpm 10+
- Chrome
- A ChatGPT account with Pro access

Authentication is manual. `ask-pro` never asks for, types, reads, or logs
passwords, MFA codes, recovery codes, session cookies, or raw auth tokens.

The default persistent browser profile is:

```text
~/.agents/skills/ask-pro/browser-profile
```

Each new profile may need a human login once. On Windows, fresh runs for an
auth-ready managed profile start minimized; login, resume/recovery, stale-auth,
and debug paths stay visible or are restored for human action.

## Quick Use

Ask for an inline markdown consult:

```powershell
ask-pro --no-temporary --prompt-file question.md --files src --files tests
```

The browser flow selects `GPT-5.6 Sol`, then `Pro` intelligence automatically.

Request generated files only when you really need an implementation package:

```powershell
ask-pro --artifacts --prompt-file implementation-plan.md --files src
```

Harvest the answer:

```powershell
ask-pro --harvest <session-id>
```

## Agent Guidance

- Prefer `--prompt-file` for multiline prompts.
- If `ask-pro` is not on `PATH`, use the cached plugin runner instead of a
  mutable source checkout.
- Treat ChatGPT Pro as a cold oracle: it does not know the repo, user, prior
  decisions, or Codex thread context unless you include that in the prompt or
  attached files.
- Provide more background than feels strictly necessary: product goal, current
  state, constraints, files attached, options considered, and the exact output
  you need.
- Prefer `--no-temporary` for repo advisories, review rounds, large bundles, or
  anything where recovery matters.
- Keep bundles focused: relevant source, focused tests, docs that define the
  contract, recent changes, and validation status.
- Add `.ask-pro/` to consuming repos' `.gitignore`.
- Treat `INCOMPLETE_ANSWER` / `preamble_without_artifacts` as not done; resume
  or rerun with a tighter prompt and bundle.
- Never execute generated zip contents automatically.

Useful advisory prompt starter:

```text
Return final markdown only. Do not answer with a preamble. Do not produce an implementation package. Rank findings by severity. Treat attached bundle as authoritative. Call out uncertainty.
```

## CLI

```text
ask-pro [options] [question...]
```

Common options:

- `--files <pattern>`: add a file, directory, or glob to `CONTEXT.zip`.
- `--prompt-file <path>`: read the question from a UTF-8 file; use `-` for
  stdin.
- `--artifacts` / `--response-zip`: ask for `ask-pro-response.zip`.
- `--resume [session-id]`: resume a prepared, waiting, or auth-gated session.
- `--status [session-id]`: print compact session state.
- `--harvest [session-id]`: print `ANSWER.md` for answer-bearing sessions.
- `--temporary`: require ChatGPT Temporary Chat.
- `--no-temporary`: use normal ChatGPT for better recovery.
- `--verbose`: print browser automation diagnostics.

Session data lives under `.ask-pro/sessions/<session-id>/`.

## Development

Fast checks:

```powershell
pnpm run build
pnpm run lint
pnpm run test:ask-pro
pnpm run format:check
pnpm pack --dry-run
```

Manual browser smokes are opt-in because they open a real ChatGPT session. See
`docs/manual-tests.md`.
