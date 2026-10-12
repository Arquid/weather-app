export const readSetting = (key, fallback) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

export const saveSetting = (key, value) => {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Storage is blocked: the setting isn't remembered.
  }
};