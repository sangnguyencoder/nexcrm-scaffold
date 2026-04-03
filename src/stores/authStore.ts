import type { User as SupabaseUser } from "@supabase/supabase-js";
import { create } from "zustand";

import { supabase } from "@/lib/supabase";
import type { User } from "@/types";

import {
  cacheProfileEmail,
  getCachedProfileEmail,
  type ProfileRow,
  toUser,
} from "@/services/shared";

type AuthState = {
  authUser: SupabaseUser | null;
  user: User | null;
  isLoading: boolean;
  initialized: boolean;
  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

let authSubscriptionInitialized = false;

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
  initialized: false,

  initialize: async () => {
    if (get().initialized && authSubscriptionInitialized) {
      return;
    }

    set({ isLoading: true });

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        throw error;
      }

      const resolved = await resolveProfile(data.session?.user ?? null);
      set({
        ...resolved,
        isLoading: false,
        initialized: true,
      });
    } catch {
      set({
        authUser: null,
        user: null,
        isLoading: false,
        initialized: true,
      });
    }

    if (!authSubscriptionInitialized) {
      authSubscriptionInitialized = true;

      supabase.auth.onAuthStateChange(async (_event, session) => {
        try {
          const resolved = await resolveProfile(session?.user ?? null);
          set({
            ...resolved,
            isLoading: false,
            initialized: true,
          });
        } catch {
          set({
            authUser: session?.user ?? null,
            user: null,
            isLoading: false,
            initialized: true,
          });
        }
      });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      const resolved = await resolveProfile(data.user);
      if (!resolved.user) {
        await supabase.auth.signOut();
        throw new Error("Tài khoản đã đăng nhập nhưng chưa có hồ sơ trong bảng profiles.");
      }

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

      set({
        authUser: null,
        user: null,
        isLoading: false,
        initialized: true,
      });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },
}));
