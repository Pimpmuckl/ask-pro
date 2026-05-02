# ask_pro

`ask_pro` is a browser-backed ChatGPT Pro escalation tool for agents.

It packages a focused repo context bundle, opens ChatGPT in a persistent browser
profile, asks the selected Pro model, waits for the answer, and stores the
result in a local project session under `.ask-pro/`.

The normal command is intentionally small:

```bash
ask-pro "Review this architecture before I implement it."
```

Agent-facing use is the `$ask-pro` skill: the calling agent decides what context
matters, writes the prompt, and lets `ask-pro` handle bundling, redaction,
browser submission, auth gating, waiting, harvesting, and optional generated zip
extraction.

## Manual Install

This package is not published yet. Clone the repo and use it locally while it
is still in pre-release cleanup.

### CLI

```bash
git clone https://github.com/Pimpmuckl/ask-pro.git
cd ask-pro
pnpm install
pnpm run build
pnpm start -- "Return exactly ASK_PRO_OK."
```

For a shell-local binary:

```bash
pnpm link --global
ask-pro "Review the staged implementation plan."
```

Requires Node 24+.

If `ask-pro` is not on `PATH`, agents can still use the source checkout:

```powershell
cd C:\Code\ask-pro
npm exec --yes pnpm@10.33.2 -- start -- "Review the staged implementation plan."
```

### Codex Plugin

The CLI and Codex plugin are separate installs. The plugin is what makes
`$ask-pro` and `$ask-pro:ask-pro` appear in Codex.

Add the repo to your home marketplace file:

```text
~/.agents/plugins/marketplace.json
```

Example marketplace entry:

```json
{
  "name": "ask-pro",
  "source": {
    "source": "local",
    "path": "../../Code/ask-pro"
  },
  "policy": {
    "installation": "AVAILABLE",
    "authentication": "ON_USE"
  },
  "category": "Productivity"
}
```

If you do not already have a home marketplace, the full file can look like:

```json
{
  "name": "local",
  "interface": {
    "displayName": "Local Plugins"
  },
  "plugins": [
    {
      "name": "ask-pro",
      "source": {
        "source": "local",
        "path": "../../Code/ask-pro"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_USE"
      },
      "category": "Productivity"
    }
  ]
}
```

Then enable the plugin in your Codex config:

```toml
[plugins."ask-pro@local"]
enabled = true
```

Use your marketplace name in place of `local` if your marketplace uses another
name.

After restarting Codex, the skill list should include both `$ask-pro` and the
plugin-qualified `$ask-pro:ask-pro`.

When you change plugin-facing files such as `README.md`,
`.codex-plugin/plugin.json`, or `skills/ask-pro/SKILL.md`, refresh the local
Codex plugin cache from the repo source:

```powershell
pnpm run plugin:refresh
```

The cache under `~/.codex/plugins/cache/...` is generated install state. Do not
edit or hand-copy files there; refresh the plugin and restart or reload Codex.
The plugin cache intentionally contains docs and skills only; run the CLI from
the source checkout or a linked `ask-pro` binary.

An eventual `npm install -g ask_pro` will install the `ask-pro` CLI only. It
will not automatically register the Codex plugin unless Codex adds an npm-based
plugin installer or marketplace source.

## First Login

`ask-pro` uses a dedicated Chrome profile at:

```text
~/.agents/skills/ask-pro/browser-profile
```

For ordinary single-agent use, leave `ASK_PRO_AGENT_ID` unset so runs reuse the
shared persistent profile. For truly independent or concurrent agents, set a
stable reusable `ASK_PRO_AGENT_ID` before running `ask-pro`. Use a lowercase id
containing only letters, numbers, `.`, `_`, or `-`. Each new agent id gets its
own persistent profile and profile lock, so throwaway ids may require another
human login:

```powershell
$env:ASK_PRO_AGENT_ID = "review-t1"
ask-pro "Review this migration plan."
Remove-Item Env:ASK_PRO_AGENT_ID
```

That profile lives under an agent-specific directory. The final directory name
includes a stable hash suffix so similar agent names cannot collide:

```text
~/.agents/skills/ask-pro/agents/review-t1-<hash>/browser-profile
```

On the first browser run, ChatGPT may ask you to sign in, complete MFA, or clear
a browser challenge. Authentication is human-controlled: `ask-pro` never asks
for passwords, MFA codes, recovery codes, cookies, or raw auth tokens.

