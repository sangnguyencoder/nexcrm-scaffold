import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

export type AuthPersistenceMode = "local" | "session";

const AUTH_STORAGE_MODE_KEY = "nexcrm_auth_persistence";
const SUPABASE_STORAGE_KEY_PREFIX = "sb-";

function canUseBrowserStorage() {
  return typeof window !== "undefined";
}

function getBrowserStorage(mode: AuthPersistenceMode) {
  if (!canUseBrowserStorage()) {
    return null;
  }

  return mode === "session" ? window.sessionStorage : window.localStorage;
}

function getSupabaseStorageKeys(storage: Storage) {
  const keys: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (key?.startsWith(SUPABASE_STORAGE_KEY_PREFIX)) {
      keys.push(key);
    }
  }

  return keys;
}

function readStorageMode(): AuthPersistenceMode {
  if (!canUseBrowserStorage()) {
    return "local";
  }

  const sessionMode = window.sessionStorage.getItem(AUTH_STORAGE_MODE_KEY);
  if (sessionMode === "session" || sessionMode === "local") {
    return sessionMode;
  }

  return window.localStorage.getItem(AUTH_STORAGE_MODE_KEY) === "session" ? "session" : "local";
}

function writeStorageMode(mode: AuthPersistenceMode) {
  if (!canUseBrowserStorage()) {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_MODE_KEY, mode);
  window.sessionStorage.setItem(AUTH_STORAGE_MODE_KEY, mode);
}

function copySupabaseSession(source: Storage, target: Storage) {
  for (const key of getSupabaseStorageKeys(source)) {
    const value = source.getItem(key);

    if (value !== null) {
      target.setItem(key, value);
    }
  }
}

function clearSupabaseSession(storage: Storage) {
  for (const key of getSupabaseStorageKeys(storage)) {
    storage.removeItem(key);
  }
}

export function getSupabaseSessionPersistenceMode() {
  return readStorageMode();
}

export function setSupabaseSessionPersistence(rememberMe: boolean) {
  if (!canUseBrowserStorage()) {
    return;
  }

  const nextMode: AuthPersistenceMode = rememberMe ? "local" : "session";
  const currentMode = readStorageMode();

  if (currentMode === nextMode) {
    writeStorageMode(nextMode);
    return;
  }

  const currentStorage = getBrowserStorage(currentMode);
  const nextStorage = getBrowserStorage(nextMode);

  if (currentStorage && nextStorage) {
    copySupabaseSession(currentStorage, nextStorage);
    clearSupabaseSession(currentStorage);
  }

  writeStorageMode(nextMode);
}

export function clearSupabaseStoredSession() {
  if (!canUseBrowserStorage()) {
    return;
  }

  clearSupabaseSession(window.localStorage);
  clearSupabaseSession(window.sessionStorage);
}

const storageAdapter = {
  getItem(key: string) {
    if (!canUseBrowserStorage()) {
      return null;
    }

    const preferredStorage = getBrowserStorage(readStorageMode());
    return (
      preferredStorage?.getItem(key) ??
      window.localStorage.getItem(key) ??
      window.sessionStorage.getItem(key)
    );
  },
  setItem(key: string, value: string) {
    getBrowserStorage(readStorageMode())?.setItem(key, value);
  },
  removeItem(key: string) {
    if (!canUseBrowserStorage()) {
      return;
    }

    window.localStorage.removeItem(key);
    window.sessionStorage.removeItem(key);
  },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: storageAdapter,
  },
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
