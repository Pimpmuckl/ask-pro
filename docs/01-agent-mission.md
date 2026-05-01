# Agent mission

Build `ask_pro`, a minimal browser-backed ChatGPT Pro escalation tool focused on one job:

```text
Agent invokes $ask-pro
→ ask-pro bundles relevant repo context
→ ask-pro drives ChatGPT Pro in the browser
→ human authenticates when needed
→ Pro answers, preferably with a downloadable implementation zip
→ ask-pro harvests the answer/zip
→ agent turns it into an implementation plan
```

## Success looks like

A coding agent can run:

```bash
ask-pro "Should this billing webhook use a queue or transactional outbox? Return a concrete implementation plan."
```

and get a session containing:

```text
.ask-pro/sessions/<id>/
  PROMPT.md
  MANIFEST.md
  CONTEXT.zip
  ANSWER.md
  pro-output/                  # if generated zip was downloaded
  CODEX_PLAN.md                # optional, produced by the calling agent
  browser.json
  status.json
  log.txt
```

## Design constraints

- No API provider complexity in V1.
- No presets.
- No MCP in V1 unless explicitly reintroduced as a tiny wrapper.
- Browser automation is the core.
- Auth is user-controlled.
- The calling agent writes the prompt.
- `ask-pro` validates and transports the prompt/context.
- Generated implementation zip is preferred but never required.
- Markdown fallback must always work.

## Browser target

Use a regular browser / persistent automation profile / attach-running Chrome approach.

Do not depend on a browser surface that cannot handle signed-in ChatGPT.

## The answer is not the implementation

`ask-pro` obtains the Pro answer. The coding agent still must:

1. Read the answer and/or `pro-output/` bundle.
2. Create a local implementation plan.
3. Confirm risky changes if needed.
4. Edit the repo.
5. Run tests.
