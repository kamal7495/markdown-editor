const supportsFsAccess = "showOpenFilePicker" in window;

const pickerOpts = {
  types: [
    {
      description: "Markdown",
      accept: { "text/markdown": [".md", ".markdown", ".txt"] },
    },
  ],
};

export function isFsAccessSupported() {
  return supportsFsAccess;
}

/** @returns {Promise<{name: string, text: string, handle: any} | null>} */
export async function openFile() {
  if (supportsFsAccess) {
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
    return { name: fileObj.name, text, handle };
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
      resolve({ name: fileObj.name, text, handle: null });
      input.value = "";
    };
    input.addEventListener("change", onChange);
    input.click();
  });
}

/** @returns {Promise<any|null>} returns a handle usable for future saves, or null if unsupported/cancelled */
export async function saveFile(handle, text) {
  if (handle) {
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return handle;
  }
  return saveFileAs(text, "Untitled.md");
}

/** @returns {Promise<{handle: any, name: string} | null>} */
export async function saveFileAs(text, suggestedName) {
  if (supportsFsAccess) {
    let handle;
    try {
      handle = await window.showSaveFilePicker({
        ...pickerOpts,
        suggestedName,
      });
    } catch (err) {
      if (err.name === "AbortError") return null;
      throw err;
    }
    const writable = await handle.createWritable();
    await writable.write(text);
    await writable.close();
    return { handle, name: handle.name };
  }
  downloadFallback(text, suggestedName);
  return { handle: null, name: suggestedName };
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
