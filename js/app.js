import { createTabState, createEditorView, setEditorTheme, configureEditor, registerFormattingCommands } from "./editor.js";
import { formattingCommands, toggleBold, toggleItalic, insertLink, toggleList } from "./formatting.js";
import { lintMarkdown } from "./linter.js";
import { renderMarkdown } from "./preview.js";
import { addRecent, getRecent } from "./recent.js";
import {
  openFilePicker,
  openFolderPicker,
  readTreeFile,
  saveFile,
  saveFileAs,
  reopenRecent,
  getBackend,
  isFolderSupported,
} from "./fileio.js";
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

const tabs = [];
let activeTabId = null;
let nextTabId = 1;
let view;
let previewTimer = null;

const els = {
  filename: document.getElementById("filename"),
  dirty: document.getElementById("dirty-indicator"),
  preview: document.getElementById("preview"),
  issueCount: document.getElementById("issue-count"),
  problemsPanel: document.getElementById("problems-panel"),
  problemsList: document.getElementById("problems-list"),
  btnOpen: document.getElementById("btn-open"),
  btnOpenFolder: document.getElementById("btn-open-folder"),
  btnSave: document.getElementById("btn-save"),
  btnSaveAs: document.getElementById("btn-save-as"),
  btnTheme: document.getElementById("btn-toggle-theme"),
  btnCloseProblems: document.getElementById("btn-close-problems"),
  btnCloseSidebar: document.getElementById("btn-close-sidebar"),
  divider: document.getElementById("divider"),
  editorPane: document.getElementById("editor-pane"),
  sidebar: document.getElementById("sidebar"),
  sidebarTitle: document.getElementById("sidebar-title"),
  sidebarTree: document.getElementById("sidebar-tree"),
  btnBold: document.getElementById("btn-bold"),
  btnItalic: document.getElementById("btn-italic"),
  btnLink: document.getElementById("btn-link"),
  btnList: document.getElementById("btn-list"),
  btnRecent: document.getElementById("btn-recent"),
  recentMenu: document.getElementById("recent-menu"),
  tabbarList: document.getElementById("tabbar-list"),
  btnNewTab: document.getElementById("btn-new-tab"),
};

function isDarkTheme() {
  return document.documentElement.getAttribute("data-theme") === "dark";
}

// --- Tabs ---

function getActiveTab() {
  return tabs.find((t) => t.id === activeTabId);
}

function createNewTab(name = "Untitled.md", text = "", ref = { backend: "none" }) {
  const tab = { id: nextTabId++, name, ref, dirty: false, cmState: createTabState(text, isDarkTheme()) };
  tabs.push(tab);
  return tab;
}

function switchToTab(id) {
  if (id === activeTabId) return;
  const current = getActiveTab();
  if (current) current.cmState = view.state;
  const next = tabs.find((t) => t.id === id);
  if (!next) return;
  activeTabId = id;
  view.setState(next.cmState);
  setEditorTheme(view, isDarkTheme());
  renderTabs();
  updatePreview(next.cmState.doc.toString());
}

async function closeTab(id) {
  const tab = tabs.find((t) => t.id === id);
  if (!tab) return;
  if (tab.dirty && !confirm(`Discard unsaved changes in "${tab.name}"?`)) return;
  const idx = tabs.indexOf(tab);
  tabs.splice(idx, 1);
  if (tabs.length === 0) createNewTab();
  if (activeTabId === id) {
    const neighbor = tabs[Math.max(0, idx - 1)];
    activeTabId = null;
    switchToTab(neighbor.id);
  } else {
    renderTabs();
  }
}

async function openInNewTab({ name, text, ref }) {
  const tab = createNewTab(name, text, ref);
  switchToTab(tab.id);
  if (ref && ref.backend !== "none") await addRecent({ kind: "file", name, ref });
}

function renderTabs() {
  els.tabbarList.innerHTML = "";
  for (const tab of tabs) {
    const div = document.createElement("div");
    div.className = "tab" + (tab.id === activeTabId ? " active" : "");
    const dirtyDot = document.createElement("span");
    dirtyDot.className = "tab-dirty";
    dirtyDot.textContent = tab.dirty ? "●" : "";
    const label = document.createElement("span");
    label.textContent = tab.name;
    const closeBtn = document.createElement("button");
    closeBtn.className = "tab-close";
    closeBtn.textContent = "×";
    closeBtn.title = "Close tab";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });
    div.append(dirtyDot, label, closeBtn);
    div.addEventListener("click", () => switchToTab(tab.id));
    els.tabbarList.appendChild(div);
  }
  updateToolbarForActiveTab();
}

function updateToolbarForActiveTab() {
  const tab = getActiveTab();
  if (!tab) return;
  els.filename.textContent = tab.name;
  els.dirty.hidden = !tab.dirty;
}

// --- Preview / lint ---

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
  const tab = getActiveTab();
  if (tab) {
    tab.dirty = true;
    renderTabs();
  }
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
  const result = await openFilePicker();
  if (!result) return;
  await openInNewTab(result);
}

