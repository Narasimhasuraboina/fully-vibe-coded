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
  } catch (e) {
    console.error(`Error saving state ${key}`, e);
  }
};
