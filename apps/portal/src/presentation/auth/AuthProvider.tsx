import type { Session, User } from "@supabase/supabase-js";
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import { bindPortalSessionToUser, clearPortalSessionState } from "../../infrastructure/session/portalSessionState";
import { supabase } from "../../infrastructure/supabase/client";

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  callbackError: string | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [callbackError, setCallbackError] = useState<string | null>(null);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    let initialized = false;
    const applySession = (next: Session | null) => {
      if (!active) return;
      const nextUserId = next?.user.id ?? null;
      if (nextUserId) bindPortalSessionToUser(nextUserId);
      else if (currentUserId.current) clearPortalSessionState();
      currentUserId.current = nextUserId;
      setSession(next);
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, next) => {
      if (initialized) applySession(next);
    });

    async function restoreSession() {
      const url = new URL(window.location.href);
      const hash = new URLSearchParams(url.hash.slice(1));
      const callbackFailure =
        url.searchParams.get("error_description") ?? hash.get("error_description");
      const hasAuthCallback =
        url.searchParams.has("code") ||
        url.searchParams.has("error") ||
        hash.has("access_token") ||
        hash.has("error");
      const { data, error } = await supabase.auth.getSession();

      if (!active) return;

      initialized = true;
      if (hasAuthCallback) {
        window.history.replaceState({}, document.title, url.pathname);
      }
      if (callbackFailure || error) {
        setCallbackError("Este link de acesso é inválido ou expirou. Solicite um novo link no login.");
      }
      applySession(data.session);
    }

    void restoreSession().catch(() => {
      if (!active) return;
      initialized = true;
      setCallbackError("Não foi possível validar o link de acesso. Verifique sua conexão e tente novamente.");
      applySession(null);
    });

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      loading,
      session,
      user: session?.user ?? null,
      callbackError,
      signOut: async () => {
        clearPortalSessionState();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [callbackError, loading, session],
  );

  return (
    <AuthContext.Provider value={value}>
      <Fragment key={session?.user.id ?? "anonymous"}>{children}</Fragment>
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("useAuth deve estar dentro de AuthProvider");
  return state;
}
