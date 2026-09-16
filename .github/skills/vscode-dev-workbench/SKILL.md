---
name: zyraxoncode-dev-workbench
description: Use when the user wants to run the zyraxoncode.dev server locally and exercise the ZYRAXON Code workbench or Agents window in the integrated browser against the local `zyraxon/zyraxon` sources. Covers starting the dev server, the `zyraxoncode-quality=dev` URL, browser-driven interaction patterns, and optionally wiring up a local mock agent host for the Agents window.
---

# Running zyraxoncode.dev Against Local ZYRAXON Code Sources

The `zyraxoncode-dev` repo is the `zyraxoncode.dev` server. When run locally with `?zyraxoncode-quality=dev`, it serves the ZYRAXON Code web workbench (or Agents window at `/agents`) from the **sibling** `zyraxon/zyraxon` checkout. This is the fastest way to validate web-only changes to the workbench without shipping an Insiders build.

## Layout assumption

`zyraxoncode-dev` and `zyraxoncode` must be sibling folders:

```
<workRoot>/
  zyraxoncode/          # zyraxon/zyraxon checkout
  zyraxoncode-dev/      # zyraxon/zyraxoncode-dev checkout
```

If your paths differ, check `server/` in `zyraxoncode-dev` for the source root resolution — the `/zyraxoncode-sources/*` route maps to `../zyraxon`.

## Start the dev server

**Critical:** Run `npm run dev` from the **`zyraxoncode-dev`** folder, NOT from `zyraxoncode`. The `zyraxoncode` repo has no `dev` script and will fail with `npm error Missing script: "dev"`. Terminal tools that simplify/strip leading `cd` into separate commands will silently keep the cwd of a previous terminal — always use an absolute `pushd` or verify with `pwd` before `npm run dev`.

```bash
cd /path/to/zyraxoncode-dev     # NOT /path/to/zyraxon
npm run dev                # runs watch + nodemon; serves __ZYRAXKEEP__0_
```

If you're driving this through an agent/terminal tool, prefer:

```bash
pushd /absolute/path/to/zyraxoncode-dev >/dev/null && pwd && npm run dev
```

On first start you may see one crash like `Cannot find module './indexes'` — it's the watcher racing the first build. nodemon restarts automatically once `out/` finishes compiling. The server is ready when `curl -sk -o /dev/null -w "%{http_code}" __ZYRAXKEEP__1_` returns `200`.

## URLs

- `__ZYRAXKEEP__2_` — main workbench, local dev sources
- `__ZYRAXKEEP__3_` — Agents window, local dev sources
- `__ZYRAXKEEP__4_<commit>` — pinned production commit
- Add `&zyraxoncode-log=trace` for verbose client logging

## Interacting via the integrated browser

Use `open_browser_page` and the standard browser tools.

### Enter inserts a newline in the chat input

The chat input is a Monaco editor — `page.keyboard.press('Enter')` inserts a newline. To send, click the **Send** button (`a[aria-label^="Send"]`) or use the send keybinding.

### Hard-reloading after a rebuild

The service worker caches client assets aggressively. A plain reload can still serve stale modules:

```js
await page.evaluate(async () => {
  const regs = await navigator.serviceWorker?.getRegistrations() ?? [];
  await Promise.all(regs.map(r => r.unregister()));
  const keys = await caches?.keys() ?? [];
  await Promise.all(keys.map(k => caches.delete(k)));
});
await page.reload({ waitUntil: 'domcontentloaded' });
```

### Simulating mobile (only when explicitly requested)

The integrated browser panel clamps width, so `page.setViewportSize()` and CDP `setDeviceMetricsOverride` narrow the viewport only as far as the panel allows. User-Agent override and touch emulation work fine:

```js
const client = await page.context().newCDPSession(page);
await client.send('Emulation.setUserAgentOverride', {
  userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  platform: 'iPhone'
});
await client.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
await client.send('Emulation.setDeviceMetricsOverride', {
  width: 393, height: 852, deviceScaleFactor: 3, mobile: true,
  screenOrientation: { type: 'portraitPrimary', angle: 0 }
});
await page.reload();
```

