# Browser auth gate

`ask-pro` must handle auth as a state machine.

## States

```text
CREATED
CONTEXT_READY
BROWSER_STARTING
CHECKING_AUTH
NEEDS_USER_AUTH
AUTH_OK
SUBMITTING
SUBMITTED
WAITING
WAIT_TIMED_OUT
READY_TO_HARVEST
HARVESTED
COMPLETED
FAILED
```

## Auth detection

Return `NEEDS_USER_AUTH` when:

- URL contains login/auth/account challenge
- ChatGPT composer is not visible
- MFA UI is visible
- CAPTCHA/challenge UI is visible
- user account chooser is visible
- browser asks for permission that requires human action

## Agent-facing result

```toon
ask_pro
  session: 2026-05-01-billing-webhook
  state: needs_auth
  reason: login_page_detected
  profile: ~/.agents/skills/ask-pro/browser-profile
  action: human_login_then_resume
  resume: "ask-pro --resume 2026-05-01-billing-webhook"
```

The browser window is the credential boundary. The calling agent should ask the
human to log in there and then run the emitted resume command.

## Resume behavior

On resume:

1. Reattach to existing browser/tab if possible.
2. Verify ChatGPT composer is visible.
3. Verify correct session prompt/context still exists.
4. Continue from the last safe state.
5. Do not resubmit if already submitted; harvest instead.

## Credential safety

Never:

- type the user's password
- ask the user to share MFA codes
- read cookies from logs
- print auth cookies
- store raw cookies in session logs

Debug logs must redact cookies and bearer tokens.

## Browser modes

The `ask-pro` CLI uses deterministic managed profiles and locks for new runs.
Resume may reattach to saved browser runtime metadata when a session already
has it.

1. persistent automation profile at `~/.agents/skills/ask-pro/browser-profile`
   for default runs, or
   `~/.agents/skills/ask-pro/agents/<id>-<hash>/browser-profile` when
   `ASK_PRO_AGENT_ID` is set
2. headful manual-login browser
3. headless only after auth has been verified

Generic browser automation may attach to a user-approved running Chrome, but
`ask-pro` should keep agent-scoped runs on the managed profile path.

Headless is an optimization, not the auth bootstrap path.
