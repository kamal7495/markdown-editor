const pickerOpts = {
  types: [
    {
      description: "Markdown",
      accept: { "text/markdown": [".md", ".markdown", ".txt"] },
    },
  ],
};

const MAX_DEPTH = 8;

export function getBackend() {
  if (typeof window !== "undefined" && window.desktopBridge) return "desktop";
  if (typeof window !== "undefined" && "showOpenFilePicker" in window) return "fsa";
  return "none";
}

export function isFolderSupported() {
  const backend = getBackend();
  return backend === "desktop" || (backend === "fsa" && "showDirectoryPicker" in window);
}

// --- Open a single file ---

/** @returns {Promise<{name: string, text: string, ref: object} | null>} */
export async function openFilePicker() {
  const backend = getBackend();
  if (backend === "desktop") {
    const path = window.desktopBridge.openFileDialog();
    if (!path) return null;
    const text = window.desktopBridge.readFile(path);
    if (text == null) return null;
    return { name: path.split("/").pop(), text, ref: { backend: "desktop", path } };
  }
  if (backend === "fsa") {
    let handles;
    try {
      handles = await window.showOpenFilePicker(pickerOpts);
    } catch (err) {
      if (err.name === "AbortError") return null;
      throw err;
    }
    const handle = handles[0];
    const fileObj = await handle.getFile();
    const text = await fileObj.text();
    return { name: fileObj.name, text, ref: { backend: "fsa", handle } };
  }
  return openFileFallback();
}

function openFileFallback() {
  return new Promise((resolve) => {
    const input = document.getElementById("file-input");
    const onChange = async () => {
      input.removeEventListener("change", onChange);
      const fileObj = input.files[0];
      if (!fileObj) return resolve(null);
      const text = await fileObj.text();
      resolve({ name: fileObj.name, text, ref: { backend: "none" } });
      input.value = "";
    };
    input.addEventListener("change", onChange);
    input.click();
  });
}

// --- Save ---

/** @returns {Promise<{ref: object, name: string} | null>} */
export async function saveFile(ref, text, suggestedName) {
  if (ref?.backend === "desktop") {
    const ok = window.desktopBridge.writeFile(ref.path, text);
    if (!ok) return null;
    return { ref, name: ref.path.split("/").pop() };
  }
  if (ref?.backend === "fsa") {
    const writable = await ref.handle.createWritable();
    await writable.write(text);
    await writable.close();
    return { ref, name: ref.handle.name };
  }
  return saveFileAs(text, suggestedName || "Untitled.md");
}

/** @returns {Promise<{ref: object, name: string} | null>} */
export async function saveFileAs(text, suggestedName) {
  const backend = getBackend();
  if (backend === "desktop") {
    const path = window.desktopBridge.saveFileDialog(suggestedName);
    if (!path) return null;
    window.desktopBridge.writeFile(path, text);
    return { ref: { backend: "desktop", path }, name: path.split("/").pop() };
  }
  if (backend === "fsa") {
    let handle;
    try {
      handle = await window.showSaveFilePicker({ ...pickerOpts, suggestedName });
    } catch (err) {
      if (err.name === "AbortError") return null;
      throw err;
    }
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return { ref: { backend: "fsa", handle }, name: handle.name };
  }
  downloadFallback(text, suggestedName);
  return { ref: { backend: "none" }, name: suggestedName };
}

function downloadFallback(text, filename) {
  const blob = new Blob([text], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --- Open a folder ---

/** @returns {Promise<{name: string, children: object[]} | null>} */
export async function openFolderPicker() {
  const backend = getBackend();
  if (backend === "desktop") {
    const rootPath = window.desktopBridge.openFolderDialog();
    if (!rootPath) return null;
    const root = JSON.parse(window.desktopBridge.listMarkdownFiles(rootPath));
    return {
      name: root.name,
      children: convertDesktopChildren(root.children || []),
      ref: { backend: "desktop", path: rootPath },
    };
  }
  if (backend === "fsa" && "showDirectoryPicker" in window) {
    let dirHandle;
    try {
      dirHandle = await window.showDirectoryPicker();
    } catch (err) {
      if (err.name === "AbortError") return null;
      throw err;
    }
    const children = await buildFsaTree(dirHandle);
    return { name: dirHandle.name, children, ref: { backend: "fsa", handle: dirHandle } };
  }
  return null;
}

function convertDesktopChildren(nodes) {
  return nodes.map((n) =>
    n.kind === "directory"
      ? { name: n.name, kind: "directory", children: convertDesktopChildren(n.children || []) }
      : { name: n.name, path: n.path, kind: "file", ref: { backend: "desktop", path: n.path } }
  );
}

async function buildFsaTree(dirHandle, path = "", depth = 0) {
  if (depth > MAX_DEPTH) return [];
  const entries = [];
  for await (const [name, handle] of dirHandle.entries()) {
    if (name.startsWith(".")) continue;
    const entryPath = path ? `${path}/${name}` : name;
    if (handle.kind === "directory") {
      const children = await buildFsaTree(handle, entryPath, depth + 1);
      if (children.length > 0) entries.push({ name, kind: "directory", children });
    } else if (/\.(md|markdown)$/i.test(name)) {
      entries.push({ name, path: entryPath, kind: "file", ref: { backend: "fsa", handle } });
    }
  }
  entries.sort((a, b) =>
    a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "directory" ? -1 : 1
  );
  return entries;
}

/** @returns {Promise<{name: string, text: string, ref: object}>} */
export async function readTreeFile(node) {
  if (node.ref.backend === "desktop") {
    return { name: node.name, text: window.desktopBridge.readFile(node.ref.path), ref: node.ref };
  }
  const fileObj = await node.ref.handle.getFile();
  const text = await fileObj.text();
  return { name: fileObj.name, text, ref: node.ref };
}

// --- Recent files ---

/** @returns {Promise<{type: 'file'|'folder', name: string, text?: string, children?: object[], ref: object} | null>} */
export async function reopenRecent(entry) {
  if (entry.ref.backend === "desktop") {
    if (entry.kind === "file") {
      const text = window.desktopBridge.readFile(entry.ref.path);
      if (text == null) return null;
      return { type: "file", name: entry.name, text, ref: entry.ref };
    }
    const root = JSON.parse(window.desktopBridge.listMarkdownFiles(entry.ref.path));
    return { type: "folder", name: root.name, children: convertDesktopChildren(root.children || []) };
  }
  if (entry.ref.backend === "fsa") {
    const handle = entry.ref.handle;
    let perm = await handle.queryPermission({ mode: "readwrite" });
    if (perm !== "granted") perm = await handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return null;
    if (entry.kind === "file") {
      const fileObj = await handle.getFile();
      const text = await fileObj.text();
      return { type: "file", name: fileObj.name, text, ref: entry.ref };
    }
    const children = await buildFsaTree(handle);
    return { type: "folder", name: handle.name, children };
  }
  return null;
}
