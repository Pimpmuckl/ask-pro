---
name: ask-pro
description: Escalate hard engineering questions to ChatGPT Pro through browser automation with focused repo context. Use when Codex needs a stronger external review, architecture plan, migration strategy, production-debugging second opinion, or when the user explicitly asks to use $ask-pro.
---

# $ask-pro

Use `$ask-pro` to ask ChatGPT Pro for a focused second opinion on hard engineering work.

The calling agent still owns the work. Use Pro for judgment, architecture, risk review, or implementation planning when the decision is consequential enough to justify a browser run.

## Trigger

Use this skill when the user explicitly asks for `$ask-pro`, or when a second opinion would materially reduce risk for:

- backend architecture
- schema or data migrations
- auth, sessions, permissions, or billing
- queues, workers, idempotency, caching, scaling, or latency
- production debugging and observability
- ambiguous implementation paths where a second opinion would reduce risk

Do not use it for trivial syntax fixes, formatting, obvious dependency updates, or small bugs with a clear cause.

## Workflow

When invoked:

1. Inspect the repo and the relevant files.
2. Identify the exact decision Pro should answer.
3. Choose a small, high-signal file bundle with `--files`.
4. Write the prompt yourself; include constraints, what you inspected, the files attached, options considered, and the output you need.
5. Run the smallest useful command, usually
   `ask-pro --no-temporary --files "<glob>" "<prompt>"` for repo advisories.
   For multiline prompts, write a temporary prompt file and use
   `ask-pro --no-temporary --prompt-file <path> --files "<glob>"`; do not rely
   on shell multiline quoting.
   If `ask-pro` is not on `PATH`, run the cached plugin runner instead of the
   mutable development checkout:
   `node "$env:USERPROFILE/.codex/plugins/cache/jonat-local/ask-pro/local/scripts/run-cached-cli.mjs" -- --cwd <target-repo-root> --no-temporary --prompt-file <path> --files "<repo-relative-glob>"`.
6. If auth is required, stop and ask the human to log in in the opened browser.
7. Read the CLI's compact `ask_pro` record and run the emitted `resume` or
   `harvest` command when that is the next action.
8. Treat the answer as advisory; turn it into your own plan before editing code.

By default, `ask-pro` uses normal Pro thinking effort. Add `--extended` only for
mega-hard architecture questions, production-risk reviews, or implementation
plan packages where a multi-hour wait is acceptable.
If ChatGPT labels the row simply as `Pro`, that is accepted as the current Pro
target; do not require a specific dated model label in the prompt or workflow.

Fresh runs try ChatGPT Temporary Chat by default and automatically fall back to
normal ChatGPT if the current account/UI does not expose Pro there. For repo
advisories, large bundles, review rounds, or anything where recovery matters,
prefer `--no-temporary` from the start. Add `--temporary` only when Temporary
Chat is required and falling back would be wrong. Temporary Chat is less
recoverable after browser/tab loss.

Do not set `ASK_PRO_AGENT_ID` for ordinary single-agent use; the shared
`ask-pro` browser profile is already persistent. Set `ASK_PRO_AGENT_ID` only
when separate agents truly need isolated browser profiles, such as concurrent
review lanes. Use a stable reusable lowercase id like `review-t1`, not a
one-off task slug, because each new id creates a new Chrome profile and may
require the human to log in again. Example:
`ASK_PRO_AGENT_ID=review-t1 ask-pro ...`.

## Prompt Shape

Ask Pro to be direct, practical, and biased toward boring reliable choices.
Keep advisory design consults as plain answer requests. Start advisory prompts
with:

```text
Return final markdown only. Do not answer with a preamble. Do not produce an implementation package. Rank findings by severity. Treat attached bundle as authoritative. Call out uncertainty.
```

For implementation-heavy work, explicitly request:

- `IMPLEMENTATION_PLAN.md`
- `TASKS.json`
- `TEST_PLAN.md`
- `RISK_REGISTER.md`
- `FILES_TO_EDIT.md`

If useful, ask Pro to create `ask-pro-response.zip` with those files. Always support markdown fallback. The wrapper does not request a zip by default.
Pass `--artifacts` only for implementation-package prompts. Keep advisory consults inline by default.
Keep bundles focused: source files under review, focused tests, relevant docs,
known recent changes, and validation status. Avoid whole-repo bundles unless the
question is explicitly architectural.

## Output

Normal `ask-pro` stdout is compact TOON-style telemetry. Use `state`, `action`,
`resume`, and `harvest` to decide the next command. Browser progress may appear
on stderr and can be ignored unless diagnosing a stuck run.

When present, use `profile`, `profile_path`, `chrome`, and `language` only as
diagnostic hints. They tell you whether the run used the shared profile, an
isolated agent profile, saved DevTools state, and English browser steering.
When present, `conversation_url` is a recoverable non-temporary ChatGPT
conversation URL.

`ask-pro --harvest <session-id>` prints the raw markdown answer. If ChatGPT also
provided `ask-pro-response.zip`, files are extracted under the session's
`pro-output/` directory and described in `PRO_OUTPUT_MANIFEST.json`.

`COMPLETED` means harvest now; the run browser may already be closed. If the
state is `INCOMPLETE_ANSWER` / `preamble_without_artifacts`, do not treat
`ANSWER.md` as final. Try resume/harvest if recoverable; otherwise rerun with
`--no-temporary`, a tighter bundle, and a more direct prompt.

## Commands

```bash
ask-pro "Review the async billing webhook migration plan and return an implementation plan."
ask-pro --no-temporary --prompt-file question.md --files src --files tests
ask-pro --extended "Produce a deep implementation plan for this risky migration."
ask-pro --temporary "Review this sensitive migration plan, and fail if Temporary Chat cannot use Pro."
ask-pro --no-temporary "Review this in normal ChatGPT instead of Temporary Chat."
ask-pro --prompt-file question.md --files .\src
ask-pro --artifacts --prompt-file implementation-plan.md --files src
ask-pro --files "src/api/stripe/**" --files "prisma/**" --files "src/lib/billing/**" \
  "Review whether this Stripe webhook flow should use a queue or transactional outbox."
ask-pro --dry-run "Prepare the Pro handoff but do not open the browser."
ask-pro --resume <session-id>
ask-pro --harvest <session-id>
```

If the binary is not on `PATH`, use the cached plugin runner. Do not run from
`C:/Code/ask-pro`; that is the mutable development checkout and may contain
in-flight changes that have not been synced for agents.

```bash
node "$env:USERPROFILE/.codex/plugins/cache/jonat-local/ask-pro/local/scripts/run-cached-cli.mjs" -- --cwd C:/Code/jjagentskills --no-temporary --prompt-file question.md --files plugins/review-suite
```

In cached-runner fallback mode, `--files` must be inside `--cwd`. Use
repo-relative `--files`; do not point at files outside the target repo cwd.

## Safety

Never ask for, read, store, type, or log passwords, MFA codes, recovery codes, session cookies, or raw auth tokens.

Browser auth is human-controlled. Continue only after the human says the ChatGPT composer is visible.

After submit, do not interact with the Chrome run window while Pro is thinking.
ChatGPT may focus its stop control, and human input can cancel the response.
