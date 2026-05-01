# Merge / cherry-pick order

Do browser reliability first. Rip-outs come later.

## Suggested setup

```bash
git remote add upstream https://github.com/steipete/oracle.git
git fetch upstream
```

Fetch relevant PRs:

```bash
git fetch upstream pull/147/head:pr-147-gpt55-pro
git fetch upstream pull/146/head:pr-146-composer-pill
git fetch upstream pull/116/head:pr-116-attachment-readiness
git fetch upstream pull/117/head:pr-117-browser-stability
git fetch upstream pull/128/head:pr-128-placeholder-completion
git fetch upstream pull/148/head:pr-148-thinking-heartbeat
git fetch upstream pull/119/head:pr-119-attach-running-chrome
git fetch upstream pull/118/head:pr-118-localized-model-selection
git fetch upstream pull/139/head:pr-139-open-requested-url
git fetch upstream pull/136/head:pr-136-cookie-redaction
git fetch upstream pull/126/head:pr-126-harvest
git fetch upstream pull/150/head:pr-150-concurrent-tabs
```

## Recommended order

1. `#147` GPT-5.5 Pro browser support.
2. Fold `#146` if #147 lacks any composer-pill/thinking-effort fixes.
3. Fold `#118` if localized UI selection is not covered.
4. `#116` attachment readiness.
5. `#117` browser stability.
6. `#128` placeholder completion / long-thinking capture.
7. `#136` tmpdir/cookie redaction.
8. `#139` requested ChatGPT URL.
9. `#119` attach-running Chrome.
10. `#126` tab harvest/inspection.
11. `#148` thinking heartbeat.
12. `#150` optional concurrent-tab coordination.
13. Mine `#145` only for remaining browser-focus/auth/send-button fixes.

## Conflict strategy

For each PR:

```bash
git checkout -b integrate/pr-147
# attempt merge or cherry-pick
pnpm build
pnpm test -- --runInBand  # or project equivalent
```

If the repo uses `pnpm vitest`, prefer targeted browser tests after each browser PR:

```bash
pnpm vitest run tests/browser
pnpm vitest run tests/cli/browserConfig.test.ts tests/runOptions.test.ts tests/cli/options.test.ts
pnpm run build
```

## Do not delete before merging

Do not delete these areas until PR work is done:

- browser model selection
- browser actions
- attachment handling
- session store
- status/harvest code
- CLI option parser
- browser config/defaults tests

Deleting too early makes browser PRs much harder to apply.
