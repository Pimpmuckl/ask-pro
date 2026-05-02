# Session layout

Each run creates a durable session.

## Local project sessions

```text
.ask-pro/sessions/<session-id>/
```

## Required files

```text
PROMPT.md                 # final prompt submitted to ChatGPT
MANIFEST.md               # human-readable context manifest
MANIFEST.json             # machine-readable context manifest
CONTEXT.zip               # uploaded repo context bundle
ANSWER.md                 # harvested markdown answer
status.json               # current state
browser.json              # browser/session/tab metadata
log.txt                   # redacted log
```

## Optional files

```text
downloads/ask-pro-response.zip
pro-output/IMPLEMENTATION_PLAN.md
pro-output/TASKS.json
pro-output/TEST_PLAN.md
pro-output/RISK_REGISTER.md
pro-output/FILES_TO_EDIT.md
pro-output/REPO_CONTEXT_USED.md
PRO_OUTPUT_MANIFEST.json
CODEX_PLAN.md
```

## Session ID format

Prefer:

```text
YYYY-MM-DDTHHMMSS-short-slug
```

Example:

```text
2026-05-01T142000-billing-webhook
```

## `MANIFEST.json`

```json
{
  "schemaVersion": 1,
  "sessionId": "2026-05-01T142000-billing-webhook",
  "question": "Should this billing webhook use a queue or transactional outbox?",
  "includedFiles": [
    {
      "path": "src/api/stripe/webhook.ts",
      "reason": "Current webhook entry point"
    }
  ],
  "excludedFiles": [
    {
      "path": ".env",
      "reason": "secret file"
    }
  ],
  "redaction": {
    "mode": "strict",
    "findings": []
  }
}
```

## `status.json`

```json
{
  "schemaVersion": 1,
  "sessionId": "2026-05-01T142000-billing-webhook",
  "status": "WAITING",
  "createdAt": "2026-05-01T14:20:00+02:00",
  "updatedAt": "2026-05-01T14:35:00+02:00",
  "resumeCommand": "ask-pro --resume 2026-05-01T142000-billing-webhook",
  "harvestCommand": "ask-pro --harvest 2026-05-01T142000-billing-webhook"
}
```

## Retention

Do not auto-delete sessions by default. Long-running Pro work must be replayable and harvestable.

`browser.json` records the exact browser profile path used for the run. When
`ASK_PRO_AGENT_ID` is set, that path is agent-specific so reattach uses the same
isolated profile.