If auth is needed, the run records the session and prints a resume command. Log
in in the opened browser, then resume:

```bash
ask-pro --resume <session-id>
```

Browser runs can take a long time. `ask-pro` uses normal Pro thinking effort by
default. For a deliberate long-haul escalation, pass `--extended`:

```bash
ask-pro --extended "Review this architecture decision."
```

Use `--extended` for difficult architecture questions, production-risk reviews,
and implementation-plan packages where a multi-hour wait is acceptable.

Temporary Chat is available as an explicit opt-in:

```bash
ask-pro --temporary "Review this sensitive migration plan."
```

Use `--temporary` only when ephemeral ChatGPT history matters. Temporary Chat
sessions are less recoverable if the browser or tab is closed before harvest,
and some ChatGPT accounts may hide Pro models there.

## Commands

```bash
ask-pro [options] [question...]
```

Useful options:

| Option                   | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `--files <pattern>`      | Add a file, directory, or glob to the context bundle. Repeat as needed. |
| `--dry-run`              | Create the session and `CONTEXT.zip` without opening ChatGPT.           |
| `--resume [session-id]`  | Resume the latest or selected prepared/waiting session.                 |
| `--status [session-id]`  | Show the latest or selected session status.                             |
| `--harvest [session-id]` | Print harvested `ANSWER.md`.                                            |
| `--copy [session-id]`    | Print the session prompt/copy target for manual fallback.               |
| `--extended`             | Request Extended Pro thinking for deep, multi-hour escalations.         |
| `--temporary`            | Start in ChatGPT Temporary Chat; less recoverable after tab loss.       |
| `--verbose`              | Print browser automation diagnostics.                                   |

Examples:

```bash
ask-pro --dry-run --files "src/**/*.ts" "Audit this slice for hidden coupling."
ask-pro --files src/ask-pro/session.ts --files tests/ask-pro "Find missing tests."
ask-pro --status
ask-pro --harvest 2026-05-01T165438-return-exactly-ask-pro-browser-login-ready
```

## Sessions

Project-local session data lives in:

```text
.ask-pro/sessions/<session-id>/
```

Important files:

| File                            | Purpose                                            |
| ------------------------------- | -------------------------------------------------- |
| `PROMPT.md`                     | The prompt sent to ChatGPT Pro.                    |
| `MANIFEST.md` / `MANIFEST.json` | Context bundle inventory.                          |
| `CONTEXT.zip`                   | Redacted context uploaded to ChatGPT.              |
| `ANSWER.md`                     | Harvested markdown answer.                         |
| `browser.json`                  | Browser runtime metadata.                          |
| `status.json`                   | Session state and timestamps.                      |
| `downloads/`                    | Downloaded response zip, when ChatGPT exposes one. |
| `pro-output/`                   | Extracted generated response zip files.            |
| `PRO_OUTPUT_MANIFEST.json`      | Response zip status and extracted file metadata.   |

Generated session data is ignored by git.

## Response Zip

Markdown is always the fallback. If the Pro answer exposes a `.zip` link,
`ask-pro` downloads it in the browser context, validates it, extracts it under
`pro-output/`, and writes `PRO_OUTPUT_MANIFEST.json`.

The expected generated zip contract is:

```text
IMPLEMENTATION_PLAN.md
TASKS.json
TEST_PLAN.md
RISK_REGISTER.md
FILES_TO_EDIT.md
REPO_CONTEXT_USED.md
```

`ask-pro` never executes generated zip contents.

## Agent Skill

The Codex skill lives at:

```text
skills/ask-pro/SKILL.md
```

Use it when a local agent needs a second-pass ChatGPT Pro review of a hard
engineering question. The agent should keep the context focused and include only
files that matter to the question.

## Docs

Project docs live under `docs/`:

- `docs/01-agent-mission.md` for the product contract.
- `docs/05-command-surface.md` for the supported CLI.
- `docs/07-pro-answer-zip-contract.md` for generated response bundles.
- `docs/manual-tests.md` for opt-in browser smokes.

## Validation

Fast local checks:

```bash
pnpm run build
pnpm run lint
pnpm run test:ask-pro
pnpm run format:check
pnpm pack --dry-run
```

Manual browser smokes are opt-in because they open a real ChatGPT session. See
`docs/manual-tests.md`.
