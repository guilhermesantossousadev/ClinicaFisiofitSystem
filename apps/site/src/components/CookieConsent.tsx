import { useEffect, useState } from "react";
import { Link } from "wouter";

const CONSENT_KEY = "fisiofit_cookie_consent_v1";
const GOOGLE_ADS_ID = "AW-18345626740";
type Consent = { version: 1; advertising: boolean; decidedAt: string };

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
}

function applyAdvertisingConsent(allowed: boolean) {
  window.dataLayer = window.dataLayer ?? [];
  window.gtag = window.gtag ?? ((...args: unknown[]) => window.dataLayer?.push(args));
  window.gtag("consent", "update", {
    ad_storage: allowed ? "granted" : "denied",
    ad_user_data: allowed ? "granted" : "denied",
    ad_personalization: allowed ? "granted" : "denied",
    analytics_storage: "denied",
  });
  if (!allowed || document.querySelector("script[data-fisiofit-google-ads]")) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`;
  script.dataset.fisiofitGoogleAds = "true";
  script.onload = () => {
    window.gtag?.("js", new Date());
    window.gtag?.("config", GOOGLE_ADS_ID);
  };
  document.head.appendChild(script);
}

export default function CookieConsent() {
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState(false);
  const [advertising, setAdvertising] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) setOpen(true);
    else try {
      const consent = JSON.parse(stored) as Consent;
      setAdvertising(consent.advertising === true);
      applyAdvertisingConsent(consent.advertising === true);
    } catch {
      localStorage.removeItem(CONSENT_KEY);
      setOpen(true);
    }
    const reopen = () => { setDetails(true); setOpen(true); };
    window.addEventListener("fisiofit:cookie-settings", reopen);
    return () => window.removeEventListener("fisiofit:cookie-settings", reopen);
  }, []);

  function save(next: boolean) {
    const consent: Consent = { version: 1, advertising: next, decidedAt: new Date().toISOString() };
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    setAdvertising(next);
    applyAdvertisingConsent(next);
    setOpen(false);
  }

  if (!open) return null;
  return <div className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-2xl border border-line bg-white p-5 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="cookie-title">
    <h2 id="cookie-title" className="text-lg font-black text-navy">Sua privacidade importa</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Usamos armazenamento essencial para registrar sua escolha. Cookies publicitários do Google só serão ativados com sua autorização.</p>
    {details && <label className="mt-4 flex items-start justify-between gap-6 rounded-xl bg-surface p-4 text-sm"><span><strong className="block text-navy">Publicidade</strong><span className="text-muted-foreground">Medição de campanhas e publicidade do Google.</span></span><input type="checkbox" checked={advertising} onChange={(event) => setAdvertising(event.target.checked)} className="mt-1 h-5 w-5" /></label>}
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <button onClick={() => save(true)} className="rounded-xl bg-blue px-5 py-3 text-sm font-extrabold text-white">Aceitar</button>
      <button onClick={() => save(false)} className="rounded-xl border border-line px-5 py-3 text-sm font-extrabold text-navy">Recusar</button>
      <button onClick={() => details ? save(advertising) : setDetails(true)} className="rounded-xl border border-line px-5 py-3 text-sm font-extrabold text-navy">{details ? "Salvar escolhas" : "Configurar"}</button>
      <Link href="/cookies" className="text-sm font-bold text-blue underline">Política de Cookies</Link>
    </div>
  </div>;
}
