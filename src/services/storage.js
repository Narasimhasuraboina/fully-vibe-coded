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

const accountId = (profile) => {
  const tag = typeof profile === 'string' ? profile : profile?.tag || profile?.username;
  return String(tag || '').trim().toLowerCase().replace(/[^a-z0-9_@-]/g, '_');
};

export const loadAccountState = (profile, key, defaultValue) => {
  const id = accountId(profile);
  return id ? loadState(`account_${id}_${key}`, defaultValue) : defaultValue;
};

export const saveAccountState = (profile, key, value) => {
  const id = accountId(profile);
  if (id) saveState(`account_${id}_${key}`, value);
};
