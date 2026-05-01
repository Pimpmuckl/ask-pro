# $ask-pro

Use `$ask-pro` to escalate hard engineering questions to ChatGPT Pro through browser automation.

The purpose is not to replace the coding agent. The purpose is to get a stronger external review/plan when the current agent is about to make a high-risk or high-judgment decision.

## When to use

Use `$ask-pro` for hard questions involving:

- backend architecture
- database design or migrations
- auth/session/security flows
- payment/billing systems
- queues, workers, distributed jobs, idempotency
- caching, scaling, latency, capacity
- observability and production incident debugging
- large refactors with architectural tradeoffs
- ambiguous implementation paths where a second opinion would reduce risk
- anything the user explicitly asks to run through `$ask-pro`

## When not to use

Do not use `$ask-pro` for:

- trivial syntax fixes
- one-file formatting changes
- obvious dependency updates
- small bug fixes with clear cause
- tasks where the user explicitly wants speed and no escalation

## Required workflow

When invoked:

1. Inspect the repo and the relevant files.
2. Identify the exact question or decision.
3. Select a focused context bundle.
4. Write the prompt yourself.
5. Ask for a concise answer and, when useful, a downloadable `ask-pro-response.zip` implementation bundle.
6. Run `ask-pro` with minimal flags.
7. If auth is required, stop and ask the human to authenticate.
8. Resume/harvest when the browser run completes.
9. Convert the harvested answer or zip into an implementation plan before editing code.

## Prompt rubric

The prompt should include:

- what you are trying to build/fix
- the exact decision you need help with
- the stack and constraints
- what you inspected
- what files are attached and why
- options you are considering
- what you want Pro to produce
- how the implementation agent should use the answer

The prompt should ask Pro to be direct and practical. Prefer boring, reliable implementation choices over cleverness.

## Implementation zip request

For implementation-heavy work, include this in the prompt:

```text
If file generation is available, also create a downloadable zip named ask-pro-response.zip. It should contain IMPLEMENTATION_PLAN.md, TASKS.json, TEST_PLAN.md, RISK_REGISTER.md, FILES_TO_EDIT.md, and any optional patch/diff files. If you cannot create a zip, return the same content in markdown sections.
```

Do not rely on the zip being available. Always support markdown fallback.

## CLI examples

Normal:

```bash
ask-pro "Review the async billing webhook migration plan and return an implementation plan."
```

With explicit files:

```bash
ask-pro --files "src/api/stripe/**" --files "prisma/**" --files "src/lib/billing/**" \
  "Review whether this Stripe webhook flow should use a queue or transactional outbox."
```

Dry run:

```bash
ask-pro --dry-run "Prepare the Pro handoff but do not open the browser."
```

Resume:

```bash
ask-pro --resume <session-id>
```

Harvest:

```bash
ask-pro --harvest <session-id>
```

## Credential safety

Never ask for, read, store, or type the human's password, MFA code, session cookie, or recovery code.

If ChatGPT needs auth, ask the human to log in in the opened browser. Continue only after the composer is visible.
