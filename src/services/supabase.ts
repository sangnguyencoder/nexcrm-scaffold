import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase.generated";

export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export type AuthPersistenceMode = "local" | "session";

const AUTH_STORAGE_MODE_KEY = "nexcrm_auth_persistence";
const SUPABASE_STORAGE_KEY_PREFIX = "sb-";
const SUPABASE_SINGLETON_KEY = "__nexcrm_supabase_client__";

function canUseBrowserStorage() {
  if (typeof window === "undefined") {
    return false;
  }

  return Boolean(window.localStorage && window.sessionStorage);
}

function isStorageLike(value: unknown): value is Storage {
  return Boolean(
    value &&
      typeof value === "object" &&
      "getItem" in value &&
      typeof (value as Storage).getItem === "function" &&
      "setItem" in value &&
      typeof (value as Storage).setItem === "function" &&
      "removeItem" in value &&
      typeof (value as Storage).removeItem === "function",
  );
}

function getBrowserStorage(mode: AuthPersistenceMode) {
  if (!canUseBrowserStorage()) {
    return null;
  }

  const storage = mode === "session" ? window.sessionStorage : window.localStorage;
  return isStorageLike(storage) ? storage : null;
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

  const sessionStorage = getBrowserStorage("session");
  const localStorage = getBrowserStorage("local");
  if (!sessionStorage || !localStorage) {
    return "local";
  }

  const sessionMode = sessionStorage.getItem(AUTH_STORAGE_MODE_KEY);
  if (sessionMode === "session" || sessionMode === "local") {
    return sessionMode;
  }

  return localStorage.getItem(AUTH_STORAGE_MODE_KEY) === "session"
    ? "session"
    : "local";
}

function writeStorageMode(mode: AuthPersistenceMode) {
  if (!canUseBrowserStorage()) {
    return;
  }

  const localStorage = getBrowserStorage("local");
  const sessionStorage = getBrowserStorage("session");
  localStorage?.setItem(AUTH_STORAGE_MODE_KEY, mode);
  sessionStorage?.setItem(AUTH_STORAGE_MODE_KEY, mode);
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

  const localStorage = getBrowserStorage("local");
  const sessionStorage = getBrowserStorage("session");
  if (localStorage) {
    clearSupabaseSession(localStorage);
  }
  if (sessionStorage) {
    clearSupabaseSession(sessionStorage);
  }
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

    const localStorage = getBrowserStorage("local");
    const sessionStorage = getBrowserStorage("session");
    localStorage?.removeItem(key);
    sessionStorage?.removeItem(key);
  },
};

type SupabaseGlobal = typeof globalThis & {
  [SUPABASE_SINGLETON_KEY]?: SupabaseClient<Database>;
};

const globalScope = globalThis as SupabaseGlobal;

export const supabase =
  globalScope[SUPABASE_SINGLETON_KEY] ??
  createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: storageAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });

if (!globalScope[SUPABASE_SINGLETON_KEY]) {
  globalScope[SUPABASE_SINGLETON_KEY] = supabase;
}
