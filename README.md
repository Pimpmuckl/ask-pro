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

If `ask-pro` is not on `PATH`, agents should use the cached plugin runner, not
the mutable development checkout. The cached runner is refreshed by
`pnpm run plugin:refresh` and represents the last synced plugin version:

```powershell
node "$env:USERPROFILE\.codex\plugins\cache\jonat-local\ask-pro\local\scripts\run-cached-cli.mjs" -- --cwd C:\Code\jjagentskills --no-temporary --prompt-file .\question.md --files plugins\review-suite
```

`--files` must resolve inside the project cwd. For cross-repo cached-runner
calls, always pass `--cwd <target-repo-root>` and keep `--files` repo-relative
to that target repo.

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
The plugin cache contains the agent-facing docs plus a built CLI snapshot for
fallback calls. Agents should use that cached runner instead of `C:\Code\ask-pro`
so development work in this checkout cannot affect active callers before sync.

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

If auth is needed, the run records the session and prints a compact
agent-readable state with a resume command. Log in in the opened browser, then
resume:

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
When ChatGPT labels the model row simply as `Pro`, `ask-pro` treats that as the
current latest Pro target and only uses exact version strings as hints.

By default, fresh runs open ChatGPT Temporary Chat first:

```text
https://chatgpt.com/?temporary-chat=true
```

If the current ChatGPT account/UI does not expose Pro in Temporary Chat,
`ask-pro` automatically retries the fresh default run in normal ChatGPT. Use
`--temporary` only when Temporary Chat is required and falling back to normal
ChatGPT would be wrong:

```bash
ask-pro --temporary "Review this sensitive migration plan."
```

Temporary Chat sessions are less recoverable if the browser or tab is closed
before harvest. To force a run or retry outside Temporary Chat, use
`--no-temporary`:

```bash
ask-pro --no-temporary --resume <session-id>
```

For repo advisories, large bundles, review rounds, or anything where recovery
matters, prefer `--no-temporary` from the start. Temporary Chat is best reserved
for cases where ephemeral ChatGPT history matters more than resume/recovery.

While Pro is thinking, leave the launched Chrome window alone. ChatGPT can focus
its stop control after submit; `ask-pro` moves focus to a harmless element when
it can, but human keystrokes or clicks in the run window can still cancel a live
answer.

## Commands

```bash
ask-pro [options] [question...]
```

Useful options:

| Option                   | Purpose                                                                 |
| ------------------------ | ----------------------------------------------------------------------- |
| `--files <pattern>`      | Add a file, directory, or glob to the context bundle. Repeat as needed. |
| `--prompt-file <path>`   | Read the question from a UTF-8 file; use `-` for stdin.                 |
| `--artifacts`            | Ask for `ask-pro-response.zip` plus markdown fallback.                  |
| `--response-zip`         | Alias for `--artifacts`.                                                |
| `--dry-run`              | Create the session and `CONTEXT.zip` without opening ChatGPT.           |
| `--resume [session-id]`  | Resume the latest or selected prepared/waiting session.                 |
| `--status [session-id]`  | Show the latest or selected session status.                             |
| `--harvest [session-id]` | Print harvested `ANSWER.md`.                                            |
| `--copy [session-id]`    | Print the session prompt/copy target for manual fallback.               |
| `--extended`             | Request Extended Pro thinking for deep, multi-hour escalations.         |
| `--temporary`            | Require ChatGPT Temporary Chat; fail instead of falling back.           |
| `--no-temporary`         | Start or resume outside Temporary Chat.                                 |
| `--verbose`              | Print browser automation diagnostics.                                   |

Examples:

```bash
ask-pro --dry-run --files "src/**/*.ts" "Audit this slice for hidden coupling."
ask-pro --files src/ask-pro/session.ts --files tests/ask-pro "Find missing tests."
ask-pro --no-temporary --prompt-file question.md --files .\src
ask-pro --artifacts --prompt-file implementation-plan.md --files src
ask-pro --status
ask-pro --harvest 2026-05-01T165438-return-exactly-ask-pro-browser-login-ready
```

Use `--prompt-file` for multiline prompts. This avoids shell quoting issues and
keeps the exact question in `PROMPT.md`. `--files` accepts files, directories,
and globs; Windows backslash paths and absolute paths inside the project cwd are
normalized into stable relative manifest paths.

Add `.ask-pro/` to consuming repos' `.gitignore`. Session files are local run
artifacts and should not show up in normal repo diffs.

Keep context bundles focused: relevant source files, focused tests, docs that
define the contract, known recent changes, and validation status. Avoid
whole-repo bundles unless the question is explicitly broad architecture.

## Agent Output

`ask-pro` is an agent-facing CLI. Normal stdout is compact TOON-style telemetry;
browser progress and diagnostics go to stderr/session logs. `--harvest` is the
exception: it prints the raw `ANSWER.md` body so agents can pipe or read the Pro
answer without metadata noise.

Example dry-run/status output:

```toon
ask_pro
  session: 2026-05-02T192156-review-this
  state: dry_run_complete
  thinking: standard
  temporary: default
  action: resume
  resume: "ask-pro --resume 2026-05-02T192156-review-this"
  files: 1
```

Example auth gate:

```toon
ask_pro
  session: 2026-05-02T192156-review-this
  state: needs_auth
  reason: login_page_detected
  profile: shared
  profile_path: ~/.agents/skills/ask-pro/browser-profile
  chrome: launched
  language: "en-US,en"
  action: human_login_then_resume
  resume: "ask-pro --resume 2026-05-02T192156-review-this"
```

When known, normal status records may also include `profile`, `profile_path`,
`chrome`, `language`, and `conversation_url`. These are diagnostic hints for
agents deciding whether a run is using the shared profile, an isolated agent
profile, a saved DevTools session, the expected English browser steering, or a
recoverable non-temporary ChatGPT conversation.

Generated response zips are harvested when ChatGPT provides them. The wrapper no
longer asks for a zip by default; pass `--artifacts` / `--response-zip` only
when a structured implementation bundle is useful. If no zip is available, use
`ask-pro --harvest <session-id>` to print the markdown answer.

Completed sessions close the isolated run tab/browser by design. If the capture
looks like a deferred-work preamble instead of a real answer, `ask-pro` marks the
session `INCOMPLETE_ANSWER` / `preamble_without_artifacts` and may leave the
browser open for debugging. Do not treat this as a completed consult. Try
resume/harvest if recoverable; otherwise rerun with `--no-temporary`, a tighter
bundle, and a more direct prompt.

Default advisory prompt shape:

```text
Return final markdown only. Do not answer with a preamble. Do not produce an implementation package. Rank findings by severity. Treat attached bundle as authoritative. Call out uncertainty.
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
