import { FormEvent, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "./AuthProvider";
import { api } from "../../infrastructure/http/api";
import { supabase } from "../../infrastructure/supabase/client";
import { TextField } from "../components/FormPrimitives";
import {
  classifyAccessFailure,
  sessionExpiredNotice,
  sessionExpiredNoticeKey,
} from "../../application/portal/authAccess";

export default function SetPasswordPage() {
  const { loading, session, signOut } = useAuth();
  const [, navigate] = useLocation();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="auth-loading">Validando o link seguro…</div>;
  if (!session) return <Redirect to="/login" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 10 || confirmation.length < 10) {
      setError("A senha precisa ter pelo menos 10 caracteres.");
      return;
    }
    if (password !== confirmation) {
      setError("As senhas precisam ser iguais.");
      return;
    }
    setBusy(true);
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError) {
      setBusy(false);
      setError("Não foi possível verificar a proteção da conta. Solicite um novo link e tente novamente.");
      return;
    }
    if (assurance?.nextLevel === "aal2" && assurance.currentLevel !== "aal2") {
      navigate("/mfa?returnTo=/set-password", { replace: true });
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      const message = updateError.message.toLowerCase();
      const insufficientAal =
        updateError.code === "insufficient_aal" ||
        message.includes("aal2") ||
        message.includes("assurance level");
      const passwordAlreadyDefined =
        message.includes("same password") ||
        message.includes("different from the old password") ||
        message.includes("different from old password");

      if (insufficientAal) {
        navigate("/mfa?returnTo=/set-password", { replace: true });
        return;
      }
      if (!passwordAlreadyDefined) {
        setBusy(false);
        setError(
          message.includes("weak") || message.includes("password")
            ? "A senha foi recusada por segurança. Use uma combinação inédita de pelo menos 10 caracteres, com letras, números e símbolo."
            : "Seu link expirou. Volte ao login e solicite um novo link.",
        );
        return;
      }
    }

    const { error: activationError } = await supabase.rpc("activate_own_profile");
    if (activationError) {
      setBusy(false);
      setError("A senha foi salva, mas não foi possível ativar o acesso. Tente novamente ou fale com a administradora.");
      return;
    }

    try {
      await api("/me");
      navigate("/", { replace: true });
    } catch (accessError) {
      const failure = classifyAccessFailure(accessError);
      if (failure === "session-expired") {
        try {
          window.sessionStorage.setItem(sessionExpiredNoticeKey, sessionExpiredNotice);
        } catch {
          // O login continua disponível sem o aviso persistido.
        }
        await signOut();
        navigate("/login", { replace: true });
      } else if (failure === "mfa") {
        navigate("/mfa", { replace: true });
      } else if (failure === "bootstrap") {
        navigate("/onboarding", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mfa-page">
      <form className="login-card mfa-card" onSubmit={submit}>
        <img src="/sistema/fisiofit-logo.jpg" alt="" />
        <p className="eyebrow">PRIMEIRO ACESSO</p>
        <h2>Crie sua senha</h2>
        <p>Use pelo menos 10 caracteres. Recomendamos letras, números e símbolos.</p>
        <div className="form-field-group">
          <TextField
            label="Nova senha"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Mínimo 10 caracteres"
              required
            />
        </div>
        <div className="form-field-group">
          <TextField
            label="Confirmar senha"
              type="password"
              autoComplete="new-password"
              minLength={10}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              placeholder="Digite exatamente a mesma senha"
              required
            />
        </div>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button
          type="submit"
          className="btn primary login-submit"
          disabled={busy}
        >
          {busy ? "Salvando…" : "Salvar senha e continuar"}
        </button>
      </form>
    </main>
  );
}
