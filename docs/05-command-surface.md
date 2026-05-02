# Naming and command surface

## Names

Use exactly:

```text
Repo/package: ask_pro
CLI binary:   ask-pro
Agent skill:  $ask-pro
Project dir:  .ask-pro/
Global dir:   ~/.agents/skills/ask-pro/
```

Agent-specific browser profiles:

```bash
ASK_PRO_AGENT_ID=review-t1 ask-pro "<question>"
```

This stores the persistent browser profile under
`~/.agents/skills/ask-pro/agents/review-t1-<hash>/browser-profile`.

`ASK_PRO_AGENT_ID` must be lowercase and may contain only letters, numbers,
`.`, `_`, or `-`.

Leave `ASK_PRO_AGENT_ID` unset for normal single-agent use. Set it only for
concurrent or role-specific agents that need isolated browser profiles, and
reuse stable ids. One-off ids create new Chrome profiles and may require a fresh
human login.

## Avoid

Do not use:

```text
ask-smart-guy
smart-guy
consult
oracle-review
guru
wizard
brain
```

## CLI command surface

V1 commands:

```bash
ask-pro "<question>"
ask-pro --dry-run "<question>"
ask-pro --resume [session-id]
ask-pro --status [session-id]
ask-pro --harvest [session-id]
ask-pro --copy [session-id]
ask-pro --extended "<question>"
ask-pro --temporary "<question>"
ask-pro --no-temporary --resume [session-id]
```

Optional file flags:

```bash
ask-pro --files "src/**" --files "prisma/**" "<question>"
```

Do not expose broad model/preset complexity in the normal path. `--extended` is
the single explicit long-thinking opt-in for hard architecture, production-risk,
and implementation-plan package questions where a multi-hour wait is acceptable.
Fresh runs try Temporary Chat by default and automatically retry in normal
ChatGPT if the current account hides Pro models there. `--temporary` makes
Temporary Chat strict and disables that fallback; `--no-temporary` starts or
resumes the session in normal ChatGPT.

## Default behavior

`ask-pro "<question>"` should:

1. create a new session
2. collect focused context
3. write/accept prompt
4. open or attach to ChatGPT browser
5. start in Temporary Chat unless `--no-temporary` is set
6. fall back to normal ChatGPT if the default Temporary Chat path hides Pro
7. select best Pro target if possible
8. select normal Pro thinking effort, or Extended when `--extended` is set
9. upload context
10. submit
11. wait/heartbeat/status
12. harvest markdown
13. download generated zip if available

## Output messages

Good status language:

```text
$ask-pro session created: .ask-pro/sessions/2026-05-01-billing-webhook
ChatGPT auth required. Log in in the opened browser, then run: ask-pro --resume 2026-05-01-billing-webhook
Submitted to ChatGPT Pro. Waiting with 180m budget.
Pro response harvested. Generated zip extracted to pro-output/.
```

Bad status language:

```text
Asking the smart guy...
Consulting the guru...
```
