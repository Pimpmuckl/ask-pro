# Rip-out plan

After the useful browser PRs are merged, simplify aggressively.

## Keep

Keep these capabilities:

- ChatGPT browser automation
- persistent browser profile/manual login
- attach-running Chrome if supported
- focused file bundling
- secret redaction
- attachments/context upload
- response waiting and completion detection
- thinking/liveness heartbeat
- session store
- status/resume/harvest/live tail
- copy/render/manual fallback
- generated response zip download/validation

## Remove API providers

Remove:

- OpenAI API engine
- Azure OpenAI
- Anthropic/Claude API
- Gemini API
- OpenRouter/custom API base URL
- API model catalog
- API background mode
- API follow-up response IDs
- API token/cost accounting
- multi-provider/multi-model runs

Rationale: `ask_pro` is browser-backed Pro escalation, not a provider router.

## Remove Gemini browser mode

Remove:

- `gemini.google.com` automation
- Gemini cookies/session config
- YouTube analysis
- Gemini Deep Think labels
- Gemini image generation/editing

Rationale: not relevant to `$ask-pro`.

## Remove image generation/download features

Remove:

- image prompt flags
- image edit flags
- aspect ratio flags
- image result download
- image-specific output handling

Rationale: `$ask-pro` is for engineering planning.

Generated implementation zip download is different and should be kept/added.

## Remove MCP for V1

Remove upstream MCP server and tools in V1.

Possible V2 re-add:

```text
one MCP tool: ask_pro(question, files?, dryRun?)
```

Do not carry the full upstream MCP surface.

## Remove Project Sources

Remove:

- ChatGPT Project Sources add/delete/sync/replace
- project-sources CLI flags
- MCP project source tools

Rationale: use ephemeral per-run `CONTEXT.zip` bundles.

## Remove Deep Research

Remove Deep Research browser mode for V1.

Possible future:

```bash
ask-pro --research "survey current backend migration tools"
```

But not V1.

## Remove TUI

Remove terminal UI code unless it is essential for session browsing.

Rationale: agents need a command, not an interactive terminal app.

## Remove remote browser server unless necessary

Remove `serve` / remote-host / remote-token complexity unless it is required by attach-running Chrome or tests.

Keep local browser automation and direct CDP attach support if merged.

## Collapse config

Target V1 config shape:

```json
{
  "browser": {
    "provider": "chatgpt",
    "model": "gpt-5.5-pro",
    "thinking": "deepest-compatible",
    "manualLogin": true,
    "attachRunningChrome": true,
    "timeoutMinutes": 180
  },
  "context": {
    "mode": "focused",
    "redaction": "strict",
    "maxZipBytes": 524288000
  },
  "output": {
    "preferResponseZip": true,
    "markdownFallback": true
  }
}
```

## Delete docs last

Code first, docs last.

After the build passes, rewrite docs around:

```text
ask-pro
$ask-pro
browser-backed ChatGPT Pro
manual auth gate
generated response zip
```
