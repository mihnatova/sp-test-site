# Installation-detection harnesses

Two scripts that reproduce the backend's script-installation check locally, so the detection
behaviour can be measured without a test-v2 account. Written for ADO #8667.

Both need `playwright`. Point `PLAYWRIGHT` at a checkout that already has it:

```bash
export PLAYWRIGHT=~/secure-privacy-web-v2/e2e/node_modules/playwright/index.mjs
node tools/detect-harness.mjs
node tools/bisect-browserless-cutoff.mjs
```

### `detect-harness.mjs`

Runs every fixture under `test/installation/` through a port of the two backend passes:

- **pass 1** — plain HTTP GET with the backend's IE10 user-agent, then `ScriptDetector.CheckScript`
- **pass 2** — headless render, then `ScriptDetector.CheckScriptBrowserless`

It reports which detector *branch* fired, not just the verdict, and whether pass 2 was reached at
all — the backend only runs browserless when pass 1 returned `NotInstalled`.

### `bisect-browserless-cutoff.mjs`

Serves a local page that injects the SP tag after a configurable delay and walks the delay upwards
to find where detection stops working. It implements Puppeteer's `networkidle2` (at most two
in-flight requests for 500 ms) rather than Playwright's stricter `networkidle`, to match what
browserless actually waits for.
