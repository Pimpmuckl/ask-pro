# Pro answer zip contract

`$ask-pro` should prefer a generated implementation bundle from ChatGPT Pro, but must not require one.

## Desired behavior

The prompt asks ChatGPT Pro:

```text
If file generation is available, create a downloadable zip named ask-pro-response.zip.
If file generation is not available, return the same content as markdown sections.
```

## Expected zip name

```text
ask-pro-response.zip
```

If ChatGPT names it differently, accept the first generated zip in the latest assistant response, but record the actual name.

## Required files inside zip

```text
IMPLEMENTATION_PLAN.md
TASKS.json
TEST_PLAN.md
RISK_REGISTER.md
FILES_TO_EDIT.md
REPO_CONTEXT_USED.md
```

## Optional files inside zip

```text
PATCH_NOTES.md
patches/*.diff
schemas/*.json
commands/*.sh
```

## `TASKS.json` shape

```json
{
  "schemaVersion": 1,
  "summary": "One-sentence implementation goal.",
  "tasks": [
    {
      "id": "T01",
      "title": "Short task title",
      "rationale": "Why this task matters",
      "files": ["src/example.ts"],
      "steps": ["Step 1", "Step 2"],
      "tests": ["pnpm test"],
      "risk": "low|medium|high"
    }
  ]
}
```

## `IMPLEMENTATION_PLAN.md` sections

```text
# Recommendation
# Why this approach
# Alternatives considered
# Implementation sequence
# Files to edit
# Migration / rollout notes
# Failure modes
# Tests
# Things not to do
# Final instruction to the coding agent
```

## Download algorithm

After the final answer is visible:

1. Inspect the latest assistant response only.
2. Look for generated file/download cards/links.
3. Prefer a `.zip` artifact whose name contains `ask-pro`, `response`, `implementation`, or `plan`.
4. Download to `.ask-pro/sessions/<id>/downloads/`.
5. Verify it is a zip.
6. Extract to `.ask-pro/sessions/<id>/pro-output/`.
7. Validate required files.
8. If validation fails, keep the zip but mark `responseZip.status = invalid`.
9. If no zip exists, set `responseZip.status = unavailable` and rely on `ANSWER.md`.

## Session metadata

Write:

```json
{
  "responseZip": {
    "status": "downloaded|unavailable|invalid|error",
    "actualFileName": "ask-pro-response.zip",
    "downloadPath": ".ask-pro/sessions/<id>/downloads/ask-pro-response.zip",
    "extractPath": ".ask-pro/sessions/<id>/pro-output",
    "requiredFilesPresent": true,
    "notes": []
  }
}
```

## Fallback behavior

Never fail the whole `$ask-pro` run because ChatGPT did not generate a zip.

Good fallback message:

```text
Pro did not provide a downloadable response zip. Harvested markdown answer to ANSWER.md.
```

Bad fallback message:

```text
Run failed because no zip was generated.
```

## Security

Do not execute scripts from the generated zip automatically.

The generated zip is advice, not trusted code.

The implementation agent may read and translate it into a plan, then edit files deliberately.
