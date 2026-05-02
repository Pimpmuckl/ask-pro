# Risk register

## ChatGPT UI churn

Risk: selectors break.

Mitigation:

- keep selector tests
- merge current composer/model-picker PRs
- fail gracefully to manual copy/upload
- do not over-rely on one selector

## Auth/MFA/CAPTCHA

Risk: automation cannot continue.

Mitigation:

- explicit `NEEDS_USER_AUTH` state
- human logs in manually
- never automate credentials

## Pro model / thinking mode unavailable

Risk: selected Pro/heavy/extended target is missing.

Mitigation:

- target best available Pro mode
- do not fail if thinking effort selection is unavailable
- log selected visible label

## Temporary Chat incompatibility

Risk: Temporary Chat may not expose desired Pro model picker.

Mitigation:

- launch with `https://chatgpt.com/?temporary-chat=true` for clean new runs
- keep model-picker failure messages actionable if ChatGPT changes availability
- keep session metadata

## Generated zip unavailable

Risk: ChatGPT returns markdown only.

Mitigation:

- markdown fallback is first-class
- zip is preferred but optional

## Generated zip unsafe or wrong

Risk: zip includes bad code, scripts, or irrelevant plan.

Mitigation:

- never execute zip contents automatically
- validate schema
- implementation agent translates plan into deliberate changes

## Secret leakage

Risk: repo bundle includes secrets.

Mitigation:

- strict default redaction
- exclude `.env`, keys, build dirs
- test redaction fixtures
- log redaction without leaking values

## Over-deleting useful browser code

Risk: rip-out deletes session/harvest/attachment code.

Mitigation:

- merge browser PRs before deletion
- keep a preserve list
- run tests after deletion

## Public distribution / terms risk

Risk: a public automated ChatGPT web tool may be perceived as scraping or abusive.

Mitigation:

- position as local personal-use browser handoff
- user controls auth
- no credential sharing
- no scale/scraping features
- optional manual copy fallback
