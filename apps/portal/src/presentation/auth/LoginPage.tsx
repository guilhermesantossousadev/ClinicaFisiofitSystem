import { FormEvent, useEffect, useState } from "react";
import { Redirect } from "wouter";
import {
  loginErrorMessage,
  normalizeLoginEmail,
  sessionExpiredNoticeKey,
} from "../../application/portal/authAccess";
import { isSupabaseConfigured, supabase } from "../../infrastructure/supabase/client";
import { useAuth } from "./AuthProvider";
import { TextField } from "../components/FormPrimitives";

export default function LoginPage() {
  const { session, loading } = useAuth();
  const [initialNotice] = useState(() => {
    try {
      return window.sessionStorage.getItem(sessionExpiredNoticeKey) ?? "";
    } catch {
      return "";
    }
  });
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState(initialNotice);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!initialNotice) return;
    try {
      window.sessionStorage.removeItem(sessionExpiredNoticeKey);
    } catch {
      // A mensagem já está em memória para esta exibição.
    }
  }, [initialNotice]);

  if (!loading && session) return <Redirect to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: normalizeLoginEmail(email),
      password,
    });
    setBusy(false);
    if (authError) setError(loginErrorMessage(authError));
  }

  async function requestPassword() {
    setError("");
    setMessage("");
    const normalizedEmail = normalizeLoginEmail(email);
    if (!normalizedEmail) {
      setError("Informe seu e-mail para receber o link de criação de senha.");
      return;
    }

    setBusy(true);
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: `${window.location.origin}/sistema/set-password`,
    });
    setBusy(false);

    if (recoveryError) {
      setError("Não foi possível enviar o link agora. Tente novamente em instantes.");
      return;
    }

    setMessage("Enviamos um link seguro para seu e-mail. Abra a mensagem neste computador.");
  }

  return (
    <main className="login-page">
      <section className="login-brand-panel">
        <img src="/sistema/logo-fisiofit.svg" alt="Fisiofit Pilates e Fisioterapia" />
        <div>
          <p>GESTÃO CLÍNICA</p>
          <h1>Cuidado organizado.<br />Decisões mais tranquilas.</h1>
          <span>Agenda, prontuários, planos e financeiro em um só lugar.</span>
        </div>
      </section>
      <section className="login-form-panel">
        <form className="login-card" onSubmit={submit}>
          <img src="/sistema/fisiofit-logo.jpg" alt="" />
          <p className="eyebrow">ÁREA DA CLÍNICA</p>
          <h2>Bem-vinda de volta</h2>
          <p>Entre com a conta criada pela administradora.</p>
          {!isSupabaseConfigured && (
            <div className="environment-warning">
              Ambiente local: conecte o projeto Supabase para habilitar o acesso.
            </div>
          )}
          <div className="form-field-group">
            <TextField
                label="E-mail profissional"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="voce@fisiofit.com.br"
                required
              />
          </div>
          <div className="form-field-group">
            <TextField
                label="Sua senha"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          {message && <div className="login-success" role="status">{message}</div>}
          <button className="btn primary login-submit" disabled={busy || !isSupabaseConfigured}>
            {busy ? "Entrando…" : "Entrar com segurança"}
          </button>
          <div className="login-actions">
            <button
              className="login-recovery"
              type="button"
              onClick={requestPassword}
              disabled={busy || !isSupabaseConfigured}
            >
              Esqueci ou ainda não tenho senha
            </button>
            <a href="mailto:administracao@fisiofit.com.br" className="login-support-link">
              Precisa de acesso? Fale com a administradora
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}
