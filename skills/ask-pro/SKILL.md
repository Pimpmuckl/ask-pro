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

## Critical Reminders

- Remember: ask-pro has ZERO context. It knows NOTHING. So your prompt and
  context file need to include absolutely everything that's relevant. It does
  not magically know anything you know.
- Long waits are normal. ask-pro can take a super long time to run; do not
  close or kill the browser window/run until at least 3 hours have passed unless
  the CLI has completed, failed, or explicitly asks for human action.

## Workflow

When invoked:

1. Inspect the repo and the relevant files.
2. Identify the exact decision Pro should answer.
3. Choose a small, high-signal file bundle with `--files`.
4. Write the prompt yourself. Treat ChatGPT Pro as a cold oracle: it does not
   know who the user is, what this repo does, what decisions were made earlier,
   or any context that is not in your prompt or attached files. Include more
   background than feels strictly necessary: the product goal, current state,
   constraints, what you inspected, files attached, options considered, and the
   exact output you need.
5. Run the smallest useful command, usually
   `ask-pro --no-temporary --files "<glob>" "<prompt>"` for repo advisories.
   For multiline prompts, write a temporary prompt file and use
   `ask-pro --no-temporary --prompt-file <path> --files "<glob>"`; do not rely
   on shell multiline quoting.
   If `ask-pro` is not on `PATH`, run the cached plugin runner instead of the
   mutable development checkout. Locate it under the installed plugin cache,
   usually
   `~/.codex/plugins/cache/<marketplace-name>/ask-pro/<version>/scripts/run-cached-cli.mjs`,
   then call it with:
   `node <cached-runner> -- --cwd <target-repo-root> --no-temporary --prompt-file <path> --files "<repo-relative-glob>"`.
   On Git marketplace installs, the first cached-runner call may bootstrap the
   cache by installing dependencies and building `dist`; wait for that to finish.
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

On Windows, fresh runs for a managed Chrome profile start minimized after
ask-pro has recorded that profile as auth-ready from a completed run. First
login, resume/recovery, and stale-auth paths stay visible or are restored for
human action. Local managed Chrome guards browser input while Pro is answering.
If login, MFA, a browser challenge, or incomplete-answer debugging needs human
attention, ask-pro should restore or retain the browser and emit the next
action.

Do not set `ASK_PRO_AGENT_ID` for ordinary single-agent use; the shared
`ask-pro` browser profile is already persistent. Set `ASK_PRO_AGENT_ID` only
when separate agents truly need isolated browser profiles, such as concurrent
review lanes. Use a stable reusable lowercase id like `review-t1`, not a
one-off task slug, because each new id creates a new Chrome profile and may
require the human to log in again. Example:
`ASK_PRO_AGENT_ID=review-t1 ask-pro ...`.

## Prompt Shape

Ask Pro to be direct, practical, and biased toward boring reliable choices.
Assume it starts with zero local memory. Do not rely on Codex thread context,
repo folklore, prior ask-pro runs, branch names, or unstated user preferences.
Put the essential context in the prompt even when it feels obvious.
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

`ask-pro --harvest <session-id>` prints the raw markdown answer only for
answer-bearing states such as `COMPLETED` or `HARVESTED`.
For pending/incomplete sessions it prints compact status/action instead. For
sessions run with `--artifacts`, any provided `ask-pro-response.zip` is
extracted under the session's `pro-output/` directory and described in
`PRO_OUTPUT_MANIFEST.json`. Inline-default sessions should not expect a zip.

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

If the binary is not on `PATH`, use the cached plugin runner. Do not run from a
mutable development checkout; it may contain in-flight changes that have not
been synced for agents.

```bash
node <cached-runner> -- --cwd /path/to/repo --no-temporary --prompt-file question.md --files src
```

In cached-runner fallback mode, `--files` must be inside `--cwd`. Use
repo-relative `--files`; do not point at files outside the target repo cwd.

## Safety

Never ask for, read, store, type, or log passwords, MFA codes, recovery codes, session cookies, or raw auth tokens.

Browser auth is human-controlled. Continue only after the human says the ChatGPT composer is visible.

After submit, avoid interacting with any retained Chrome run window while Pro is
thinking. ask-pro guards input after submit, but the safest agent behavior is to
let the run finish or resume/harvest from CLI telemetry.