async function doOpenFolder() {
  const tree = await openFolderPicker();
  if (!tree) return;
  els.sidebar.hidden = false;
  els.sidebarTitle.textContent = tree.name;
  els.sidebarTitle.title = tree.name;
  renderTree(tree.children);
  if (tree.ref) await addRecent({ kind: "folder", name: tree.name, ref: tree.ref });
}

function renderTree(nodes) {
  els.sidebarTree.innerHTML = "";
  els.sidebarTree.appendChild(renderTreeLevel(nodes));
}

function renderTreeLevel(nodes) {
  const ul = document.createElement("ul");
  for (const node of nodes) {
    const li = document.createElement("li");
    if (node.kind === "directory") {
      const details = document.createElement("details");
      details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = node.name;
      details.append(summary, renderTreeLevel(node.children));
      li.appendChild(details);
    } else {
      const div = document.createElement("div");
      div.className = "tree-file";
      div.textContent = node.name;
      div.title = node.path;
      div.addEventListener("click", async () => {
        const result = await readTreeFile(node);
        await openInNewTab(result);
        els.sidebarTree.querySelectorAll(".tree-file.active").forEach((el) => el.classList.remove("active"));
        div.classList.add("active");
      });
      li.appendChild(div);
    }
    ul.appendChild(li);
  }
  return ul;
}

async function doSave() {
  const tab = getActiveTab();
  const text = view.state.doc.toString();
  const result = await saveFile(tab.ref, text, tab.name);
  if (!result) return;
  tab.ref = result.ref;
  tab.name = result.name;
  tab.dirty = false;
  if (result.ref.backend !== "none") await addRecent({ kind: "file", name: result.name, ref: result.ref });
  renderTabs();
}

async function doSaveAs() {
  const tab = getActiveTab();
  const text = view.state.doc.toString();
  const result = await saveFileAs(text, tab.name);
  if (!result) return;
  tab.ref = result.ref;
  tab.name = result.name;
  tab.dirty = false;
  if (result.ref.backend !== "none") await addRecent({ kind: "file", name: result.name, ref: result.ref });
  renderTabs();
}

// --- Recent files menu ---

async function openRecentMenu() {
  const backend = getBackend();
  const entries = await getRecent(backend);
  els.recentMenu.innerHTML = "";
  if (entries.length === 0) {
    const div = document.createElement("div");
    div.className = "empty";
    div.textContent = "No recent files";
    els.recentMenu.appendChild(div);
  } else {
    for (const entry of entries) {
      const btn = document.createElement("button");
      btn.className = "recent-item";
      btn.textContent = `${entry.kind === "folder" ? "\u{1F4C1}" : "\u{1F4C4}"} ${entry.name}`;
      btn.addEventListener("click", async () => {
        closeAllMenus();
        const result = await reopenRecent(entry);
        if (!result) {
          alert("Could not reopen — it may have moved, or permission was denied.");
          return;
        }
        if (result.type === "file") {
          await openInNewTab(result);
        } else {
          els.sidebar.hidden = false;
          els.sidebarTitle.textContent = result.name;
          renderTree(result.children);
        }
      });
      els.recentMenu.appendChild(btn);
    }
  }
  els.recentMenu.hidden = false;
}

function toggleMenu(menuEl, openFn) {
  const wasHidden = menuEl.hidden;
  closeAllMenus();
  if (wasHidden) openFn();
}

function closeAllMenus() {
  els.recentMenu.hidden = true;
}

// --- Wiring ---

function initToolbar() {
  els.btnOpen.addEventListener("click", doOpen);
  els.btnOpenFolder.addEventListener("click", doOpenFolder);
  els.btnOpenFolder.hidden = !isFolderSupported();
  els.btnCloseSidebar.addEventListener("click", () => {
    els.sidebar.hidden = true;
  });
  els.btnSave.addEventListener("click", doSave);
  els.btnSaveAs.addEventListener("click", doSaveAs);
  els.btnTheme.addEventListener("click", () => applyTheme(!isDarkTheme()));
  els.btnCloseProblems.addEventListener("click", () => {
    els.problemsPanel.hidden = true;
  });
  els.issueCount.addEventListener("click", () => {
    els.problemsPanel.hidden = !els.problemsPanel.hidden;
  });

  els.btnBold.addEventListener("click", () => toggleBold(view));
  els.btnItalic.addEventListener("click", () => toggleItalic(view));
  els.btnLink.addEventListener("click", () => insertLink(view));
  els.btnList.addEventListener("click", () => toggleList(view));

  els.btnRecent.addEventListener("click", (e) => {
    e.stopPropagation();
    toggleMenu(els.recentMenu, openRecentMenu);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".dropdown")) closeAllMenus();
  });

  els.btnNewTab.addEventListener("click", () => {
    const tab = createNewTab();
    switchToTab(tab.id);
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
    if (tabs.some((t) => t.dirty)) {
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
  configureEditor({ onChange: onDocChange, lintSource });
  registerFormattingCommands(formattingCommands);
  initToolbar();
  initDivider();

  const welcomeTab = createNewTab("Untitled.md", WELCOME, { backend: "none" });
  activeTabId = welcomeTab.id;
  view = createEditorView(document.getElementById("editor"), welcomeTab.cmState);

  renderTabs();
  updatePreview(WELCOME);

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  }
}

init();
