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
import { api } from "./infrastructure/http/api";
import { isSupabaseConfigured } from "./infrastructure/supabase/client";
import "./presentation/styles/index.css";
import "./presentation/styles/portal-enhancements.css";

for (const [name, value] of Object.entries(brandCssVariables)) {
  document.documentElement.style.setProperty(name, value);
}

const FisiofitApp = lazy(() => import("./presentation/app/FisiofitApp"));

function ProtectedApp() {
  const { loading, session } = useAuth();
  const localPreview =
    (window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1") &&
    new URLSearchParams(window.location.search).get("preview") === "1";
  const [access, setAccess] = React.useState<"checking" | "allowed" | "mfa" | "denied">("checking");
  React.useEffect(() => {
    if (localPreview || !session || !isSupabaseConfigured) {
      setAccess("allowed");
      return;
    }
    setAccess("checking");
    void api("/me")
      .then(() => setAccess("allowed"))
      .catch((error: Error & { apiError?: { code?: string } }) => {
        setAccess(error.apiError?.code === "MFA_REQUIRED" ? "mfa" : "denied");
      });
  }, [localPreview, session]);
  if (loading) return <div className="auth-loading">Carregando ambiente seguro…</div>;
  if (!localPreview && !session && isSupabaseConfigured) return <Redirect to="/login" replace />;
  if (access === "checking") return <div className="auth-loading">Validando permissões…</div>;
  if (access === "mfa") return <Redirect to="/mfa" replace />;
  if (access === "denied") return <Redirect to="/onboarding" replace />;
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
