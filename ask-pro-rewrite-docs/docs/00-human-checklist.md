# Human checklist

You own only the human-sensitive decisions and account interactions.

## Before the implementation agent starts

1. Fork `https://github.com/steipete/oracle` as `ask_pro`.
2. Decide whether the repo is private or public.
3. Decide package scope, if publishing later.
4. Drop this kit into the repo root.
5. Tell the agent to read `AGENTS.md` first.

## Decisions to approve

Confirm these before code deletion:

- V1 is browser-first only.
- V1 removes API engines/providers.
- V1 removes Gemini.
- V1 removes MCP unless later reintroduced as a tiny wrapper.
- V1 removes image generation/editing/download.
- V1 removes TUI.
- V1 removes Project Sources and Deep Research.
- V1 keeps sessions, reattach, harvest, browser profile, attachment upload, copy/render fallback.

## Auth responsibilities

You must authenticate manually when needed.

The agent/tool may open a browser and say:

```text
Please log into ChatGPT in this browser, then resume.
```

You should never paste passwords, MFA codes, or cookies into the agent chat or terminal logs.

## First live smoke test

After the agent finishes a buildable V1, approve one live browser smoke test:

```bash
ask-pro --dry-run "Return exactly ASK_PRO_DRY_RUN_OK."
ask-pro "Return exactly ASK_PRO_BROWSER_OK."
```

For generated-zip behavior, approve one test with a harmless prompt:

```bash
ask-pro "Create a tiny implementation plan and, if file generation is available, a zip named ask-pro-response.zip containing IMPLEMENTATION_PLAN.md."
```

## Publish decision

Do not publish until:

- browser login flow has been tested locally
- generated zip fallback has been tested
- secrets redaction has tests
- the command surface is minimal
- docs say clearly that the tool uses the user's own ChatGPT session
