import type { User as SupabaseUser } from "@supabase/supabase-js";
import { create } from "zustand";

import { clearSupabaseStoredSession, setSupabaseSessionPersistence, supabase } from "@/lib/supabase";
import {
  requestPasswordReset as requestPasswordResetService,
  resolveLoginIdentifier,
  signInWithGoogle as signInWithGoogleService,
} from "@/services/authService";
import { runBestEffort } from "@/services/shared";
import type { User } from "@/types";

import {
  cacheProfileEmail,
  getCachedProfileEmail,
  toUser,
} from "@/services/shared";

type AuthState = {
  authUser: SupabaseUser | null;
  user: User | null;
  isLoading: boolean;
  isInitializing: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (
    identifier: string,
    password: string,
    options?: { rememberMe?: boolean },
  ) => Promise<void>;
  signInWithGoogle: (nextPath?: string, rememberMe?: boolean) => Promise<void>;
  requestPasswordReset: (identifier: string) => Promise<string>;
  updatePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

let authSubscriptionInitialized = false;

async function updateLastLogin(profileId: string) {
  await supabase
    .from("profiles")
    .update({ last_login_at: new Date().toISOString() })
    .eq("id", profileId);
}

async function enforceActiveProfile(resolved: {
  authUser: SupabaseUser | null;
  user: User | null;
}) {
  if (!resolved.user) {
    return resolved;
  }

  if (resolved.user.is_active) {
    return resolved;
  }

  await runBestEffort("auth.inactive-profile.signout", () => supabase.auth.signOut());
  clearSupabaseStoredSession();

  throw new Error("Tài khoản đang bị khóa. Vui lòng liên hệ quản trị viên.");
}

async function resolveProfile(authUser: SupabaseUser | null) {
  if (!authUser) {
    return {
      authUser: null,
      user: null,
    };
  }

  if (authUser.email) {
    cacheProfileEmail(authUser.id, authUser.email);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authUser.id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    authUser,
    user: data ? toUser(data, authUser.email ?? getCachedProfileEmail(authUser.id, "")) : null,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  authUser: null,
  user: null,
  isLoading: false,
  isInitializing: false,
  initialized: false,

  initialize: async () => {
    if (get().initialized && authSubscriptionInitialized) {
      return;
    }

    set({ isInitializing: true });

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }

      const resolved = await enforceActiveProfile(
        await resolveProfile(data.session?.user ?? null),
      );
      set({
        ...resolved,
        isInitializing: false,
        initialized: true,
      });
    } catch {
      set({
        authUser: null,
        user: null,
        isInitializing: false,
        initialized: true,
      });
    }

    if (!authSubscriptionInitialized) {
      authSubscriptionInitialized = true;

      supabase.auth.onAuthStateChange(async (_event, session) => {
        try {
          const resolved = await enforceActiveProfile(
            await resolveProfile(session?.user ?? null),
          );
          set({
            ...resolved,
            isLoading: false,
            isInitializing: false,
            initialized: true,
          });
        } catch {
          set({
            authUser: null,
            user: null,
            isLoading: false,
            isInitializing: false,
            initialized: true,
          });
        }
      });
    }
  },

  login: async (identifier, password, options) => {
    set({ isLoading: true });

    try {
      setSupabaseSessionPersistence(options?.rememberMe ?? true);
      const resolvedEmail =
        (await resolveLoginIdentifier(identifier)) ?? identifier.trim().toLowerCase();

      const { data, error } = await supabase.auth.signInWithPassword({
        email: resolvedEmail,
        password,
      });

      if (error) {
        throw error;
      }

      const resolved = await enforceActiveProfile(await resolveProfile(data.user));
      const resolvedUser = resolved.user;

      if (!resolvedUser) {
        await supabase.auth.signOut();
        clearSupabaseStoredSession();
        throw new Error("Tài khoản đã đăng nhập nhưng chưa có hồ sơ trong bảng profiles.");
      }

      void runBestEffort("auth.last-login", () => updateLastLogin(resolvedUser.id));

      set({
        ...resolved,
        isLoading: false,
        initialized: true,
      });
    } catch (error) {
      set({ isLoading: false, initialized: true });
      throw error;
    }
  },

  signInWithGoogle: async (nextPath = "/dashboard", rememberMe = true) => {
    set({ isLoading: true });

    try {
      await signInWithGoogleService(nextPath, rememberMe);
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  requestPasswordReset: async (identifier) => {
    return requestPasswordResetService(identifier);
  },

  updatePassword: async (password) => {
    set({ isLoading: true });

    try {
      const { data, error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      const resolved = await enforceActiveProfile(
        await resolveProfile(data.user ?? null),
      );

      set({
        ...resolved,
        isLoading: false,
        initialized: true,
      });
    } catch (error) {
      set({ isLoading: false, initialized: true });
      throw error;
    }
  },

  logout: async () => {
    set({ isLoading: true });

    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }

      clearSupabaseStoredSession();

      set({
        authUser: null,
        user: null,
        isLoading: false,
        isInitializing: false,
        initialized: true,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
