import { useAuthStore } from "@/store/authStore";

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const profile = useAuthStore((state) => state.profile);
  const role = useAuthStore((state) => state.role);
  const orgId = useAuthStore((state) => state.orgId);
  const isLoading = useAuthStore((state) => state.isLoading);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const initialized = useAuthStore((state) => state.initialized);
  const isInitializing = useAuthStore((state) => state.isInitializing);
  const login = useAuthStore((state) => state.login);
  const logout = useAuthStore((state) => state.logout);
  const initialize = useAuthStore((state) => state.initialize);
  const requestPasswordReset = useAuthStore((state) => state.requestPasswordReset);
  const updatePassword = useAuthStore((state) => state.updatePassword);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);

  return {
    user,
    profile,
    role,
    orgId,
    isLoading,
    isAuthenticated,
    initialized,
    isInitializing,
    login,
    logout,
    initialize,
    requestPasswordReset,
    updatePassword,
    signInWithGoogle,
  };
}