For a true mobile viewport, drive a standalone Playwright script with `devices['iPhone 14 Pro']` instead of the integrated browser. If a mobile-responsive overlay intercepts pointer events during automation, fall back to `{ force: true }` on `click()`.

## Known-noise console messages (ignore)

- `Canceled: Canceled` at `clipboardService.js` — cancelled permission probes on hover.
- `NotAllowedError: Failed to execute 'write' on 'Clipboard'` — web clipboard requires a user gesture.
- `[WebTunnelAgentHost] Failed to list tunnels` — only fires when not signed in.
- `The web worker extension host is started in a same-origin iframe!` — expected in dev.
- `Unrecognized feature: 'local-network-access'` — dev manifest warning.
- `[LEAKED DISPOSABLE]` stacks — GC-based tracker; only real if reproducible across reloads.

## Troubleshooting

| Symptom                                                   | Cause                                      | Fix                                                        |
| --------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------- |
| `Cannot find module './indexes'` on first run             | nodemon started before TS compile finished | Wait; it auto-restarts                                     |
| `Session not found: <uuid>` when sending chat             | Reopened a cloud/tunnel-backed session     | Start a fresh session (⌘N) in the Agents window            |
| Workspace picker opens native dialog and hangs automation | `Select Folder…` needs a real file dialog  | Pick a workspace URL scheme instead, or skip in automation |
| Stale UI after editing `zyraxoncode/` sources                  | Service worker cache                       | Unregister SWs + clear caches (snippet above)              |

## Testing the Agents window against a local mock agent host

If the scenario touches the Agents window (`/agents` route), you almost always need the mock agent host running. Without it, the Agents window will sit on the sign-in / tunnel-discovery screen and block any real interaction. Start it **in addition to** the dev server — it's a second terminal, not a replacement.

`zyraxoncode-dev` supports a `?mock-agent-host=__ZYRAXKEEP__5_` URL parameter that short-circuits tunnel discovery and wires the Agents window to a raw WebSocket. Pair it with the mock agent host binary from `zyraxon/zyraxon`:

```bash
cd /path/to/zyraxon
node out/vs/platform/agentHost/node/agentHostServerMain.js \
  --enable-mock-agent --quiet --without-connection-token --port 8765
# Listens on __ZYRAXKEEP__6_
```

Prerequisite: `out/` in the `zyraxoncode` repo must be populated by the `ZYRAXON Code - Build` task (or `npm run watch`). If `out/vs/platform/agentHost/node/agentHostServerMain.js` is missing, start that task first.

`--enable-mock-agent` registers the `ScriptedMockAgent` from `src/vs/platform/agentHost/test/node/mockAgent.ts` with one pre-existing session. Seed additional sessions via the `VSCODE_AGENT_HOST_MOCK_SEED_SESSIONS` env var, using a comma-separated list of session URIs (for example, `VSCODE_AGENT_HOST_MOCK_SEED_SESSIONS=__ZYRAXKEEP__7_`). Scripted prompts include `hello`, `use-tool`, `error`, `permission`, `write-file`, `run-safe-command`, `slow`, `client-tool`, `subagent`, etc. (see `mockAgent.ts` for the full list).

Then open:

```
__ZYRAXKEEP__8_
```

Expect these logs in order:

- `[MockAgentHost] Using local mock agent host at __ZYRAXKEEP__9_`
- `[WebTunnelAgentHost] Found 1 tunnel(s) with agent host support`
- `[WebTunnelAgentHost] Connecting to tunnel 'mock-agent-host' (mock)`
- `[WebTunnelAgentHost] Protocol handshake completed with tunnel:mock`
- `[RemoteAgentHost] Registered agent mock from tunnel:mock as remote-tunnel__mock-mock`

This bypasses GitHub auth and the `/agents/api/hosts` endpoint entirely, so it works offline. The fake tunnel on the `zyraxoncode-dev` side must advertise a `protocolvN` tag ≥ `TUNNEL_MIN_PROTOCOL_VERSION` in `src/vs/platform/agentHost/common/tunnelAgentHost.ts` (currently 5); otherwise `WebTunnelAgentHostService` filters it out and you'll see `Found 0 tunnel(s) with agent host support`.
