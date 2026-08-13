import { FormEvent, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { api } from "../../infrastructure/http/api";
import { useAuth } from "./AuthProvider";
import { TextField } from "../components/FormPrimitives";

export default function OnboardingPage() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const [clinicName, setClinicName] = useState("Clínica Fisiofit");
  const [adminName, setAdminName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!session) return <Redirect to="/login" replace />;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/bootstrap", {
        method: "POST",
        body: JSON.stringify({ clinicName, adminName }),
      });
      navigate("/mfa", { replace: true });
    } catch {
      setError("A configuração inicial já foi concluída ou sua conta precisa ser convidada pela administradora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mfa-page">
      <form className="login-card mfa-card" onSubmit={submit}>
        <img src="/sistema/fisiofit-logo.jpg" alt="" />
        <p className="eyebrow">PRIMEIRO ACESSO</p>
        <h2>Vamos preparar a clínica</h2>
        <p>Somente a primeira administradora pode concluir esta etapa. As unidades serão cadastradas depois.</p>
        <div className="form-field-group">
          <TextField
            label="Nome da clínica"
              value={clinicName}
              onChange={(event) => setClinicName(event.target.value)}
              placeholder="Ex: Fisiofit Pilates"
              required
              minLength={3}
            />
        </div>
        <div className="form-field-group">
          <TextField
            label="Seu nome completo"
              value={adminName}
              onChange={(event) => setAdminName(event.target.value)}
              placeholder="Ex: Dra. Mariana Silva"
              required
              minLength={3}
            />
        </div>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="btn primary login-submit" disabled={busy}>
          {busy ? "Preparando…" : "Criar ambiente seguro"}
        </button>
      </form>
    </main>
  );
}
