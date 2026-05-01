# Naming and command surface

## Names

Use exactly:

```text
Repo/package: ask_pro
CLI binary:   ask-pro
Agent skill:  $ask-pro
Project dir:  .ask-pro/
Global dir:   ~/.ask-pro/
```

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
```

Optional file flags:

```bash
ask-pro --files "src/**" --files "prisma/**" "<question>"
```

Optional browser controls only for debugging:

```bash
ask-pro --headful "<question>"
ask-pro --no-attach-running "<question>"
ask-pro --timeout 180m "<question>"
```

Do not expose model/preset complexity in the normal path.

## Default behavior

`ask-pro "<question>"` should:

1. create a new session
2. collect focused context
3. write/accept prompt
4. open or attach to ChatGPT browser
5. select best Pro target if possible
6. select deepest compatible thinking mode if possible
7. upload context
8. submit
9. wait/heartbeat/status
10. harvest markdown
11. download generated zip if available

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
