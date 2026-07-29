import { FormEvent, useState } from "react";
import { Redirect } from "wouter";
import { isSupabaseConfigured, supabase } from "./supabase";
import { useAuth } from "./AuthProvider";

export default function LoginPage() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!loading && session) return <Redirect to="/" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (authError) setError("E-mail ou senha inválidos.");
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
          <label>
            E-mail
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="voce@fisiofit.com.br"
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              minLength={8}
              required
            />
          </label>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button className="btn primary login-submit" disabled={busy || !isSupabaseConfigured}>
            {busy ? "Entrando…" : "Entrar com segurança"}
          </button>
          <a href="mailto:administracao@fisiofit.com.br">Precisa de acesso? Fale com a administradora</a>
        </form>
      </section>
    </main>
  );
}
