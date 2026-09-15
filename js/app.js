import { createEditor, setEditorTheme } from "./editor.js";
import { lintMarkdown } from "./linter.js";
import { renderMarkdown } from "./preview.js";
import { openFile, saveFile, saveFileAs, isFsAccessSupported } from "./fileio.js";
import mermaid from "https://esm.sh/mermaid@10.9.1";

const WELCOME = `# Welcome to MD Editor

Start typing markdown on the left. You'll get a **live preview** on the
right, and syntax/style issues will show up as underlines and in the
Problems panel below.

## Try it

- [ ] Open a file with the Open button
- [ ] Break something, e.g. an ![unclosed image](
- [ ] Check the Problems panel

\`\`\`js
console.log("code blocks are highlighted too");
\`\`\`

\`\`\`mermaid
graph LR
  A[Write markdown] --> B{Lint issues?}
  B -- yes --> C[Fix in editor]
  C --> B
  B -- no --> D[Save]
\`\`\`
`;

const state = {
  handle: null,
  filename: "Untitled.md",
  dirty: false,
};

const els = {
  filename: document.getElementById("filename"),
  dirty: document.getElementById("dirty-indicator"),
  preview: document.getElementById("preview"),
  issueCount: document.getElementById("issue-count"),
  problemsPanel: document.getElementById("problems-panel"),
  problemsList: document.getElementById("problems-list"),
  btnOpen: document.getElementById("btn-open"),
  btnSave: document.getElementById("btn-save"),
  btnSaveAs: document.getElementById("btn-save-as"),
  btnTheme: document.getElementById("btn-toggle-theme"),
  btnCloseProblems: document.getElementById("btn-close-problems"),
  divider: document.getElementById("divider"),
  editorPane: document.getElementById("editor-pane"),
};

let view;
let previewTimer = null;

function markDirty(dirty) {
  state.dirty = dirty;
  els.dirty.hidden = !dirty;
}

function setFilename(name) {
  state.filename = name;
  els.filename.textContent = name;
}

async function updatePreview(text) {
  try {
    els.preview.innerHTML = await renderMarkdown(text);
    await renderMermaidDiagrams();
  } catch (err) {
    console.error("Preview render failed", err);
  }
}

async function renderMermaidDiagrams() {
  const blocks = els.preview.querySelectorAll("pre > code.language-mermaid");
  if (blocks.length === 0) return;
  blocks.forEach((code, i) => {
    const div = document.createElement("div");
    div.className = "mermaid";
    div.id = `mermaid-${Date.now()}-${i}`;
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
  });
  try {
    await mermaid.run({ nodes: els.preview.querySelectorAll(".mermaid") });
  } catch (err) {
    console.error("Mermaid render failed", err);
  }
}

function severityRank(sev) {
  return sev === "error" ? 0 : sev === "warning" ? 1 : 2;
}

function renderProblems(issues) {
  els.problemsList.innerHTML = "";
  if (issues.length === 0) {
    els.issueCount.hidden = true;
    return;
  }
  els.issueCount.hidden = false;
  els.issueCount.textContent = `${issues.length} issue${issues.length === 1 ? "" : "s"}`;

  for (const issue of issues) {
    const li = document.createElement("li");
    const dot = document.createElement("span");
    dot.className = `sev-dot sev-${issue.severity}`;
    const loc = document.createElement("span");
    loc.className = "problem-loc";
    loc.textContent = `${issue.line}:${issue.column}`;
    const msg = document.createElement("span");
    msg.textContent = issue.ruleId ? `${issue.message} (${issue.ruleId})` : issue.message;
    li.append(dot, loc, msg);
    li.addEventListener("click", () => jumpToLine(issue.line, issue.column));
    els.problemsList.appendChild(li);
  }
}

function clampPos(doc, line, column) {
  const l = Math.min(Math.max(line, 1), doc.lines);
  const lineInfo = doc.line(l);
  return Math.min(lineInfo.from + Math.max(0, column - 1), doc.length);
}

function jumpToLine(line, column) {
  const pos = clampPos(view.state.doc, line, column);
  view.dispatch({ selection: { anchor: pos }, scrollIntoView: true });
  view.focus();
  els.problemsPanel.hidden = false;
}

