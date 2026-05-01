# ask_pro agent instructions

You are working in the `ask_pro` fork of `steipete/oracle`.

Your mission is to produce a browser-first, minimal, agent-facing ChatGPT Pro escalation tool.

## Product names

Use these names consistently:

- Repository/package: `ask_pro`
- CLI binary: `ask-pro`
- Agent-facing invocation/skill: `$ask-pro`
- Local project session directory: `.ask-pro/`
- Global user config/profile directory: `~/.ask-pro/`

Do not use “smart guy”, “guru”, “wizard”, “oracle review”, or “consult” in user-facing commands.

## V1 command surface

Keep the CLI small:

```bash
ask-pro "<question>"
ask-pro --resume [session-id]
ask-pro --status [session-id]
ask-pro --harvest [session-id]
ask-pro --copy [session-id]
ask-pro --dry-run "<question>"
ask-pro --files "src/**" --files "prisma/**" "<question>"
```

Do not add presets in V1. The skill and defaults carry the taste.

## Non-negotiable behavior

When `$ask-pro` is invoked, the calling agent must:

1. Inspect the repo enough to understand the question.
2. Choose relevant files and explain why they are included.
3. Write the actual prompt itself.
4. Package context safely.
5. Submit through ChatGPT browser automation.
6. Ask the human to authenticate if login/MFA/CAPTCHA is required.
7. Wait, resume, or harvest as needed.
8. Prefer a Pro-generated implementation zip when available.
9. Convert the answer or zip contents into a concrete implementation plan.

## Browser/auth rules

Never type or request the user's ChatGPT password, one-time code, recovery code, or session cookie.

If auth is required, return a machine-readable state such as:

```json
{
  "status": "NEEDS_USER_AUTH",
  "message": "Please log into ChatGPT in the opened browser window, then resume with ask-pro --resume <session-id>.",
  "sessionId": "<id>",
  "resumeCommand": "ask-pro --resume <id>"
}
```

After the user authenticates, verify that the ChatGPT composer is visible before continuing.

## Prompt ownership

The implementation of `ask-pro` must not force a rigid template. It may validate prompt quality, but the calling agent writes the prompt.

Validation should check for:

- concrete decision/question
- repo context summary
- relevant files/manifest
- constraints
- options considered
- output requested
- request for implementation zip when useful

## Pro response zip

For hard implementation tasks, the calling prompt should ask ChatGPT Pro to return both a written answer and, if possible, a downloadable zip named `ask-pro-response.zip`.

`ask-pro` should attempt to download generated file artifacts from the latest assistant response. If the zip is unavailable, harvest markdown and continue.

See `docs/07-pro-answer-zip-contract.md`.

## Preferred order of work

1. Merge/cherry-pick browser reliability PRs while upstream structure still exists.
2. Add/rename minimal `ask-pro` command surface.
3. Add `$ask-pro` skill docs.
4. Add answer-zip download/validation.
5. Rip out API/Gemini/MCP/image/TUI/Project Sources/Deep Research.
6. Simplify tests and docs.
7. Run acceptance criteria.

Do not delete browser/session/attachment/harvest features while simplifying.
