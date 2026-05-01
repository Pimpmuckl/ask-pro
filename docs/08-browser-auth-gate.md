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

## Human-facing message

```text
ChatGPT authentication is required.
I opened a browser window. Please log into ChatGPT there.
Do not paste credentials into this terminal or agent chat.
When the message composer is visible, run:

ask-pro --resume <session-id>
```

## Machine-readable result

```json
{
  "status": "NEEDS_USER_AUTH",
  "sessionId": "2026-05-01-billing-webhook",
  "reason": "login_page_detected",
  "resumeCommand": "ask-pro --resume 2026-05-01-billing-webhook",
  "browserProfile": "~/.ask-pro/browser-profile"
}
```

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

Preferred order:

1. attach to running Chrome if available and user-approved
2. persistent automation profile at `~/.ask-pro/browser-profile`
3. headful manual-login browser
4. headless only after auth has been verified

Headless is an optimization, not the auth bootstrap path.
