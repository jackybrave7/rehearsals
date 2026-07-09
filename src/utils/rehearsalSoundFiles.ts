const DB_NAME = 'rehearsals-sound-files';
const STORE_NAME = 'tracks';
const DB_VERSION = 1;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

function trackFileKey(rehearsalId: string, trackId: string): string {
  return `${rehearsalId}:${trackId}`;
}

export async function saveRehearsalSoundFile(
  rehearsalId: string,
  trackId: string,
  file: Blob
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
    tx.objectStore(STORE_NAME).put(file, trackFileKey(rehearsalId, trackId));
  });
}

export async function loadRehearsalSoundFile(
  rehearsalId: string,
  trackId: string
): Promise<Blob | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    tx.oncomplete = () => db.close();
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB read failed'));
    const request = tx.objectStore(STORE_NAME).get(trackFileKey(rehearsalId, trackId));
    request.onsuccess = () => resolve((request.result as Blob | undefined) ?? null);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB get failed'));
  });
}

export async function deleteRehearsalSoundFile(rehearsalId: string, trackId: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error ?? new Error('IndexedDB delete failed'));
    tx.objectStore(STORE_NAME).delete(trackFileKey(rehearsalId, trackId));
  });
}
