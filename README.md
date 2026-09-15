# MD Editor

A standalone markdown editor with live preview, syntax-error/style linting,
syntax-highlighted code blocks, and Mermaid diagram rendering. No build
step, no install — just static HTML/CSS/JS, so it runs the same from any
laptop by opening the GitHub Pages URL (or serving the folder locally).

## Features

- CodeMirror-based editor with markdown syntax highlighting
- Live-rendered, sanitized preview pane
- Syntax-highlighted code blocks in the preview (via `rehype-highlight`),
  matching the editor's own highlighting
- Mermaid diagram rendering — fenced &#96;```mermaid&#96; blocks render as real
  flowcharts/diagrams instead of plain code
- Inline lint squiggles + a Problems panel (powered by `remark-lint`,
  `remark-preset-lint-recommended`/`consistent`, plus a few extra rules)
- Open/Save/Save As via the File System Access API (Chrome/Edge), with a
  download-based fallback for other browsers
- Open Folder — pick a directory and browse/open any `.md` file in it from
  a sidebar tree (Chrome/Edge only; the button is hidden elsewhere)
- Light/dark theme toggle — flips the editor theme, code highlighting
  theme, and Mermaid diagram theme together
- Installable as a PWA (works offline once loaded once)

## Architecture

Everything runs client-side with no build step or bundler. Library
dependencies (CodeMirror, unified/remark/rehype, Mermaid) are loaded
directly as ES modules from the [esm.sh](https://esm.sh) CDN inside the
`js/*.js` files, so there's nothing to `npm install` and nothing to
compile — edit a file and reload the page.

| File | Responsibility |
| --- | --- |
| `index.html` | Page shell, toolbar, panes, PWA/theme link tags |
| `css/style.css` | All styling, incl. light/dark theme tokens |
| `js/app.js` | Wires everything together: UI events, theme toggle, dirty state, preview/lint orchestration |
| `js/editor.js` | CodeMirror 6 setup (markdown language, lint gutter, theme compartment) |
| `js/linter.js` | Runs the `remark-lint` pipeline over the current text and returns structured issues |
| `js/preview.js` | Renders markdown to sanitized, syntax-highlighted HTML (`remark` → `rehype`) |
| `js/fileio.js` | Open/Save/Save As, using the File System Access API with a download-based fallback |
| `manifest.json` / `sw.js` | PWA install + offline caching for the app's own static assets |

### Desktop app (Gradle/JavaFX)

`src/main/java/com/mdeditor/desktop/App.java` wraps the same web app in a
native window: it starts a local-only HTTP server (Java's built-in
`SimpleFileServer`) serving the project's own `index.html`/`css`/`js` files
straight off disk, then opens a JavaFX `WebView` pointed at it. There's a
single source of truth — the static files at the repo root — shared by
both the GitHub Pages deployment and the desktop app; nothing is
duplicated or bundled separately.

## Running locally

### In a browser

No build step required. Serve the folder with any static file server, e.g.:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

### As a desktop app (Gradle)

Requires only a JDK (any recent one) to bootstrap — the Gradle wrapper will
auto-download a JDK 21 toolchain and JavaFX itself on first run if needed:

```sh
./gradlew run
```

This opens the editor in its own native window instead of a browser tab.

**Known limitation:** JavaFX's `WebView` doesn't implement the File System
Access API, so in the desktop app, Open/Save fall back to a plain upload
dialog / downloaded file (same as Safari/Firefox in the browser version),
and the Open Folder button is hidden, since directory picking isn't
available either.

## Deploying

This is a static site — GitHub Pages serves it directly from the `main`
branch with no build step.

## Known limitations

- The File System Access API (native Open/Save/Open Folder) only works in
  Chromium-based browsers (Chrome, Edge) and is unavailable in the desktop
  (JavaFX WebView) build. Elsewhere, Open/Save fall back to an upload
  `<input>` and a downloaded file, and Open Folder is hidden entirely.
- Linting and preview rendering depend on the esm.sh CDN being reachable;
  there's no offline/bundled copy of the markdown-processing libraries.
