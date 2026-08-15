import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Redirect, Route, Router, Switch } from "wouter";
import { appBasePath, brandCssVariables } from "@fisiofit/design-system";
import { AuthProvider, useAuth } from "./presentation/auth/AuthProvider";
import LoginPage from "./presentation/auth/LoginPage";
import MfaPage from "./presentation/auth/MfaPage";
import OnboardingPage from "./presentation/auth/OnboardingPage";
import SetPasswordPage from "./presentation/auth/SetPasswordPage";
import FormAccessibility from "./presentation/components/FormAccessibility";
import {
  classifyAccessFailure,
  sessionExpiredNotice,
  sessionExpiredNoticeKey,
} from "./application/portal/authAccess";
import { api } from "./infrastructure/http/api";
import { isSupabaseConfigured, supabase } from "./infrastructure/supabase/client";
import "./presentation/styles/index.css";
import "./presentation/styles/portal-enhancements.css";

for (const [name, value] of Object.entries(brandCssVariables)) {
  document.documentElement.style.setProperty(name, value);
}

const FisiofitApp = lazy(() => import("./presentation/app/FisiofitApp"));

function ProtectedApp() {
  const { loading, session, signOut } = useAuth();
  const localPreview =
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  const [access, setAccess] = React.useState<"checking" | "allowed" | "mfa" | "bootstrap" | "expired" | "issue">("checking");
  const [issue, setIssue] = React.useState<"membership" | "unavailable">("unavailable");
  const [validationAttempt, setValidationAttempt] = React.useState(0);
  const refreshAttempted = React.useRef(false);

  React.useEffect(() => {
    let active = true;
    if (localPreview || !session || !isSupabaseConfigured) {
      setAccess("allowed");
      refreshAttempted.current = false;
      return () => { active = false; };
    }
    setAccess("checking");
    void api("/me")
      .then(() => {
        if (!active) return;
        refreshAttempted.current = false;
        setAccess("allowed");
      })
      .catch(async (error: unknown) => {
        if (!active) return;
        const failure = classifyAccessFailure(error);
        if (failure === "mfa") {
          setAccess("mfa");
          return;
        }
        if (failure === "bootstrap") {
          setAccess("bootstrap");
          return;
        }
        if (failure === "session-expired") {
          try {
            window.sessionStorage.setItem(sessionExpiredNoticeKey, sessionExpiredNotice);
          } catch {
            // O redirecionamento ainda funciona quando o armazenamento está indisponível.
          }
          if (!refreshAttempted.current) {
            refreshAttempted.current = true;
            const { data, error: refreshError } = await supabase.auth.refreshSession();
            if (!refreshError && data.session) {
              try {
                window.sessionStorage.removeItem(sessionExpiredNoticeKey);
              } catch {
                // A sessão foi renovada; não há redirecionamento nem aviso a exibir.
              }
              return;
            }
          }
          await signOut();
          if (active) setAccess("expired");
          return;
        }
        setIssue(failure);
        setAccess("issue");
      });
    return () => { active = false; };
  }, [localPreview, session, signOut, validationAttempt]);

  if (loading) return <div className="auth-loading">Carregando ambiente seguro…</div>;
  if (!localPreview && !session && isSupabaseConfigured) return <Redirect to="/login" replace />;
  if (access === "checking") return <div className="auth-loading">Validando permissões…</div>;
  if (access === "mfa") return <Redirect to="/mfa" replace />;
  if (access === "bootstrap") return <Redirect to="/onboarding" replace />;
  if (access === "expired") return <Redirect to="/login" replace />;
  if (access === "issue") {
    return (
      <main className="mfa-page">
        <section className="login-card mfa-card" aria-labelledby="access-issue-title">
          <img src="/sistema/fisiofit-logo.jpg" alt="" />
          <p className="eyebrow">ACESSO AO PORTAL</p>
          <h2 id="access-issue-title">
            {issue === "membership" ? "Conta sem acesso ativo" : "Não foi possível validar o acesso"}
          </h2>
          <p>
            {issue === "membership"
              ? "Esta conta não está ativa nesta clínica. Saia e entre novamente; se o aviso continuar, acione o suporte técnico."
              : "Verifique sua conexão e tente novamente. Seu cadastro e suas configurações não foram alterados."}
          </p>
          <button
            type="button"
            className="btn primary login-submit"
            onClick={() => setValidationAttempt((attempt) => attempt + 1)}
          >
            Tentar novamente
          </button>
          <button type="button" className="login-recovery" onClick={() => void signOut()}>
            Sair e voltar ao login
          </button>
        </section>
      </main>
    );
  }
  return <Suspense fallback={<div className="auth-loading">Carregando módulos da clínica…</div>}><FisiofitApp /></Suspense>;
}

const container = document.getElementById("root");
if (!container) throw new Error("Elemento raiz do portal não encontrado.");

const rootWindow = window as Window & {
  __FISIOFIT_REACT_ROOT__?: ReturnType<typeof ReactDOM.createRoot>;
};
const root = rootWindow.__FISIOFIT_REACT_ROOT__ ?? ReactDOM.createRoot(container);
rootWindow.__FISIOFIT_REACT_ROOT__ = root;

root.render(
  <React.StrictMode>
    <Router base={appBasePath}>
      <AuthProvider>
        <FormAccessibility />
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/set-password" component={SetPasswordPage} />
          <Route path="/mfa" component={MfaPage} />
          <Route path="/onboarding" component={OnboardingPage} />
          <Route component={ProtectedApp} />
        </Switch>
      </AuthProvider>
    </Router>
  </React.StrictMode>,
);
