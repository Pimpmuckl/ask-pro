# Kickoff prompt for implementation agent

You are implementing `ask_pro`, a fork of `steipete/oracle`.

Read these files first:

1. `AGENTS.md`
2. `skills/ask-pro/SKILL.md`
3. `docs/01-agent-mission.md`
4. `docs/02-upstream-pr-triage.md`
5. `docs/03-cherrypick-order.md`
6. `docs/04-rip-out-plan.md`
7. `docs/07-pro-answer-zip-contract.md`
8. `docs/10-testing-acceptance.md`

Then produce a plan before code edits.

The product target is:

- repo/package: `ask_pro`
- binary: `ask-pro`
- agent invocation: `$ask-pro`
- no presets
- browser-first ChatGPT Pro escalation
- generated implementation zip preferred, markdown fallback required
- user-controlled auth gate
- API/Gemini/MCP/image/TUI/Project Sources/Deep Research removed for V1

Do not delete browser/session/attachment/harvest code before merging useful browser PRs.
