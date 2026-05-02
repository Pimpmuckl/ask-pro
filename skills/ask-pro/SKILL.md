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
5. Run the smallest useful command, usually `ask-pro --files "<glob>" "<prompt>"`.
   If `ask-pro` is not on `PATH`, run it from the source checkout instead:
   `cd C:/Code/ask-pro && npm exec --yes pnpm@10.33.2 -- start -- --files "<glob>" "<prompt>"`.
6. If auth is required, stop and ask the human to log in in the opened browser.
7. Resume or harvest as instructed by the CLI.
8. Treat the answer as advisory; turn it into your own plan before editing code.

By default, `ask-pro` uses normal Pro thinking effort. Add `--extended` only for
mega-hard architecture questions, production-risk reviews, or implementation
plan packages where a multi-hour wait is acceptable.

For parallel or role-specific agents, set a stable lowercase `ASK_PRO_AGENT_ID`
before running the CLI. Example: `ASK_PRO_AGENT_ID=review-t1 ask-pro ...`. Each
agent id gets an isolated persistent browser profile.

## Prompt Shape

Ask Pro to be direct, practical, and biased toward boring reliable choices. For implementation-heavy work, request:

- `IMPLEMENTATION_PLAN.md`
- `TASKS.json`
- `TEST_PLAN.md`
- `RISK_REGISTER.md`
- `FILES_TO_EDIT.md`

If useful, ask Pro to create `ask-pro-response.zip` with those files. Always support markdown fallback.

## Commands

```bash
ask-pro "Review the async billing webhook migration plan and return an implementation plan."
ask-pro --extended "Produce a deep implementation plan for this risky migration."
ask-pro --files "src/api/stripe/**" --files "prisma/**" --files "src/lib/billing/**" \
  "Review whether this Stripe webhook flow should use a queue or transactional outbox."
ask-pro --dry-run "Prepare the Pro handoff but do not open the browser."
ask-pro --resume <session-id>
ask-pro --harvest <session-id>
```

If the binary is not on `PATH`, use the source checkout fallback:

```bash
cd C:/Code/ask-pro
npm exec --yes pnpm@10.33.2 -- start -- "Review the async billing webhook migration plan."
```

## Safety

Never ask for, read, store, type, or log passwords, MFA codes, recovery codes, session cookies, or raw auth tokens.

Browser auth is human-controlled. Continue only after the human says the ChatGPT composer is visible.
