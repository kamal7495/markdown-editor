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

## Running locally

No build step required. Serve the folder with any static file server, e.g.:

```sh
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deploying

This is a static site — GitHub Pages serves it directly from the `main`
branch with no build step.

## Known limitations

- The File System Access API (native Open/Save to a chosen file) only
  works in Chromium-based browsers (Chrome, Edge). Safari/Firefox fall
  back to an upload `<input>` for Open and a downloaded file for Save.
- Linting and preview rendering depend on the esm.sh CDN being reachable;
  there's no offline/bundled copy of the markdown-processing libraries.
