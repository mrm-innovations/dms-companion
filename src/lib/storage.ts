type StoreRecord = Record<string, unknown>;

const memoryStore = new Map<string, unknown>();

const getChromeStorage = (): chrome.storage.StorageArea | null => {
  if (typeof chrome !== "undefined" && chrome.storage?.local) {
    return chrome.storage.local;
  }

  return null;
};

export const getFromStorage = async <T>(key: string, fallback: T): Promise<T> => {
  const storage = getChromeStorage();

  if (storage) {
    const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
      storage.get(key, (items) => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve(items);
      });
    });
    return (result[key] as T | undefined) ?? fallback;
  }

  return (memoryStore.get(key) as T | undefined) ?? fallback;
};

export const setInStorage = async (values: StoreRecord): Promise<void> => {
  const storage = getChromeStorage();

  if (storage) {
    await new Promise<void>((resolve, reject) => {
      storage.set(values, () => {
        if (chrome.runtime?.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }

        resolve();
      });
    });
    return;
  }

  Object.entries(values).forEach(([key, value]) => {
    memoryStore.set(key, value);
  });
};
