# Windows browser cookies

Oracle reads Chrome cookies via `@steipete/sweet-cookie` (uses `node:sqlite` + PowerShell DPAPI on Windows).

Notes:
- ChatGPT cookies may be app-bound (`v20`) and can still fail to decrypt depending on the machine/account.
- Default recommendation on Windows remains `--browser-manual-login` (persistent profile) or inline cookies.
- For Gemini web mode, you must be signed into `gemini.google.com` in Chrome (requires `__Secure-1PSID` + `__Secure-1PSIDTS`).
- Gemini missing-cookie errors now include cookie-reader warnings so app-bound-cookie and SQLite/BigInt failures surface the relevant manual-login or inline-cookie workaround.
