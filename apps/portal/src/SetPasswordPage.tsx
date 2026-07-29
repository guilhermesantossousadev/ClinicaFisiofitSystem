import { FormEvent, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "./AuthProvider";
import { api } from "./api";
import { supabase } from "./supabase";

export default function SetPasswordPage() {
  const { loading, session } = useAuth();
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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      const message = updateError.message.toLowerCase();
      const passwordAlreadyDefined =
        message.includes("same password") ||
        message.includes("different from the old password") ||
        message.includes("different from old password");

      if (!passwordAlreadyDefined) {
        setBusy(false);
        setError(
          message.includes("weak") || message.includes("password")
            ? "A senha não atende aos requisitos de segurança. Use pelo menos 10 caracteres, com letras e números."
            : "Seu link expirou. Volte ao login e solicite um novo link.",
        );
        return;
      }
    }

    try {
      await api("/me");
      navigate("/", { replace: true });
    } catch (accessError) {
      const code = (accessError as Error & { apiError?: { code?: string } }).apiError?.code;
      navigate(code === "MFA_REQUIRED" ? "/mfa" : "/onboarding", { replace: true });
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
        <label>
          Nova senha
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <label>
          Confirmar senha
          <input
            type="password"
            autoComplete="new-password"
            minLength={10}
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            required
          />
        </label>
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