function toDiagnostics(issues, doc) {
  return issues.map((issue) => {
    const from = clampPos(doc, issue.line, issue.column);
    let to = clampPos(doc, issue.endLine, issue.endColumn);
    if (to <= from) to = Math.min(from + 1, doc.length);
    return {
      from,
      to,
      severity: issue.severity,
      message: issue.ruleId ? `${issue.message} (${issue.ruleId})` : issue.message,
    };
  });
}

async function lintSource(cmView) {
  const text = cmView.state.doc.toString();
  let issues = [];
  try {
    issues = await lintMarkdown(text);
  } catch (err) {
    console.error("Lint failed", err);
    return [];
  }
  issues.sort((a, b) => severityRank(a.severity) - severityRank(b.severity) || a.line - b.line);
  renderProblems(issues);
  return toDiagnostics(issues, cmView.state.doc);
}

function onDocChange(text) {
  markDirty(true);
  clearTimeout(previewTimer);
  previewTimer = setTimeout(() => updatePreview(text), 200);
}

// --- Theme ---

function applyTheme(isDark) {
  document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  els.btnTheme.textContent = isDark ? "☀" : "☽";
  document.getElementById("hljs-light").disabled = isDark;
  document.getElementById("hljs-dark").disabled = !isDark;
  mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: isDark ? "dark" : "default" });
  if (view) {
    setEditorTheme(view, isDark);
    updatePreview(view.state.doc.toString());
  }
  localStorage.setItem("md-editor-theme", isDark ? "dark" : "light");
}

function initialTheme() {
  const saved = localStorage.getItem("md-editor-theme");
  if (saved) return saved === "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

// --- File actions ---

async function doOpen() {
  if (state.dirty && !confirm("Discard unsaved changes?")) return;
  const result = await openFile();
  if (!result) return;
  view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: result.text } });
  state.handle = result.handle;
  setFilename(result.name);
  markDirty(false);
  updatePreview(result.text);
}

async function doSave() {
  const text = view.state.doc.toString();
  if (!state.handle && !isFsAccessSupported()) {
    await saveFileAs(text, state.filename);
    return;
  }
  const handle = await saveFile(state.handle, text);
  if (!handle) return;
  state.handle = handle;
  setFilename(handle.name || state.filename);
  markDirty(false);
}

async function doSaveAs() {
  const text = view.state.doc.toString();
  const result = await saveFileAs(text, state.filename);
  if (!result) return;
  state.handle = result.handle;
  setFilename(result.name);
  markDirty(false);
}

// --- Wiring ---

function initToolbar() {
  els.btnOpen.addEventListener("click", doOpen);
  els.btnSave.addEventListener("click", doSave);
  els.btnSaveAs.addEventListener("click", doSaveAs);
  els.btnTheme.addEventListener("click", () => {
    const isDark = document.documentElement.getAttribute("data-theme") === "dark";
    applyTheme(!isDark);
  });
  els.btnCloseProblems.addEventListener("click", () => {
    els.problemsPanel.hidden = true;
  });
  els.issueCount.addEventListener("click", () => {
    els.problemsPanel.hidden = !els.problemsPanel.hidden;
  });

  window.addEventListener("keydown", (e) => {
    const mod = e.metaKey || e.ctrlKey;
    if (mod && e.key.toLowerCase() === "o") {
      e.preventDefault();
      doOpen();
    } else if (mod && e.key.toLowerCase() === "s") {
      e.preventDefault();
      if (e.shiftKey) doSaveAs();
      else doSave();
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (state.dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
}

function initDivider() {
  let dragging = false;
  els.divider.addEventListener("mousedown", () => {
    dragging = true;
    document.body.style.cursor = "col-resize";
  });
  window.addEventListener("mousemove", (e) => {
    if (!dragging) return;
    const mainRect = document.getElementById("main").getBoundingClientRect();
    const ratio = (e.clientX - mainRect.left) / mainRect.width;
    const pct = Math.min(0.85, Math.max(0.15, ratio)) * 100;
    els.editorPane.style.flex = `0 0 ${pct}%`;
  });
  window.addEventListener("mouseup", () => {
    dragging = false;
    document.body.style.cursor = "";
  });
}

function init() {
  applyTheme(initialTheme());
  initToolbar();
  initDivider();

  view = createEditor({
    parent: document.getElementById("editor"),
    doc: WELCOME,
    onChange: onDocChange,
    lintSource,
    isDark: document.documentElement.getAttribute("data-theme") === "dark",
  });

  updatePreview(WELCOME);
  setFilename(state.filename);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
