# Windows Work Notes

Read this when working on `ask_pro` from Windows and add new findings here.

- Prefer PowerShell plus `pnpm` directly.
- `ask-pro` stores project sessions under `.ask-pro/` and the persistent browser
  profile under
  `%CODEX_HOME%\state\ask-pro\browser-profile` (default
  `C:\Users\<you>\.codex\state\ask-pro\browser-profile`).
  Normal and concurrent agents use this shared profile without configuration.
  Set `ASK_PRO_AGENT_ID` only for an explicitly isolated agent profile under
  `%CODEX_HOME%\state\ask-pro\agents\<id>-<hash>\browser-profile`.
- The first run migrates an inactive legacy profile from
  `C:\Users\<you>\.agents\skills\ask-pro\`; active profiles and collisions fail
  closed. If a watcher denies the usual atomic rename or cleanup, ask-pro uses
  the verified state-path copy and preserves the exact legacy directory
  without later merging or deleting it.
- Cached plugin launches install, build, and execute under
  `%CODEX_HOME%\plugin-runtimes\ask-pro\<version>-<hash>\`, never in the
  installed plugin cache.
- Browser login is human-controlled. If ChatGPT asks for login, MFA, or a
  challenge, leave Chrome open and resume with `ask-pro --resume <session-id>`.
- Chrome DevTools state is recorded in each session's `browser.json`; use the
  saved port for DOM inspection when a live browser needs debugging.
- Concurrent fresh and resumed runs on one managed profile use PID-backed
  browser-run leases. A completed run closes only its tab while peers remain;
  the last live run owns Chrome shutdown, and later runs prune dead leases.
  Managed Chrome is launched through the Windows process service so this lease
  transfer survives the original controller job exiting. A detached direct
  child still belongs to the Codex command job and is terminated with it. The
  last lease requests Chrome's native graceful shutdown, waits up to 20 seconds,
  and force-terminates the process only if Chrome does not exit.
- Mutable session metadata retries transient Windows `EPERM` and `EBUSY`
  replacement failures before reporting an error.
- The GPT-5.6 ChatGPT picker exposes `GPT-5.6 Sol` under Advanced > Model and a
  five-step reasoning-effort slider with `Pro` at the maximum. ask-pro selects
  or confirms both before submission.
- Ordinary managed Chrome runs start minimized. First login, resume/recovery,
  stale auth, challenges, and retained debug sessions restore the browser for
  human-controlled recovery. Concurrent unattended runs preserve an already
  minimized shared window when opening their isolated tab; recovery runs
  serialize the same transition and leave it visible. Remote Chrome and explicit
  existing-tab runs are never parked.
- A visible `Answer now` and `Stop answering` control pair is the active Pro
  thinking gate. Report it as active status, but never click either control.
- The old Oracle API, MCP, Gemini, TUI, bridge, and remote-service paths are not
  V1 requirements in this fork.

Future Windows gotchas belong here.
