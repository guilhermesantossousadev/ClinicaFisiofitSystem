import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { Redirect, Route, Router, Switch } from "wouter";
import { appBasePath, brandCssVariables } from "@fisiofit/design-system";
import { AuthProvider, useAuth } from "./AuthProvider";
import LoginPage from "./LoginPage";
import MfaPage from "./MfaPage";
import OnboardingPage from "./OnboardingPage";
import { api } from "./api";
import "./index.css";

for (const [name, value] of Object.entries(brandCssVariables)) {
  document.documentElement.style.setProperty(name, value);
}

const FisiofitApp = lazy(() => import("./FisiofitApp"));

function ProtectedApp() {
  const { loading, session } = useAuth();
  const [access, setAccess] = React.useState<"checking" | "allowed" | "mfa" | "denied">("checking");
  React.useEffect(() => {
    if (!session || !import.meta.env.PROD) {
      setAccess("allowed");
      return;
    }
    void api("/me")
      .then(() => setAccess("allowed"))
      .catch((error: Error & { apiError?: { code?: string } }) => {
        setAccess(error.apiError?.code === "MFA_REQUIRED" ? "mfa" : "denied");
      });
  }, [session]);
  if (loading) return <div className="auth-loading">Carregando ambiente seguro…</div>;
  if (!session && import.meta.env.PROD) return <Redirect to="/login" replace />;
  if (access === "checking") return <div className="auth-loading">Validando permissões…</div>;
  if (access === "mfa") return <Redirect to="/mfa" replace />;
  if (access === "denied") return <Redirect to="/onboarding" replace />;
  return <Suspense fallback={<div className="auth-loading">Carregando módulos da clínica…</div>}><FisiofitApp /></Suspense>;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Router base={appBasePath}>
      <AuthProvider>
        <Switch>
          <Route path="/login" component={LoginPage} />
          <Route path="/mfa" component={MfaPage} />
          <Route path="/onboarding" component={OnboardingPage} />
          <Route component={ProtectedApp} />
        </Switch>
      </AuthProvider>
    </Router>
  </React.StrictMode>,
);
