import type { Session, User } from "@supabase/supabase-js";
import { createContext, Fragment, useContext, useEffect, useMemo, useRef, useState } from "react";
import { bindPortalSessionToUser, clearPortalSessionState } from "../../infrastructure/session/portalSessionState";
import { supabase } from "../../infrastructure/supabase/client";

type AuthState = {
  loading: boolean;
  session: Session | null;
  user: User | null;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const currentUserId = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
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
      applySession(next);
    });

    async function restoreSession() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const hash = new URLSearchParams(url.hash.slice(1));
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");

      let nextSession: Session | null = null;

      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) nextSession = data.session;
      } else if (accessToken && refreshToken) {
        const { data, error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });
        if (!error) nextSession = data.session;
      } else {
        const { data } = await supabase.auth.getSession();
        nextSession = data.session;
      }

      if (!active) return;

      if (code || accessToken) {
        window.history.replaceState({}, document.title, url.pathname);
      }

      applySession(nextSession);
    }

    void restoreSession();

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
      signOut: async () => {
        clearPortalSessionState();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      },
    }),
    [loading, session],
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
