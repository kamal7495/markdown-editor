const DB_NAME = "md-editor";
const STORE = "recent";
const MAX_RECENT = 10;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function getAllRecent(db) {
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result.sort((a, b) => b.timestamp - a.timestamp));
    req.onerror = () => reject(req.error);
  });
}

/** @param {{kind: 'file'|'folder', name: string, ref: object}} entry */
export async function addRecent(entry) {
  try {
    const db = await openDb();
    const id = `${entry.ref.backend}:${entry.kind}:${entry.ref.path || entry.name}`;
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id, ...entry, timestamp: Date.now() });
    await txDone(tx);

    const all = await getAllRecent(db);
    const excess = all.slice(MAX_RECENT);
    if (excess.length > 0) {
      const trimTx = db.transaction(STORE, "readwrite");
      const store = trimTx.objectStore(STORE);
      excess.forEach((e) => store.delete(e.id));
      await txDone(trimTx);
    }
  } catch (err) {
    console.warn("Could not save recent entry", err);
  }
}

/** @returns {Promise<Array<{id, kind, name, ref, timestamp}>>} */
export async function getRecent(backend) {
  try {
    const db = await openDb();
    const all = await getAllRecent(db);
    return all.filter((e) => e.ref.backend === backend);
  } catch {
    return [];
  }
}
