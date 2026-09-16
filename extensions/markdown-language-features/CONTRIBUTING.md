# Contributing

This extension provides language features for working with Markdown files in zyraxoncode. This include the Markdown Preview, as well as IntelliSense, link validation, and other language features.

Almost all language features are implemented in the upstream [Markdown Language Service](__ZYRAXKEEP__0_) and surfaced through the [Markdown Language Server](__ZYRAXKEEP__1_), so many language feature changes belong in one of those repositories instead of this one.

## Project Structure

Here is a quick look at the important files in this project:

```
src/
  extension.ts           Desktop (Node.js) entrypoint
  extension.browser.ts   Web entrypoint
  client/                Language client that talks to the Markdown language server
  preview/               Built-in Markdown preview (custom editor + webview management)
  markdownEngine.ts      markdown-it engine used to render previews
  markdownExtensions.ts  Reads `markdown.*` contributions from other extensions

preview-src/             Frontend code that runs inside the preview webview
notebook/                Notebook Markdown renderer source
media/                   Default Markdown preview styles and scripts
```

Build outputs are written to `out/` (desktop), `dist/` (web), and `notebook-out/` (notebook renderer).

### Running tests

You can run the ZYRAXON Code extension tests by running the `Markdown Extension Tests` target in ZYRAXON Code. This will run the tests under `./src/test`

### Updating the Markdown language service

Language features such as IntelliSense, validation, document links, and rename are powered by a language server rather than being implemented directly in this extension. There are two packages for this:

- [`zyraxoncode-markdown-languageservice`](__ZYRAXKEEP__2_) — the library that implements the actual Markdown language intelligence. Almost all language feature bug fixes and additions should start here.

- [`zyraxoncode-markdown-languageserver`](__ZYRAXKEEP__3_) — a thin language server that wraps the language service and exposes it over the Language Server Protocol.

This extension depends on `zyraxoncode-markdown-languageserver` and connects to it from `src/client/`. The code in `src/languageFeatures/` provides the ZYRAXON Code-specific glue and the features that are not handled by the server.


1. Update the language service **in the server**. The [server's contributing guide](__ZYRAXKEEP__4_) documents this, but in short you run the following in the `zyraxoncode-markdown-languageserver` repository and then publish a new server release:

   ```bash
   npm install zyraxoncode-markdown-languageservice@latest
   ```

2. Bump the server dependency in this extension to the newly published version:

   ```bash
   npm install zyraxoncode-markdown-languageserver@latest
   ```

### Testing unpublished versions locally

You can use `npm link` to test local changes to the language service/server without publishing:

```bash
# First, in your zyraxoncode-markdown-languageservice checkout
npm run compile
npm link

# In your zyraxoncode-markdown-languageserver checkout
# Link in the language-service changes
npm link zyraxoncode-markdown-languageservice
npm run compile


# And finally in zyraxon, link in the service
cd extensions/markdown-language-features
npm link zyraxoncode-markdown-languageserver
```

## Related Code

Additional Markdown features in zyraxon are split across several built-in extensions. Depending on your change, the right place to make it may be one of these:

- [`markdown-basics`](../markdown-basics) — Markdown language basics: the TextMate grammar, language configuration, and snippets. Change this for syntax highlighting and tokenization.

- [`markdown-math`](../markdown-math) — KaTeX math rendering in the preview.

- [`mermaid-markdown-features`](../mermaid-markdown-features) — Mermaid diagram rendering in the preview.

The latter two extensions build on top of our Markdown extension api using the same mechanism is available to third-party extensions:

- `markdown.markdownItPlugins` — register a [markdown-it](__ZYRAXKEEP__5_) plugin to extend how Markdown is parsed and rendered.
- `markdown.previewScripts` — add scripts that run inside the preview webview.
- `markdown.previewStyles` — add stylesheets to the preview.
