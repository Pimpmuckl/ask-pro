# $ask-pro workflow

## End-to-end flow

```text
User or agent invokes $ask-pro
  ↓
Agent inspects repo and writes prompt
  ↓
ask-pro creates session folder
  ↓
ask-pro packages focused context
  ↓
ask-pro redacts secrets
  ↓
ask-pro opens/attaches ChatGPT browser
  ↓
If auth needed: NEEDS_USER_AUTH
  ↓
User logs in manually
  ↓
ask-pro resumes
  ↓
ask-pro selects Pro model/thinking if available
  ↓
ask-pro uploads CONTEXT.zip and submits prompt
  ↓
ask-pro waits with heartbeat/reattach
  ↓
ask-pro harvests markdown answer
  ↓
ask-pro downloads ask-pro-response.zip if generated
  ↓
Agent converts output into implementation plan
```

## Minimal agent invocation

The skill invocation is conceptually:

```text
$ask-pro <question/task>
```

The corresponding CLI should be:

```bash
ask-pro "<question/task>"
```

## Prompt ownership

The agent writes the prompt. `ask-pro` may validate the prompt and warn if it is too vague, but it should not replace the prompt with a rigid template.

## Prompt quality validation

Return `PROMPT_TOO_VAGUE` if the prompt lacks multiple critical parts:

```json
{
  "status": "PROMPT_TOO_VAGUE",
  "missing": ["decision_question", "constraints", "expected_output"],
  "suggestion": "Rewrite the prompt before submitting to ChatGPT Pro."
}
```

Do not over-police. The goal is useful escalation, not perfect formality.

## Auth gate

Return `NEEDS_USER_AUTH` if any of these are detected:

- login page
- account selector
- MFA prompt
- CAPTCHA
- blocked session
- no composer visible after navigation

Never automate credentials.

## Wait budget

Default Pro wait budget:

```text
180 minutes
```

This is the tool patience budget, not a ChatGPT SLA.

If the browser disconnects, prefer reattach/harvest over resubmitting.

## Harvesting

Always write harvested markdown to:

```text
.ask-pro/sessions/<id>/ANSWER.md
```

If a generated zip is downloaded and valid, extract it to:

```text
.ask-pro/sessions/<id>/pro-output/
```

Then write:

```text
.ask-pro/sessions/<id>/PRO_OUTPUT_MANIFEST.json
```

If no zip exists, continue with markdown fallback.
