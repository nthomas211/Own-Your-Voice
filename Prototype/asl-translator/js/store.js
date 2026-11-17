// Persists recorded sign examples in IndexedDB (stays on this device),
// plus JSON export/import so vocabularies can be backed up or shared.

const DB = "asl-translator";
const STORE = "samples";

function open() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    const result = fn(store);
    t.oncomplete = () => resolve(result && "result" in result ? result.result : undefined);
    t.onerror = () => reject(t.error);
  });
}

export const loadSamples = () => tx("readonly", (s) => s.getAll());
export const saveSample = (sample) => tx("readwrite", (s) => s.put(sample));
export const deleteSample = (id) => tx("readwrite", (s) => s.delete(id));
export const clearSamples = () => tx("readwrite", (s) => s.clear());

export function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function exportJSON(samples) {
  return JSON.stringify({
    format: "asl-translator-vocab",
    version: 1,
    exported: new Date().toISOString(),
    samples: samples.map((s) => ({
      label: s.label,
      created: s.created,
      seq: s.seq.map((f) => Array.from(f, (v) => Math.round(v * 1000) / 1000)),
    })),
  });
}

export function parseJSON(text) {
  const data = JSON.parse(text);
  if (data.format !== "asl-translator-vocab" || !Array.isArray(data.samples)) {
    throw new Error("Not an ASL Translator vocabulary file.");
  }
  return data.samples.map((s) => ({
    id: newId(),
    label: String(s.label),
    created: s.created || Date.now(),
    seq: s.seq.map((f) => Float32Array.from(f)),
  }));
}
