import { getSupabaseSessionPersistenceMode } from "@/lib/supabase";

const REMEMBERED_LOGIN_IDENTIFIER_KEY = "nexcrm_login_identifier";

function canUseStorage() {
  return typeof window !== "undefined";
}

export function readRememberedLoginIdentifier() {
  if (!canUseStorage()) {
    return "";
  }

  return window.localStorage.getItem(REMEMBERED_LOGIN_IDENTIFIER_KEY) ?? "";
}

export function persistRememberedLoginIdentifier(identifier: string, rememberMe: boolean) {
  if (!canUseStorage()) {
    return;
  }

  if (!rememberMe) {
    window.localStorage.removeItem(REMEMBERED_LOGIN_IDENTIFIER_KEY);
    return;
  }

  const normalized = identifier.trim();

  if (!normalized) {
    window.localStorage.removeItem(REMEMBERED_LOGIN_IDENTIFIER_KEY);
    return;
  }

  window.localStorage.setItem(REMEMBERED_LOGIN_IDENTIFIER_KEY, normalized);
}

export function getDefaultRememberMeValue() {
  return getSupabaseSessionPersistenceMode() === "local";
}
