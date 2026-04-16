import type { User } from "@supabase/supabase-js";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import {
  getCurrentSession,
  getProfileByUserId,
  resetPassword,
  signIn,
  signInWithGoogle,
  signOut,
  updatePassword,
  type AuthProfile,
} from "@/services/auth.service";
import { supabase } from "@/services/supabase";
import type { UserRole } from "@/types";
import { hasPermission, type PermissionKey } from "@/utils/permissions";

type LoginOptions = {
  rememberMe?: boolean;
};

type AuthStoreState = {
  authUser: User | null;
  user: User | null;
  profile: AuthProfile | null;
  role: UserRole | null;
  orgId: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  initialized: boolean;
  isInitializing: boolean;
  setAuth: (user: User, profile: AuthProfile) => void;
  clearAuth: () => void;
  setLoading: (value: boolean) => void;
  isAdmin: () => boolean;
  canAccess: (permission: PermissionKey) => boolean;
  initialize: () => Promise<void>;
  login: (identifier: string, password: string, options?: LoginOptions) => Promise<void>;
  signInWithGoogle: (nextPath?: string, rememberMe?: boolean) => Promise<void>;
  requestPasswordReset: (identifier: string) => Promise<string>;
  updatePassword: (password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const EMPTY_STORAGE = {
  getItem: (_name: string) => null,
  setItem: (_name: string, _value: string) => {},
  removeItem: (_name: string) => {},
};

let authListenerReady = false;
let initializePromise: Promise<void> | null = null;

function toRole(profile: AuthProfile | null): UserRole | null {
  const role = profile?.role;
  if (!role) {
    return null;
  }

  return role as UserRole;
}

function ensureActiveProfile(profile: AuthProfile | null): AuthProfile {
  if (!profile) {
    throw new Error("Tài khoản chưa được cấp hồ sơ profiles.");
  }

  if (!profile.is_active) {
    throw new Error("Tài khoản đã bị vô hiệu hóa.");
  }

  return profile;
}

export const useAuthStore = create<AuthStoreState>()(
  persist(
    (set, get) => ({
      authUser: null,
      user: null,
      profile: null,
      role: null,
      orgId: null,
      isLoading: false,
      isAuthenticated: false,
      initialized: false,
      isInitializing: false,

      setAuth: (user, profile) => {
        const role = toRole(profile);
        set({
          authUser: user,
          user,
          profile,
          role,
          orgId: profile.org_id,
          isAuthenticated: true,
          isLoading: false,
          initialized: true,
          isInitializing: false,
        });
      },

      clearAuth: () => {
        set({
          authUser: null,
          user: null,
          profile: null,
          role: null,
          orgId: null,
          isAuthenticated: false,
          isLoading: false,
          initialized: true,
          isInitializing: false,
        });
      },

      setLoading: (value) => {
        set({ isLoading: value });
      },

      isAdmin: () => {
        const role = get().role;
        return role === "super_admin" || role === "admin";
      },

      canAccess: (permission) => hasPermission(get().role, permission),

      initialize: async () => {
        if (initializePromise) {
          await initializePromise;
          return;
        }

        if (get().initialized && authListenerReady) {
          return;
        }

        initializePromise = (async () => {
          set({ isLoading: true, isInitializing: true });

          if (!authListenerReady) {
            authListenerReady = true;

            supabase.auth.onAuthStateChange((_event, session) => {
              globalThis.setTimeout(async () => {
                if (!session?.user) {
                  useAuthStore.getState().clearAuth();
                  return;
                }

                try {
                  const profile = await getProfileByUserId(session.user.id);
                  const activeProfile = ensureActiveProfile(profile);
                  useAuthStore.getState().setAuth(session.user, activeProfile);
                } catch {
                  useAuthStore.getState().clearAuth();
                }
              }, 0);
            });
          }

          try {
            const current = await getCurrentSession();
            if (!current?.session?.user) {
              get().clearAuth();
              return;
            }

            const activeProfile = ensureActiveProfile(current.profile);
            get().setAuth(current.session.user, activeProfile);
          } catch {
            get().clearAuth();
          }
        })();

        try {
          await initializePromise;
        } finally {
          initializePromise = null;
        }
      },

      login: async (identifier, password, options) => {
        set({ isLoading: true });

        try {
          const result = await signIn(identifier, password, options?.rememberMe ?? true);
          const activeProfile = ensureActiveProfile(result.profile);
          get().setAuth(result.user, activeProfile);
        } catch (error) {
          set({ isLoading: false, initialized: true, isInitializing: false });
          throw error;
        }
      },

      signInWithGoogle: async (nextPath = "/dashboard", rememberMe = true) => {
        set({ isLoading: true });
        try {
          await signInWithGoogle(nextPath, rememberMe);
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      requestPasswordReset: async (identifier) => resetPassword(identifier),

      updatePassword: async (password) => {
        set({ isLoading: true });

        try {
          await updatePassword(password);
          const current = await getCurrentSession();

          if (!current?.session?.user) {
            get().clearAuth();
            return;
          }

          const activeProfile = ensureActiveProfile(current.profile);
          get().setAuth(current.session.user, activeProfile);
        } catch (error) {
          set({ isLoading: false, initialized: true, isInitializing: false });
          throw error;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await signOut();
          get().clearAuth();
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },
    }),
    {
      name: "nexcrm-auth-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : EMPTY_STORAGE,
      ),
      partialize: (state) => ({
        user: state.user,
        profile: state.profile,
        role: state.role,
      }),
      merge: (persistedState, currentState) => {
        const persisted = persistedState as Partial<AuthStoreState>;
        const user = persisted.user ?? null;
        const profile = persisted.profile ?? null;
        const role = (persisted.role ?? toRole(profile)) as UserRole | null;

        return {
          ...currentState,
          ...persisted,
          authUser: user,
          user,
          profile,
          role,
          orgId: profile?.org_id ?? null,
          isAuthenticated: Boolean(user && profile),
          isLoading: false,
          isInitializing: false,
          initialized: false,
        };
      },
    },
  ),
);

export type { AuthStoreState };
