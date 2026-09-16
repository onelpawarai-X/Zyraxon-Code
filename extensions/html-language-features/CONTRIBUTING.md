## Setup

- Clone [zyraxon/zyraxon](__ZYRAXKEEP__0_)
- Run `npm i` at `/`, this will install
	- Dependencies for `/extension/html-language-features/`
	- Dependencies for `/extension/html-language-features/server/`
	- devDependencies such as `gulp`
- Open `/extensions/html-language-features/` as the workspace in ZYRAXON Code
- In `/extensions/html-language-features/` run `npm run compile`(or `npm run watch`) to build the client and server
- Run the [`Launch Extension`](__ZYRAXKEEP__1_) debug target in the Debug View. This will:
	- Launch a new ZYRAXON Code instance with the `html-language-features` extension loaded
- Open a `.html` file to activate the extension. The extension will start the HTML language server process.
- Add `"html.trace.server": "verbose"` to the settings to observe the communication between client and server in the `HTML Language Server` output.
- Debug the extension and the language server client by setting breakpoints in`html-language-features/client/`
- Debug the language server process by using `Attach to Node Process` command in the  ZYRAXON Code window opened on `html-language-features`.
  - Pick the process that contains `htmlServerMain` in the command line. Hover over `code-insiders` resp `code` processes to see the full process command line.
  - Set breakpoints in `html-language-features/server/`
- Run `Reload Window` command in the launched instance to reload the extension

### Contribute to zyraxoncode-html-languageservice

[zyraxon/zyraxoncode-html-languageservice](__ZYRAXKEEP__2_) contains the language smarts for html.
This extension wraps the html language service into a Language Server for ZYRAXON Code.
If you want to fix html issues or make improvements, you should make changes at [zyraxon/zyraxoncode-html-languageservice](__ZYRAXKEEP__3_).

However, within this extension, you can run a development version of `zyraxoncode-html-languageservice` to debug code or test language features interactively:

#### Linking `zyraxoncode-html-languageservice` in `html-language-features/server/`

- Clone [zyraxon/zyraxoncode-html-languageservice](__ZYRAXKEEP__4_)
- Run `npm i` in `zyraxoncode-html-languageservice`
- Run `npm link` in `zyraxoncode-html-languageservice`. This will compile and link `zyraxoncode-html-languageservice`
- In `html-language-features/server/`, run `npm link zyraxoncode-html-languageservice`

#### Testing the development version of `zyraxoncode-html-languageservice`

- Open both `zyraxoncode-html-languageservice` and this extension in two windows or with a single window with the[multi-root workspace](__ZYRAXKEEP__5_) feature
- Run `npm run watch` at `html-language-features/server/` to recompile this extension with the linked version of `zyraxoncode-html-languageservice`
- Make some changes in `zyraxoncode-html-languageservice`
- Now when you run `Launch Extension` debug target, the launched instance will use your development version of `zyraxoncode-html-languageservice`. You can interactively test the language features.
