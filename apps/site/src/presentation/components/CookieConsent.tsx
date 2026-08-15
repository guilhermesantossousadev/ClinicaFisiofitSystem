import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Link } from "wouter";

const CONSENT_KEY = "fisiofit_cookie_consent_v1";
const GOOGLE_ADS_ID = "AW-18345626740";
const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap";
const FOCUSABLE_SELECTOR = "a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex='-1'])";

type Consent = { version: 1; advertising: boolean; decidedAt: string };
type StoredConsent = { consent: Consent | null; storageAvailable: boolean };

declare global {
  interface Window { dataLayer?: unknown[]; gtag?: (...args: unknown[]) => void }
}

function isConsent(value: unknown): value is Consent {
  if (!value || typeof value !== "object") return false;
  const consent = value as Partial<Consent>;
  return consent.version === 1 && typeof consent.advertising === "boolean" && typeof consent.decidedAt === "string";
}

function readStoredConsent(): StoredConsent {
  try {
    const stored = window.localStorage.getItem(CONSENT_KEY);
    if (!stored) return { consent: null, storageAvailable: true };

    const parsed: unknown = JSON.parse(stored);
    if (isConsent(parsed)) return { consent: parsed, storageAvailable: true };

    window.localStorage.removeItem(CONSENT_KEY);
    return { consent: null, storageAvailable: true };
  } catch (error) {
    // Browsers can throw SecurityError when storage is disabled by policy or privacy settings.
    if (error instanceof DOMException && error.name === "SecurityError") {
      return { consent: null, storageAvailable: false };
    }
    return { consent: null, storageAvailable: false };
  }
}

function storeConsent(consent: Consent) {
  try {
    window.localStorage.setItem(CONSENT_KEY, JSON.stringify(consent));
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "SecurityError") return false;
    return false;
  }
}

function applyGoogleFontsConsent(allowed: boolean) {
  const stylesheet = document.querySelector<HTMLLinkElement>("link[data-fisiofit-google-fonts]");
  if (!allowed) {
    stylesheet?.remove();
    return;
  }
  if (stylesheet) return;

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = GOOGLE_FONTS_URL;
  link.dataset.fisiofitGoogleFonts = "true";
  document.head.appendChild(link);
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
  applyGoogleFontsConsent(allowed);

  const existingScript = document.querySelector<HTMLScriptElement>("script[data-fisiofit-google-ads]");
  if (!allowed) {
    existingScript?.remove();
    return;
  }
  if (existingScript) return;

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
  const [hasDecision, setHasDecision] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    applyAdvertisingConsent(false);
    const stored = readStoredConsent();
    setStorageAvailable(stored.storageAvailable);
    setHasDecision(stored.consent !== null);

    if (!stored.consent) {
      setOpen(true);
    } else {
      setAdvertising(stored.consent.advertising);
      applyAdvertisingConsent(stored.consent.advertising);
    }

    const reopen = () => {
      returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setDetails(true);
      setOpen(true);
    };
    window.addEventListener("fisiofit:cookie-settings", reopen);
    return () => window.removeEventListener("fisiofit:cookie-settings", reopen);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => dialogRef.current?.focus());

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      const returnTarget = returnFocusRef.current;
      returnFocusRef.current = null;
      if (returnTarget?.isConnected) window.requestAnimationFrame(() => returnTarget.focus());
    };
  }, [open]);

  function save(next: boolean) {
    const consent: Consent = { version: 1, advertising: next, decidedAt: new Date().toISOString() };
    setStorageAvailable(storeConsent(consent));
    setHasDecision(true);
    setAdvertising(next);
    applyAdvertisingConsent(next);
    setOpen(false);
  }

  function closeSettings() {
    if (hasDecision) setOpen(false);
    else save(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      closeSettings();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
    if (focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  if (!open) return null;
  return <div className="fixed inset-0 z-50 grid items-end bg-navy/45 p-3 sm:p-4" aria-hidden="false">
    <div ref={dialogRef} tabIndex={-1} onKeyDown={handleKeyDown} className="relative mx-auto max-h-[calc(100vh-1.5rem)] w-full max-w-3xl overflow-y-auto rounded-2xl border border-line bg-white p-5 shadow-2xl sm:max-h-[calc(100vh-2rem)]" role="dialog" aria-modal="true" aria-labelledby="cookie-title" aria-describedby="cookie-description cookie-storage-status">
      {hasDecision && <button type="button" onClick={closeSettings} className="absolute right-3 top-3 grid min-h-11 min-w-11 place-items-center rounded-full text-navy hover:bg-surface" aria-label="Fechar configurações de cookies"><X size={20} aria-hidden="true" /></button>}
      <h2 id="cookie-title" className="pr-12 text-lg font-black text-navy">Sua privacidade importa</h2>
      <p id="cookie-description" className="mt-2 text-sm leading-relaxed text-muted-foreground">Usamos armazenamento essencial para registrar sua escolha. O Google Ads e o Google Fonts só serão carregados com sua autorização.</p>
      {!storageAvailable && <p id="cookie-storage-status" role="status" className="mt-3 rounded-xl bg-surface p-3 text-sm text-navy">O navegador bloqueou o armazenamento local. Sua escolha vale nesta visita, mas poderá ser solicitada novamente.</p>}
      {storageAvailable && <span id="cookie-storage-status" className="sr-only">O armazenamento local está disponível para registrar sua escolha.</span>}
      {details && <label className="mt-4 flex items-start justify-between gap-6 rounded-xl bg-surface p-4 text-sm"><span><strong className="block text-navy">Publicidade e fonte externa</strong><span className="text-muted-foreground">Medição de campanhas pelo Google Ads e carregamento da fonte Manrope pelo Google Fonts.</span></span><input type="checkbox" checked={advertising} onChange={(event) => setAdvertising(event.target.checked)} className="mt-1 h-6 w-6 shrink-0" /></label>}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => save(true)} className="site-button px-5">Aceitar</button>
        <button type="button" onClick={() => save(false)} className="site-button-quiet px-5">Recusar</button>
        <button type="button" onClick={() => details ? save(advertising) : setDetails(true)} className="site-button-quiet px-5">{details ? "Salvar escolhas" : "Configurar"}</button>
        <Link href="/cookies" onClick={() => setOpen(false)} className="flex min-h-11 items-center text-sm font-bold text-blue underline">Política de Cookies</Link>
      </div>
    </div>
  </div>;
}
