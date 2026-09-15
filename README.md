# MD Editor

A standalone markdown editor with live preview, syntax-error/style linting,
syntax-highlighted code blocks, and Mermaid diagram rendering. No build
step, no install — just static HTML/CSS/JS, so it runs the same from any
laptop by opening the GitHub Pages URL, serving the folder locally, or
launching the bundled desktop app.

## Features

- CodeMirror-based editor with markdown syntax highlighting
- Multiple tabs — work on several documents at once, each with its own
  undo history and dirty indicator
- Find & replace (Ctrl/Cmd+F) via CodeMirror's built-in search panel
- Formatting shortcuts/toolbar buttons: **Bold** (Ctrl/Cmd+B), *Italic*
  (Ctrl/Cmd+I), Link (Ctrl/Cmd+K), and a list toggle (Ctrl/Cmd+Shift+8)
- Live-rendered, sanitized preview pane
- Syntax-highlighted code blocks in the preview (via `rehype-highlight`),
  matching the editor's own highlighting
- Mermaid diagram rendering — fenced &#96;```mermaid&#96; blocks render as real
  flowcharts/diagrams instead of plain code
- Inline lint squiggles + a Problems panel (powered by `remark-lint`,
  `remark-preset-lint-recommended`/`consistent`, plus a few extra rules)
- Open/Save/Save As, and Open Folder (browse/open any `.md` file in a
  directory from a sidebar tree) — see "File access by platform" below
- Recent files/folders menu, persisted locally (IndexedDB) per platform
- Light/dark theme toggle — flips the editor theme, code highlighting
  theme, and Mermaid diagram theme together
- Installable as a PWA (works offline once loaded once)

## File access by platform

The web app targets the browser's File System Access API; the desktop app
has no such API available (JavaFX's `WebView` doesn't implement it), so it
gets the same features through a native bridge instead:

| | Chrome / Edge | Safari / Firefox | Desktop app |
| --- | --- | --- | --- |
| Open / Save to a chosen file | Native, in place | Upload input / downloaded file | Native OS dialogs |
| Open Folder | Native directory picker | Not available (button hidden) | Native OS dialog |
| Recent files/folders | Yes | Files only (no persistent folder handle) | Yes |

## Architecture

Everything runs client-side with no build step or bundler. Library
dependencies (CodeMirror, unified/remark/rehype, Mermaid) are loaded
directly as ES modules from the [esm.sh](https://esm.sh) CDN inside the
`js/*.js` files, so there's nothing to `npm install` and nothing to
compile — edit a file and reload the page.

| File | Responsibility |
| --- | --- |
| `index.html` | Page shell, toolbar, tab bar, panes |
| `css/style.css` | All styling, incl. light/dark theme tokens |
| `js/app.js` | Wires everything together: tabs, toolbar, theme, dirty state, preview/lint orchestration |
| `js/editor.js` | CodeMirror 6 setup (markdown language, search, lint gutter, formatting keymap, theme compartment) |
| `js/formatting.js` | Bold/italic/link/list editor commands |
| `js/linter.js` | Runs the `remark-lint` pipeline over the current text and returns structured issues |
| `js/preview.js` | Renders markdown to sanitized, syntax-highlighted HTML (`remark` → `rehype`) |
| `js/fileio.js` | Open/Save/Save As/Open Folder, abstracted over three backends: File System Access API, the desktop bridge, and a download/upload fallback |
| `js/recent.js` | Recent files/folders list, persisted in IndexedDB |
| `manifest.json` / `sw.js` | PWA install + network-first caching (falls back to cache when offline) |

### Desktop app (Gradle/JavaFX)

`src/main/java/com/mdeditor/desktop/App.java` wraps the same web app in a
native window: it starts a local-only HTTP server (Java's built-in
`SimpleFileServer`) serving the project's own `index.html`/`css`/`js` files
straight off disk, then opens a JavaFX `WebView` pointed at it. There's a
single source of truth — the static files at the repo root — shared by
both the GitHub Pages deployment and the desktop app; nothing is
duplicated or bundled separately.

`src/main/java/com/mdeditor/desktop/DesktopBridge.java` is injected into
the page as `window.desktopBridge` once it loads, exposing native file/
folder dialogs and direct file I/O to the JS side (see `js/fileio.js`),
since the WebView has no File System Access API of its own.

## Running locally

### In a browser

No build step required. Serve the folder with any static file server, e.g.:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

### As a desktop app

Requires only a JDK (any recent one) to bootstrap — the Gradle wrapper will
auto-download a JDK 21 toolchain and JavaFX itself on first run if needed.

- macOS/Linux: double-click `run.sh` (or run `./run.sh` / `./gradlew run`)
- Windows: double-click `run.bat` (or run `gradlew.bat run`)

**First run needs internet access** to download Gradle itself, the JavaFX
runtime, and (if needed) a JDK 21 toolchain — this can take a few minutes
depending on your connection. Always launch via `run.bat`/`run.sh`/
`gradlew run`, never by running the compiled class or jar directly (e.g.
from an IDE's "Run" button) — only the Gradle `run` task is configured
with the module-path arguments JavaFX needs; running it any other way
produces a `JavaFX runtime components are missing` error.

**Troubleshooting a download timeout:** if the first run fails with a
network timeout, check your internet connection/proxy and run it again —
`run.bat`/`run.sh` will resume rather than starting over. If it still
fails, delete the partially-downloaded Gradle install
(`%USERPROFILE%\.gradle\wrapper\dists` on Windows,
`~/.gradle/wrapper/dists` on macOS/Linux) and retry once more.

This opens the editor in its own native window instead of a browser tab.

## Deploying

This is a static site — GitHub Pages serves it directly from the `main`
branch with no build step.

## Known limitations

- Recent folders on Safari/Firefox aren't restored across sessions (no
  persistent directory-handle permission there), so Open Folder there is
  a one-off pick each time. Files still show up in Recent.
- Linting and preview rendering depend on the esm.sh CDN being reachable;
  there's no offline/bundled copy of the markdown-processing libraries.
