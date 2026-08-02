import { FormEvent, useEffect, useRef, useState } from "react";
import { Redirect, useLocation } from "wouter";
import { useAuth } from "./AuthProvider";
import { supabase } from "./supabase";

export default function MfaPage() {
  const { session } = useAuth();
  const [, navigate] = useLocation();
  const [factorId, setFactorId] = useState("");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const preparing = useRef(false);
  const requestedReturnTo = new URLSearchParams(window.location.search).get("returnTo");
  const returnTo = requestedReturnTo === "/set-password" ? "/set-password" : "/";

  useEffect(() => {
    if (!session) return;
    void prepare();
  }, [session]);

  async function prepare() {
    if (preparing.current) return;
    preparing.current = true;
    setBusy(true);
    setError("");

    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assurance?.currentLevel === "aal2") {
      setBusy(false);
      preparing.current = false;
      navigate(returnTo, { replace: true });
      return;
    }

    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      setError("Não foi possível consultar a proteção da conta.");
      setBusy(false);
      preparing.current = false;
      return;
    }

    const totpFactors =
      factors?.all.filter((factor) => factor.factor_type === "totp") ??
      factors?.totp ??
      [];
    const verified = totpFactors.find((factor) => factor.status === "verified");
    if (verified) {
      setFactorId(verified.id);
      setBusy(false);
      preparing.current = false;
      return;
    }

    const incompleteFactors = totpFactors.filter((factor) => factor.status !== "verified");
    for (const factor of incompleteFactors) {
      const { error: removeError } = await supabase.auth.mfa.unenroll({
        factorId: factor.id,
      });
      if (removeError) {
        setError("Não foi possível reiniciar a configuração. Saia da conta e entre novamente.");
        setBusy(false);
        preparing.current = false;
        return;
      }
    }

    const { data, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: "Fisiofit",
    });
    if (enrollError) {
      setError("Não foi possível preparar o segundo fator.");
      setBusy(false);
      preparing.current = false;
      return;
    }
    setFactorId(data.id);
    setQrCode(data.totp.qr_code);
    setSecret(data.totp.secret);
    setBusy(false);
    preparing.current = false;
  }

  async function regenerateQrCode() {
    setQrCode("");
    setSecret("");
    setFactorId("");
    setCode("");
    preparing.current = false;
    await prepare();
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId,
      code,
    });
    if (verifyError) {
      setBusy(false);
      setError("Código inválido. Confira o aplicativo autenticador.");
      return;
    }
    await supabase.auth.refreshSession();
    setBusy(false);
    navigate(returnTo, { replace: true });
  }

  if (!session) return <Redirect to="/login" replace />;

  return (
    <main className="mfa-page">
      <form className="login-card mfa-card" onSubmit={verify}>
        <img src="/sistema/fisiofit-logo.jpg" alt="" />
        <p className="eyebrow">PROTEÇÃO DA CONTA</p>
        <h2>Confirmação em duas etapas</h2>
        <p>{qrCode ? "Leia o QR code no seu aplicativo autenticador e digite o código gerado." : "Digite o código do seu aplicativo autenticador."}</p>
        {qrCode && <img className="mfa-qr" src={qrCode} alt="QR code para configurar o autenticador" />}
        {secret && <details><summary>Configurar manualmente</summary><code>{secret}</code></details>}
        {error && (
          <button className="login-recovery" type="button" onClick={regenerateQrCode} disabled={busy}>
            Gerar um novo QR Code
          </button>
        )}
        <label>
          Código de 6 dígitos
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
            placeholder="000000"
            required
          />
        </label>
        {error && <div className="login-error" role="alert">{error}</div>}
        <button className="btn primary login-submit" disabled={busy || code.length !== 6}>
          {busy ? "Verificando…" : "Confirmar e entrar"}
        </button>
      </form>
    </main>
  );
}
