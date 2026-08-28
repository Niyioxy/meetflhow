/**
 * Single-slot IndexedDB safety net for the in-browser recorder. A recording
 * only becomes durable server-side once it's uploaded — everything before
 * that lives only in this tab's memory, so a stray refresh or closed tab
 * used to lose it silently with no way to recover it. This persists the
 * blob the moment recording stops, so a reload can offer it back.
 */

const DB_NAME = "meetflhow-recorder";
const STORE_NAME = "drafts";
const DRAFT_KEY = "current";

export interface RecordingDraft {
  blob: Blob;
  seconds: number;
  savedAt: number;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraft(draft: RecordingDraft): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(draft, DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.error("Failed to save recording draft", error);
  }
}

export async function getDraft(): Promise<RecordingDraft | null> {
  try {
    const db = await openDb();
    const draft = await new Promise<RecordingDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const req = tx.objectStore(STORE_NAME).get(DRAFT_KEY);
      req.onsuccess = () => resolve((req.result as RecordingDraft | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return draft;
  } catch (error) {
    console.error("Failed to read recording draft", error);
    return null;
  }
}

export async function clearDraft(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (error) {
    console.error("Failed to clear recording draft", error);
  }
}
