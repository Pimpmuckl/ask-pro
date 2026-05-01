# ask_pro repo drop

This is a repo-ready handoff kit for building `ask_pro`, a slim fork of `steipete/oracle`.

The naming is now final:

- Repo/package: `ask_pro`
- CLI binary: `ask-pro`
- Agent-facing invocation/skill: `$ask-pro`
- Local project session dir: `.ask-pro/`
- Global user config/profile dir: `~/.ask-pro/`

`$ask-pro` means: the agent escalates a hard engineering question to ChatGPT Pro through browser automation, with a focused repo-context bundle, strict redaction, user-controlled authentication, long-run reattach/harvest behavior, and an optional downloadable implementation zip from Pro.

## North star

Normal use should be this simple:

```bash
ask-pro "Review this architecture before I implement it."
```

Agent-facing use should be this simple:

```text
$ask-pro this before implementing
```

The agent writes the actual prompt. `ask-pro` owns bundling, redaction, browser submission, auth gating, waiting, harvesting, and generated-response-bundle extraction.

## V1 defaults

V1 should default to:

```text
engine: ChatGPT browser automation
model: best available Pro model, target GPT-5.5 Pro if available
thinking: deepest compatible mode, but do not fail if unavailable
auth: manual user auth gate when needed
context: agent-selected focused context
redaction: strict
temporary chat: not mandatory; prefer dedicated clean ChatGPT project/chat if Pro selection conflicts
wait budget: 3h by default for Pro/long-thinking runs
answer: harvest markdown and download generated response zip when available
fallback: copy/render/manual-upload flow
```

The 3h value is only the automation wait budget. It is not a promise about ChatGPT response time.

## Files in this drop

```text
README.md                         overview
AGENTS.md                         implementation-agent rules
skills/ask-pro/SKILL.md           Codex/agent skill for $ask-pro
.codex-plugin/plugin.json         lightweight plugin skeleton
docs/00-human-checklist.md        what the human must do
docs/01-agent-mission.md          implementation-agent mission
docs/02-upstream-pr-triage.md     PRs to merge/cherry-pick/skip
docs/03-cherrypick-order.md       recommended integration order
docs/04-rip-out-plan.md           what to remove from upstream Oracle
docs/05-command-surface.md        final minimal CLI surface
docs/06-ask-pro-workflow.md       end-to-end flow
docs/07-pro-answer-zip-contract.md Pro-generated implementation zip contract
docs/08-browser-auth-gate.md      auth state machine
docs/09-session-layout.md         session files and metadata
docs/10-testing-acceptance.md     tests and acceptance criteria
docs/11-risk-register.md          known risks/mitigations
prompts/01-kickoff-agent.md       prompt for implementation agent
prompts/02-pro-prompt-rubric.md   guidance for prompts sent to Pro
config/ask-pro.config.example.json example config
config/gitignore-snippet.txt      suggested .gitignore entries
scripts/verify-doc-drop.sh        verifies this doc drop is complete
```

## What to delete from upstream Oracle

Delete or de-scope in V1:

- API engines/providers
- Gemini web mode
- image generation/editing/download features
- MCP server, unless later reintroduced as a one-tool wrapper
- TUI
- Project Sources management
- Deep Research mode
- API follow-up lineage/cost accounting
- remote browser server, unless needed for attach-running Chrome

Keep:

- browser automation
- manual login / persistent browser profile
- attach-running Chrome if PR support is merged
- file bundling and redaction
- attachment upload reliability
- long-run status/reattach/harvest
- session store
- dry-run/copy/render fallback
- generated response zip download/validation

## How to hand this to an implementation agent

Tell the agent:

```text
Read AGENTS.md and prompts/01-kickoff-agent.md. Implement ask_pro with binary ask-pro and skill $ask-pro. Merge browser reliability PRs before deleting upstream code. Keep browser/session/attachment/harvest functionality. Add generated ask-pro-response.zip download/validation. Then remove API/Gemini/MCP/image/TUI/Project Sources/Deep Research.
```
