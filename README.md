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

An eventual `npm install -g ask_pro` will install the `ask-pro` CLI only. It
will not automatically register the Codex plugin unless Codex adds an npm-based
plugin installer or marketplace source.

## First Login

`ask-pro` uses a dedicated Chrome profile at:

```text
~/.agents/skills/ask-pro/browser-profile
```

On the first browser run, ChatGPT may ask you to sign in, complete MFA, or clear
a browser challenge. Authentication is human-controlled: `ask-pro` never asks
for passwords, MFA codes, recovery codes, cookies, or raw auth tokens.

If auth is needed, the run records the session and prints a resume command. Log
in in the opened browser, then resume:

```bash
ask-pro --resume <session-id>
```

Browser runs can take a long time. Pro thinking is allowed a 3 hour automation
budget by default.

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
