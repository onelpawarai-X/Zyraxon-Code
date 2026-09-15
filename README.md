# ZYRAXON Code - Open Source ("ZYRAXON Code")
[![Feature Requests](https://img.shields.io/github/issues/onelpawarai/zyraxon-code/feature-request.svg)](https://github.com/onelpawarai/zyraxon-code/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
[![Bugs](https://img.shields.io/github/issues/onelpawarai/zyraxon-code/bug.svg)](https://github.com/onelpawarai/zyraxon-code/issues?utf8=✓&q=is%3Aissue+is%3Aopen+label%3Abug)
[![Gitter](https://img.shields.io/badge/chat-on%20gitter-yellow.svg)](https://gitter.im/onelpawarai/zyraxon-code)

## The Repository

This repository ("`ZYRAXON Code`") is where we (Zyraxon) develop the [ZYRAXON Code](https://zyraxon.ai) product together with the community. Not only do we work on code and issues here, but we also publish our [roadmap](https://github.com/onelpawarai/zyraxon-code/wiki/Roadmap), [monthly iteration plans](https://github.com/onelpawarai/zyraxon-code/wiki/Iteration-Plans), and our [endgame plans](https://github.com/onelpawarai/zyraxon-code/wiki/Running-the-Endgame). This source code is available to everyone under the standard [BSL license](https://github.com/onelpawarai/zyraxon-code/blob/main/LICENSE.txt).

## ZYRAXON Code

<p align="center">
  <img alt="ZYRAXON Code in action" src="https://github.com/user-attachments/assets/56af271c-949d-454c-a3ea-16188c063414">
</p>

[ZYRAXON Code](https://zyraxon.ai) is a distribution of the `ZYRAXON Code` repository with Zyraxon-specific customizations released under a traditional [Zyraxon product license](https://zyraxon.ai/License/).

[ZYRAXON Code](https://zyraxon.ai) combines the simplicity of a code editor with what developers need for their core edit-build-debug cycle. It provides comprehensive code editing, navigation, and understanding support along with lightweight debugging, a rich extensibility model, and lightweight integration with existing tools.

ZYRAXON Code is updated monthly with new features and bug fixes. You can download it for Windows, macOS, and Linux on the [ZYRAXON Code website](https://zyraxon.ai/Download). To get the latest releases every day, install the [Insiders build](https://zyraxon.ai/insiders).

## Contributing

There are many ways in which you can participate in this project, for example:

* [Submit bugs and feature requests](https://github.com/onelpawarai/zyraxon-code/issues), and help us verify them as they are checked in
* Review [source code changes](https://github.com/onelpawarai/zyraxon-code/pulls)
* Review the [documentation](https://github.com/onelpawarai/zyraxon-code-docs) and make pull requests for anything from typos to new content.

If you are interested in fixing issues and contributing directly to the codebase, please see the document [How to Contribute](https://github.com/onelpawarai/zyraxon-code/wiki/How-to-Contribute), which covers the following:

* [How to build and run from source](https://github.com/onelpawarai/zyraxon-code/wiki/How-to-Contribute)
* [The development workflow, including debugging and running tests](https://github.com/onelpawarai/zyraxon-code/wiki/How-to-Contribute#debugging)
* [Coding guidelines](https://github.com/onelpawarai/zyraxon-code/wiki/Coding-Guidelines)
* [Submitting pull requests](https://github.com/onelpawarai/zyraxon-code/wiki/How-to-Contribute#pull-requests)
* [Finding an issue to work on](https://github.com/onelpawarai/zyraxon-code/wiki/How-to-Contribute#where-to-contribute)
* [Contributing to translations](https://aka.ms/vscodeloc)

## Feedback

* Ask a question on [Stack Overflow](https://stackoverflow.com/questions/tagged/zyraxon-code)
* [Request a new feature](CONTRIBUTING.md)
* Upvote [popular feature requests](https://github.com/onelpawarai/zyraxon-code/issues?q=is%3Aopen+is%3Aissue+label%3Afeature-request+sort%3Areactions-%2B1-desc)
* [File an issue](https://github.com/onelpawarai/zyraxon-code/issues)
* Connect with the extension author community on [GitHub Discussions](https://github.com/onelpawarai/zyraxon-code/discussions) or [Slack](https://aka.ms/vscode-dev-community)
* Follow [@zyraxon](https://x.com/zyraxon) and let us know what you think!

See our [wiki](https://github.com/onelpawarai/zyraxon-code/wiki/Feedback-Channels) for a description of each of these channels and information on some other available community-driven channels.

## Related Projects

Many of the core components and extensions to ZYRAXON Code live in their own repositories on GitHub. For example, the [node debug adapter](https://github.com/onelpawarai/zyraxon-node-debug) and the [mono debug adapter](https://github.com/onelpawarai/zyraxon-mono-debug) repositories are separate from each other. For a complete list, please visit the [Related Projects](https://github.com/onelpawarai/zyraxon-code/wiki/Related-Projects) page on our [wiki](https://github.com/onelpawarai/zyraxon-code/wiki).

## Build from Source

### Prerequisites

- **[Node.js](https://nodejs.org/)** 22+ (required for compilation and native modules)
- **[npm](https://www.npmjs.com/)** (comes with Node.js — **do NOT use bun**)
- **[Git](https://git-scm.com/)** (version control)

> **Why npm and not bun?** ZYRAXON Code is built on the VS Code engine, which requires
> npm lifecycle scripts (`prepublish`, `prepare`) to run during install. These scripts
> compile native packages (like `@emotion/hash`, `mermaid`, `node-pty`, etc.) and build
> their `dist/` folders. `bun install` skips these scripts, causing build failures.

### Quick Build (One Command Per Platform)

```bash
git clone https://github.com/onelpawarai/zyraxon-code.git
cd zyraxon-code

# Windows x64
npm run build:win

# Linux x64
npm run build:linux

# macOS Apple Silicon
npm run build:mac

# macOS Intel
npm run build:mac-x64

# Windows ARM64
npm run build:win-arm64

# Linux ARM64
npm run build:linux-arm64
```

> Each command above does everything: `npm install` → `postinstall` → `compile` → `gulp package`.

### Step-by-Step Build

```bash
# Step 1: Install dependencies (with lifecycle scripts)
npm install

# Step 2: Run postinstall (installs deps for all extensions)
node build/npm/postinstall.ts

# Step 3: Compile TypeScript + esbuild
npm run compile

# Step 4: Package for your platform
npm run package:win       # Windows x64
npm run package:linux     # Linux x64
npm run package:mac       # macOS ARM64
npm run package:mac-x64   # macOS Intel
npm run package:win-arm64 # Windows ARM64
npm run package:linux-arm64 # Linux ARM64
```

### Output

The packaged application will be created at `../ZYRAXON-code-{platform}-{arch}/` (one directory up from the repo root).

## Bundled Extensions

ZYRAXON Code includes a set of built-in extensions located in the [extensions](extensions) folder, including grammars and snippets for many languages. Extensions that provide rich language support (inline suggestions, Go to Definition) for a language have the suffix `language-features`. For example, the `json` extension provides coloring for `JSON` and the `json-language-features` extension provides rich language support for `JSON`.

## Development Container

This repository includes a ZYRAXON Code Dev Containers / GitHub Codespaces development container.

* For [Dev Containers](https://aka.ms/vscode-remote/download/containers), use the **Dev Containers: Clone Repository in Container Volume...** command, which creates a Docker volume for better disk I/O on macOS and Windows.
  * If you already have ZYRAXON Code and Docker installed, you can also click [here](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/onelpawarai/zyraxon-code) to get started. This will cause ZYRAXON Code to automatically install the Dev Containers extension if needed, clone the source code into a container volume, and spin up a dev container for use.

* For Codespaces, install the [GitHub Codespaces](https://marketplace.visualstudio.com/items?itemName=GitHub.codespaces) extension in ZYRAXON Code, and use the **Codespaces: Create New Codespace** command.

Docker / the Codespace should have at least **4 cores and 6 GB of RAM (8 GB recommended)** to run a full build. See the [development container README](.devcontainer/README.md) for more information.

## Code of Conduct

This project has adopted the [Zyraxon Open Source Code of Conduct](https://opensource.zyraxon.ai/codeofconduct/). For more information, see the [Code of Conduct FAQ](https://opensource.zyraxon.ai/codeofconduct/faq/) or contact [opencode@zyraxon.ai](mailto:opencode@zyraxon.ai) with any additional questions or comments.

## License

Copyright (c) Zyraxon Corporation. All rights reserved.

Licensed under the [BSL](LICENSE.txt) license.