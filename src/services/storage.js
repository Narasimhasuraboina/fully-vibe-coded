export const loadState = (key, defaultValue) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return defaultValue;
    const saved = localStorage.getItem(`chatforge_${key}`);
    if (saved !== null && saved !== undefined && saved !== 'undefined' && saved !== 'null') {
      const parsed = JSON.parse(saved);
      if (parsed !== null && parsed !== undefined) {
        return parsed;
      }
    }
  } catch (e) {
    console.error(`Error loading state ${key}`, e);
  }
  return defaultValue;
};

export const saveState = (key, value) => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    if (value === undefined || value === null) {
      localStorage.removeItem(`chatforge_${key}`);
    } else {
      localStorage.setItem(`chatforge_${key}`, JSON.stringify(value));
    }
  } catch (e) {
    console.error(`Error saving state ${key}`, e);
  }
};
