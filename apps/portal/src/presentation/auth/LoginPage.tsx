import { FormEvent, useEffect, useState } from "react";
import { Redirect } from "wouter";
import {
  loginErrorMessage,
  normalizeLoginEmail,
  recoveryErrorMessage,
  sessionExpiredNoticeKey,
} from "../../application/portal/authAccess";
import {
  isSupabaseConfigured,
  passwordRecoveryRedirectUrl,
  supabase,
} from "../../infrastructure/supabase/client";
import { useAuth } from "./AuthProvider";
import { TextField } from "../components/FormPrimitives";

const recoveryCooldownSeconds = 60;
const recoveryRequestStorageKey = "fisiofit:password-recovery-request";

type RecoveryRequest = {
  email: string;
  requestedAt: number;
};

function readRecoveryRequest(): RecoveryRequest | null {
  try {
    const saved = window.sessionStorage.getItem(recoveryRequestStorageKey);
    if (!saved) return null;
    const parsed = JSON.parse(saved) as Partial<RecoveryRequest>;
    return typeof parsed.email === "string" && typeof parsed.requestedAt === "number"
      ? { email: parsed.email, requestedAt: parsed.requestedAt }
      : null;
  } catch {
    return null;
  }
}

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
  const [busyAction, setBusyAction] = useState<"login" | "recovery" | null>(null);
  const [recoveryRequest, setRecoveryRequest] = useState<RecoveryRequest | null>(readRecoveryRequest);
  const [recoveryWait, setRecoveryWait] = useState(0);

  useEffect(() => {
    if (!initialNotice) return;
    try {
      window.sessionStorage.removeItem(sessionExpiredNoticeKey);
    } catch {
      // A mensagem já está em memória para esta exibição.
    }
  }, [initialNotice]);

  useEffect(() => {
    if (!recoveryRequest) {
      setRecoveryWait(0);
      return;
    }
    const updateWait = () => {
      const elapsed = Math.floor((Date.now() - recoveryRequest.requestedAt) / 1000);
      setRecoveryWait(Math.max(0, recoveryCooldownSeconds - elapsed));
    };
    updateWait();
    const timer = window.setInterval(updateWait, 1000);
    return () => window.clearInterval(timer);
  }, [recoveryRequest]);

  useEffect(() => {
    if (recoveryRequest && !email) setEmail(recoveryRequest.email);
  }, [email, recoveryRequest]);

  if (!loading && session) return <Redirect to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusyAction("login");
    setError("");
    setMessage("");
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: normalizeLoginEmail(email),
        password,
      });
      if (authError) setError(loginErrorMessage(authError));
    } catch (authError) {
      setError(loginErrorMessage(authError));
    } finally {
      setBusyAction(null);
    }
  }

  async function requestPassword() {
    setError("");
    setMessage("");
    const normalizedEmail = normalizeLoginEmail(email || recoveryRequest?.email || "");
    if (!normalizedEmail || !/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("Informe um e-mail válido, como nome@empresa.com.br.");
      return;
    }
    if (recoveryWait > 0) return;

    setBusyAction("recovery");
    try {
      const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: passwordRecoveryRedirectUrl(),
      });
      if (recoveryError) {
        setError(recoveryErrorMessage(recoveryError));
        return;
      }
      const nextRequest = { email: normalizedEmail, requestedAt: Date.now() };
      setRecoveryRequest(nextRequest);
      setRecoveryWait(recoveryCooldownSeconds);
      setMessage("");
      try {
        window.sessionStorage.setItem(recoveryRequestStorageKey, JSON.stringify(nextRequest));
      } catch {
        // O feedback continua visível mesmo quando o navegador bloqueia o armazenamento.
      }
    } catch (recoveryError) {
      setError(recoveryErrorMessage(recoveryError));
    } finally {
      setBusyAction(null);
    }
  }

  function changeRecoveryEmail() {
    setRecoveryRequest(null);
    setRecoveryWait(0);
    setEmail("");
    setError("");
    try {
      window.sessionStorage.removeItem(recoveryRequestStorageKey);
    } catch {
      // A solicitação pode ser refeita mesmo sem armazenamento disponível.
    }
    window.requestAnimationFrame(() => document.getElementById("recovery-email")?.focus());
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
                id="recovery-email"
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
          {message && <div className="login-success" role="status" aria-live="polite">{message}</div>}
          {recoveryRequest && (
            <section className="recovery-status" aria-labelledby="recovery-status-title">
              <p className="sr-only" role="status" aria-live="polite">
                Pedido de redefinição registrado para {recoveryRequest.email}.
              </p>
              <span className="recovery-status-icon" aria-hidden="true">✓</span>
              <div>
                <strong id="recovery-status-title">Pedido de redefinição registrado</strong>
                <p>
                  Se houver uma conta ativa para <b>{recoveryRequest.email}</b>, o link será enviado para esse endereço.
                </p>
                <ol>
                  <li>Aguarde alguns minutos e atualize a caixa de entrada.</li>
                  <li>Confira Spam, Lixeira e a busca por “Fisiofit” ou “Supabase”.</li>
                  <li>Abra somente o link do e-mail mais recente neste navegador.</li>
                </ol>
                <div className="recovery-status-actions">
                  <button
                    className="btn secondary"
                    type="button"
                    onClick={requestPassword}
                    disabled={busyAction !== null || recoveryWait > 0}
                  >
                    {busyAction === "recovery"
                      ? "Solicitando novo link…"
                      : recoveryWait > 0
                        ? `Reenviar em ${recoveryWait}s`
                        : "Reenviar link"}
                  </button>
                  <button className="login-recovery" type="button" onClick={changeRecoveryEmail} disabled={busyAction !== null}>
                    Usar outro e-mail
                  </button>
                </div>
              </div>
            </section>
          )}
          <button className="btn primary login-submit" disabled={busyAction !== null || !isSupabaseConfigured}>
            {busyAction === "login" ? "Entrando…" : "Entrar com segurança"}
          </button>
          <div className="login-actions">
            {!recoveryRequest && (
              <button
                className="login-recovery"
                type="button"
                onClick={requestPassword}
                disabled={busyAction !== null || !isSupabaseConfigured}
              >
                {busyAction === "recovery" ? "Solicitando link…" : "Enviar link de redefinição"}
              </button>
            )}
            <a href="mailto:administracao@fisiofit.com.br" className="login-support-link">
              Precisa de acesso? Fale com a administradora
            </a>
          </div>
        </form>
      </section>
    </main>
  );
}
