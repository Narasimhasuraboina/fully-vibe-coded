export const loadState = (key, defaultValue) => {
  try {
    const saved = localStorage.getItem(`chatforge_${key}`);
    if (saved !== null) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error(`Error loading state ${key}`, e);
  }
  return defaultValue;
};

export const saveState = (key, value) => {
  try {
    localStorage.setItem(`chatforge_${key}`, JSON.stringify(value));
    return true;
  } catch (e) {
    console.error(`Error saving state ${key}`, e);
    return false;
  }
};

export const accountId = (profile) => {
  const tag = typeof profile === 'string' ? profile : profile?.tag || profile?.username;
  return String(tag || '').trim().toLowerCase().replace(/[^a-z0-9_@-]/g, '_');
};

export const getContactId = (profileOrTag) => {
  const tag = typeof profileOrTag === 'string' ? profileOrTag : profileOrTag?.tag || profileOrTag?.username || profileOrTag?.id;
  return `contact_${String(tag || '').trim().toLowerCase().replace(/[^a-z0-9_@-]/g, '_')}`;
};

export const loadAccountState = (profile, key, defaultValue) => {
  const id = accountId(profile);
  return id ? loadState(`account_${id}_${key}`, defaultValue) : defaultValue;
};

export const saveAccountState = (profile, key, value) => {
  const id = accountId(profile);
  if (id) saveState(`account_${id}_${key}`, value);
};

let databasePromise;
function openChatforgeDatabase() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB is unavailable.'));
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('chatforge-data', 1);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (!database.objectStoreNames.contains('records')) database.createObjectStore('records', { keyPath: 'key' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Could not open local data storage.'));
      request.onblocked = () => reject(new Error('Local data storage upgrade is blocked.'));
    }).catch((error) => {
      databasePromise = null;
      throw error;
    });
  }
  return databasePromise;
}

export const loadDurableData = async (key, defaultValue) => {
  try {
    const database = await openChatforgeDatabase();
    const record = await new Promise((resolve, reject) => {
      const request = database.transaction('records', 'readonly').objectStore('records').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    if (record) return record.value;

    const legacy = loadState(key, undefined);
    if (legacy !== undefined) {
      const migrated = await saveDurableData(key, legacy);
      if (migrated) {
        try { localStorage.removeItem(`chatforge_${key}`); } catch { /* Storage may be unavailable. */ }
      }
      return legacy;
    }
  } catch (error) {
    console.warn('[STORAGE] IndexedDB read failed; using local storage fallback.', error);
    return loadState(key, defaultValue);
  }
  return defaultValue;
};

export const saveDurableData = async (key, value) => {
  try {
    const database = await openChatforgeDatabase();
    await new Promise((resolve, reject) => {
      const transaction = database.transaction('records', 'readwrite');
      transaction.objectStore('records').put({ key, value });
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Could not save local data.'));
      transaction.onabort = () => reject(transaction.error || new Error('Local data save was interrupted.'));
    });
    return true;
  } catch (error) {
    console.error('[STORAGE] IndexedDB write failed; trying local storage fallback.', error);
    return saveState(key, value);
  }
};
