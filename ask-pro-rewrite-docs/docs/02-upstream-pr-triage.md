# Upstream PR triage

Checked: 2026-05-01.

Source repo: `https://github.com/steipete/oracle`

The upstream PR page showed 21 open PRs and 79 closed PRs at the time of this kit refresh.

## Must merge or cherry-pick before deletion

### #147 — GPT-5.5 Pro browser support

URL: https://github.com/steipete/oracle/pull/147

Priority: critical.

Why:

- adds ChatGPT browser labels/aliases for `gpt-5.5-pro` and `gpt-5.5`
- defaults browser-mode runs to Pro while keeping API defaults conservative
- keeps GPT-5.5 Pro browser/subscription-backed only
- includes current composer/model-picker DOM updates from #146
- supports visible labels such as `Pro Extended` and `Thinking Heavy`

Action: merge or cherry-pick first. Prefer this over wholesale #145/#141.

### #146 — composer-pill DOM rewrite

URL: https://github.com/steipete/oracle/pull/146

Priority: critical if not fully covered by #147.

Why:

- restores browser mode after ChatGPT composer rewrite
- adds support for the new `__composer-pill` selector
- moves thinking-effort handling into the model menu
- avoids killing Pro consults when effort selection is unavailable

Action: fold if #147 does not include all selector fixes.

### #116 — attachment upload/send readiness

URL: https://github.com/steipete/oracle/pull/116

Priority: critical.

Why:

- our flow relies on uploading repo context bundles
- fixes attachment completion vs send-readiness race
- prevents attachment submissions from degrading into plain Enter fallback

Action: merge or cherry-pick early.

### #117 — browser stability hardening

URL: https://github.com/steipete/oracle/pull/117

Priority: high.

Why:

- hardens prompt submission
- supports stdin prompt input
- detects dead composers
- uses controlled reload retry
- captures response from expected ChatGPT conversation instead of stale turns

Action: merge/cherry-pick after selector fixes.

### #128 — avoid premature completion on placeholder turns

URL: https://github.com/steipete/oracle/pull/128

Priority: high.

Why:

- prevents long thinking/reasoning placeholder text from being treated as final answer
- scans all assistant content blocks in latest turn
- important for long Pro runs

Action: cherry-pick useful commits even though PR is closed.

### #148 — thinking heartbeat

URL: https://github.com/steipete/oracle/pull/148

Priority: high.

Why:

- long Pro browser runs look idle
- exposes safe liveness metadata without logging reasoning text
- useful for 3h wait budget and agent status updates

Action: merge after core browser run path works.

### #119 — attach to running Chrome via direct CDP

URL: https://github.com/steipete/oracle/pull/119

Priority: high.

Why:

- lets the tool attach to the user's existing signed-in browser session
- aligns with the `$ask-pro` auth-gate model
- reduces stale automation-profile cookie problems

Action: merge after selector fixes and auth gate are understood.

### #118 — localized UI model selection

URL: https://github.com/steipete/oracle/pull/118

Priority: medium-high.

Why:

- model selection must survive non-English ChatGPT UIs
- useful for European/localized environments

Action: fold into selector layer if not superseded by #147.

### #139 — open requested ChatGPT URL

URL: https://github.com/steipete/oracle/pull/139

Priority: medium-high.

Why:

- supports opening a dedicated ChatGPT project/chat URL immediately
- useful because Temporary Chat may conflict with Pro picker behavior

Action: merge.

### #136 — tmpdir and cookie redaction

URL: https://github.com/steipete/oracle/pull/136

Priority: medium-high.

Why:

- redacts inline cookies in debug logs
- improves Linux temp profile behavior

Action: merge.

### #126 — browser tab harvest and inspection

URL: https://github.com/steipete/oracle/pull/126

Priority: high.

Why:

- adds live ChatGPT tab inspection
- adds `status --browser-tabs`
- adds session harvest/live tail commands
- writes harvested output to disk

Action: merge or cherry-pick. This is a key part of answer ingestion.

### #150 — coordinate concurrent ChatGPT tabs

URL: https://github.com/steipete/oracle/pull/150

Priority: optional for V1, useful for V2.

Why:

- prevents multiple agent runs from colliding in the same browser profile
- useful once agents can kick off long Pro runs concurrently

Action: either merge or hardcode max concurrency = 1 for V1.

## Mine, but do not merge wholesale

### #145 — update Oracle defaults for GPT-5.5

URL: https://github.com/steipete/oracle/pull/145

Priority: selected commits only.

Why not wholesale:

- too broad for `ask_pro`
- touches API defaults and docs we plan to delete

Useful pieces:

- browser auth/focus improvements
- send button retry improvements
- model picker direction if not already in #147/#146/#117

## Skip for V1

- #149 — MCP/Claude Code ChatGPT browser consults. Skip because V1 removes MCP.
- #137 — MCP double-start fix. Skip if MCP is deleted.
- #132 — ChatGPT Project Sources. Skip because we want ephemeral context bundles.
- #140 — native ChatGPT image download. Skip; not relevant.
- #151 / #112 — Deep Research browser mode. Skip V1.
- #141 / #122 — skip or mine only if selector labels are not handled by #147/#146/#128.
- #120 — skip unless dependency hygiene is desired after core work.
