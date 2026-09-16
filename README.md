# ZYRAXON Code

[![License](https://img.shields.io/github/license/onelpawarai-X/Zyraxon-Code.svg)](https://github.com/onelpawarai-X/Zyraxon-Code/blob/main/LICENSE.txt)
[![GitHub issues](https://img.shields.io/github/issues/onelpawarai-X/Zyraxon-Code.svg)](https://github.com/onelpawarai-X/Zyraxon-Code/issues)
[![GitHub pull requests](https://img.shields.io/github/issues-pr/onelpawarai-X/Zyraxon-Code.svg)](https://github.com/onelpawarai-X/Zyraxon-Code/pulls)

**ZYRAXON Code** is an AI-first code editor built on the open-source ZYRAXON Code engine — but with a soul. It ships with the **Zyraxon AI Assistant** built in: 9 powerful AI modes, a local OpenCode-compatible bridge, and a free unlimited model catalog that works **without any login, API key, or credit card**.

## The Zyraxon AI Assistant

ZYRAXON Code is not just an editor — it is the desktop companion to the Zyraxon AI ecosystem. Press `Ctrl+Alt+A` (or open the Zyraxon chat panel) and talk to your code.

### 9 AI Modes — one prompt file per mode

Every mode has its own persona prompt file, loaded from `resources/zyraxon/prompts/` and injected as the system message on every chat request:

| Mode | Purpose |
|------|---------|
| `auto` | AUTO ORCHESTRATOR — automatic task handling and routing |
| `build` | BUILD MODE — fast, focused implementation and fixes |
| `plan` | PLAN MODE — design first, architect before coding |
| `beast` | BEAST MODE — heavy-lifting, large-context deep work |
| `pro` | PRO MODE — professional-grade full-stack work |
| `apex` | APEX PREDATOR — predictive, self-synthesizing intelligence |
| `dark-emperor` | DARK EMPEROR — maximum capability, no limits |
| `pro-builder` | PRO BUILDER — production-ready engineering |
| `vision` | VISION MODE — image/vision-guided assistance |

Switch modes anytime from the Zyraxon chat panel, the `zyraxon.mode` setting, or the command palette (**Zyraxon: Switch Mode**).

### Free, unlimited, no login required

- The **OpenCode family of models** (opencode provider, model prefix `opencode/`) is used from the **Zyraxon model catalog** — a built-in, always-updated JSON list of free models (`zyraxon.ai.openAIModelCatalogBaseUrl`). No account, no key, no billing.
- **Login is fully optional.** The chat bridge (`http://127.0.0.1:4096`, vendor `opencode`) is local and login-free by default. You can sign in with your GitHub/Copilot account if you want, but you never have to.
- **Bring your own key:** OpenAI, Anthropic, Google, Groq, and OpenRouter providers are preconfigured under `zyraxon.ai.providers`. Paste a key into the **Zyraxon: Settings** view and your key is stored locally (Electron `safeStorage`), never sent to Zyraxon servers.
- Toggle the free catalog on/off with the `zyraxon.ai.enableFreeModels` setting.

## The Repository

This repository is where Zyraxon develops ZYRAXON Code together with the community. This is a from-scratch fork of the ZYRAXON Code engine — every piece of it is real, reviewable code. The repo includes:

- the **full editor engine** (`src/vs/`) — no black boxes,
- the **Zyraxon bridge** (`src/vs/workbench/contrib/chat/browser/zyraxonBridge/`) — connects the editor to local and remote AI endpoints,
- the **9 Zyraxon mode prompt files** (`resources/zyraxon/prompts/`),
- the **Zyraxon AI provider catalog & settings** (`src/vs/workbench/contrib/zyraxon/`),
- a **bundled ZYRAXON Code extension gallery** config so you can install thousands of community extensions right from the editor,
- **packaging for Windows (NSIS installers), macOS, and Linux** with GitHub Actions.

## Getting Started

### Download

Grab the latest installer from the [Releases](https://github.com/onelpawarai-X/Zyraxon-Code/releases) page:

- `ZYRAXON-Code-Setup-<version>.exe` — Windows NSIS installer
- `.dmg` / `.zip` — macOS
- `.deb` / `.rpm` / `.tar.gz` — Linux

### Quick Build (One Command Per Platform)

```bash
git clone https://github.com/onelpawarai-X/Zyraxon-Code.git
cd Zyraxon-Code

npm run build:win       # Windows x64
npm run build:linux     # Linux x64
npm run build:mac       # macOS Apple Silicon
npm run build:mac-x64   # macOS Intel
npm run build:win-arm64 # Windows ARM64
npm run build:linux-arm64 # Linux ARM64
```

> Each command does everything: `npm install` → `postinstall` → `compile` → `gulp package`.

### Step-by-Step Build

```bash
# Step 1: Install dependencies (with lifecycle scripts)
npm install

# Step 2: Run postinstall (installs deps for all extensions)
node build/npm/postinstall.ts

# Step 3: Compile TypeScript + esbuild
npm run compile

# Step 4: Package for your platform
npm run package:win          # Windows x64
npm run package:linux        # Linux x64
npm run package:mac          # macOS ARM64
npm run package:mac-x64      # macOS Intel
npm run package:win-arm64    # Windows ARM64
npm run package:linux-arm64  # Linux ARM64
```

### Prerequisites

- **[Node.js](https://nodejs.org/)** 22+ (required for compilation and native modules)
- **[npm](https://www.npmjs.com/)** — comes with Node.js (**do NOT use bun**; the ZYRAXON Code engine requires npm lifecycle scripts)

> The packaged application lands at `../ZYRAXON-code-{platform}-{arch}/` (one directory up from the repo root).

## Features

- **AI chat with 9 modes** — plain language editing, explaining, fixing, and automating your code.
- **Full editor engine** — IntelliSense, debugging, git integration, remote dev, terminals, and everything else you expect from a ZYRAXON Code-derived editor.
- **Extension marketplace** — the editor ships with gallery endpoints configured, so you can install thousands of community extensions directly.
- **Multi-provider AI** — free OpenCode models by default, plus OpenAI/Anthropic/Google/Groq/OpenRouter keys whenever you need them.
- **Local-first, privacy-respecting** — prompts and keys never leave your machine unless you choose a cloud model.

## Screenshots & Docs

Visit the Zyraxon AI website at [zyraxonai.lovable.app](https://zyraxonai.lovable.app) for screenshots, the changelog, and the blog.

## Contributing

We welcome contributions!

* [Submit bugs and feature requests](https://github.com/onelpawarai-X/Zyraxon-Code/issues), and help us verify them as they are checked in
* Review [source code changes](https://github.com/onelpawarai-X/Zyraxon-Code/pulls)
* Discuss ideas in [GitHub Discussions](https://github.com/onelpawarai-X/Zyraxon-Code/discussions)

See [How to Contribute](CONTRIBUTING.md) for the development workflow, debugging, running tests, coding guidelines, and submitting pull requests.

## Feedback

* [Request a new feature](CONTRIBUTING.md)
* [File an issue](https://github.com/onelpawarai-X/Zyraxon-Code/issues)
* Follow [@zyraxon](https://x.com/zyraxon) and let us know what you think!

## Related Projects

- **[ZYRAXON AI (main app)](https://github.com/onelpawarai-X/ZYRAXON-AI)** — the full Zyraxon AI assistant platform
- **[zyraxonai-website](https://github.com/onelpawarai-X/zyraxonai-website)** — the Zyraxon AI website and ecosystem store

## Code of Conduct

This project has adopted the [Zyraxon Open Source Code of Conduct](https://github.com/onelpawarai-X/Zyraxon-Code/blob/main/CODE_OF_CONDUCT.md). For questions or comments, contact [opencode@zyraxon.ai](mailto:opencode@zyraxon.ai).

## License

Copyright (c) 2026 onelpawarai ("Licensor"). All rights reserved.

ZYRAXON Code is licensed under the [Zyraxon Sovereign License — X Edition](LICENSE) (ZSL-X). **Build Without Limits. Respect the Origin.** This license is an original grant of rights; it does not incorporate or reference any third-party open-source license unless explicitly stated in an accompanying NOTICE file. A plain-language summary is available in [LICENSE.txt](LICENSE.txt).

For licensing questions, contact the Licensor via the repository Issues page.

## Third-Party Components

ZYRAXON Code is built on top of the open-source ZYRAXON Code engine and other upstream open-source projects. Those upstream works remain licensed under their own respective licenses (MIT, BSD-3-Clause, Apache-2.0, etc.), which are reproduced on a best-effort basis in the repository as required by those licenses. ZSL-X governs only ZYRAXON Code's own original code and branding; it does not relicense upstream components.
