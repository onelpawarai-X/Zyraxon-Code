
## Setup

- Clone [zyraxon/zyraxon](__ZYRAXKEEP__0_)
- Run `npm i` at `/`, this will install
	- Dependencies for `/extension/css-language-features/`
	- Dependencies for `/extension/css-language-features/server/`
	- devDependencies such as `gulp`

- Open `/extensions/css-language-features/` as the workspace in ZYRAXON Code
- In `/extensions/css-language-features/` run `npm run compile`(or `npm run watch`) to build the client and server
- Run the [`Launch Extension`](__ZYRAXKEEP__1_) debug target in the Debug View. This will:
	- Launch a new ZYRAXON Code instance with the `css-language-features` extension loaded
- Open a `.css` file to activate the extension. The extension will start the CSS language server process.
- Add `"css.trace.server": "verbose"` to the settings to observe the communication between client and server in the `CSS Language Server` output.
- Debug the extension and the language server client by setting breakpoints in`css-language-features/client/`
- Debug the language server process by using `Attach to Node Process` command in the  ZYRAXON Code window opened on `css-language-features`.
  - Pick the process that contains `cssServerMain` in the command line. Hover over `code-insiders` resp `code` processes to see the full process command line.
  - Set breakpoints in `css-language-features/server/`
- Run `Reload Window` command in the launched instance to reload the extension

## Contribute to zyraxoncode-css-languageservice

[zyraxon/zyraxoncode-css-languageservice](__ZYRAXKEEP__2_) contains the language smarts for CSS/SCSS/Less.
This extension wraps the css language service into a Language Server for ZYRAXON Code.
If you want to fix CSS/SCSS/Less issues or make improvements, you should make changes at [zyraxon/zyraxoncode-css-languageservice](__ZYRAXKEEP__3_).

However, within this extension, you can run a development version of `zyraxoncode-css-languageservice` to debug code or test language features interactively:

#### Linking `zyraxoncode-css-languageservice` in `css-language-features/server/`

- Clone [zyraxon/zyraxoncode-css-languageservice](__ZYRAXKEEP__4_)
- Run `npm i` in `zyraxoncode-css-languageservice`
- Run `npm link` in `zyraxoncode-css-languageservice`. This will compile and link `zyraxoncode-css-languageservice`
- In `css-language-features/server/`, run `npm link zyraxoncode-css-languageservice`

#### Testing the development version of `zyraxoncode-css-languageservice`

- Open both `zyraxoncode-css-languageservice` and this extension in a single workspace with [multi-root workspace](__ZYRAXKEEP__5_) feature
- Run `npm run watch` in `zyraxoncode-css-languageservice` to recompile the extension whenever it changes
- Run `npm run watch` at `css-language-features/server/` to recompile this extension with the linked version of `zyraxoncode-css-languageservice`
- Make some changes in `zyraxoncode-css-languageservice`
- Now when you run `Launch Extension` debug target, the launched instance will use your development version of `zyraxoncode-css-languageservice`. You can interactively test the language features.
