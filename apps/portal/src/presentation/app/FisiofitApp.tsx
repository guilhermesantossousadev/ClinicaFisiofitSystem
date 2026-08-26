import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { api, list } from "../../infrastructure/http/api";
import { supabase } from "../../infrastructure/supabase/client";
import "../styles/portal-enhancements.css";
import { useAuth } from "../auth/AuthProvider";
import {
  OperationalAdministration,
  OperationalAgenda,
  OperationalDailyAttendance,
  OperationalEnrollments,
  OperationalFinance,
  OperationalPatients,
  OperationalPrivacy,
  OperationalRecords,
  OperationalReports,
  OperationalUsers,
} from "../modules/OperationalModules";
import type { AgendaEnrollmentContext } from "../modules/OperationalModules";
import type { DashboardData, Patient, PermissionModule, Profile, Unit, View } from "../../domain/portal";
import { isView, nav, navModule, roleLabel } from "../../application/portal/navigation";
const OperationalImports = lazy(() => import("../modules/OperationalImports"));
const sidebarGroups: Array<{ label: string; items: View[] }> = [
  { label: "Operação", items: ["Painel", "Agenda", "Chamada diária", "Pacientes", "Matrículas", "Prontuários"] },
  { label: "Gestão", items: ["Financeiro", "Relatórios", "Importações"] },
  { label: "Administração", items: ["Usuários", "Configurações", "Privacidade"] },
];
const brl = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );

function storedValue(key: string) {
  try {
    return window.localStorage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

function storeValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // O portal continua funcionando quando o navegador bloqueia armazenamento.
  }
}

function canViewModule(profile: Profile, module: PermissionModule) {
  return profile.role === "admin" || !profile.profile_permissions || profile.profile_permissions.some((permission) => permission.module === module && permission.can_view);
}

function canEditModule(profile: Profile, module: PermissionModule) {
  return profile.role === "admin" || !profile.profile_permissions || profile.profile_permissions.some((permission) => permission.module === module && permission.can_edit);
}

function Avatar({ initials, url, className = "" }: { initials: string; url?: string; className?: string }) {
  return url
    ? <img className={`avatar avatar-image ${className}`.trim()} src={url} alt="Foto do perfil" />
    : <span className={`avatar admin ${className}`.trim()} aria-hidden="true">{initials}</span>;
}

function compressAvatar(file: File) {
  if (!file.type.startsWith("image/")) return Promise.reject(new Error("Escolha uma imagem válida."));
  if (file.size > 5 * 1024 * 1024) return Promise.reject(new Error("A imagem deve ter no máximo 5 MB."));
  return new Promise<Blob>((resolve, reject) => {
    const source = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      const size = 512;
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const context = canvas.getContext("2d");
      if (!context) { URL.revokeObjectURL(source); reject(new Error("Não foi possível preparar a imagem.")); return; }
      const scale = Math.max(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
      canvas.toBlob((blob) => {
        URL.revokeObjectURL(source);
        if (!blob) { reject(new Error("Não foi possível preparar a imagem.")); return; }
        resolve(blob);
      }, "image/webp", .82);
    };
    image.onerror = () => { URL.revokeObjectURL(source); reject(new Error("Não foi possível abrir a imagem.")); };
    image.src = source;
  });
}

export default function FisiofitApp() {
  const { signOut, user } = useAuth();
  const storagePrefix = `fisiofit:portal:${user?.id ?? "preview"}`;
  const [view, setView] = useState<View>(() => {
    const saved = storedValue(`${storagePrefix}:view`);
    return isView(saved) ? saved : "Painel";
  });
  const [profile, setProfile] = useState<Profile>({
    name: "Equipe Fisiofit",
    role: "reception",
  });
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [unit, setUnit] = useState(() => storedValue(`${storagePrefix}:unit`));
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => storedValue(`${storagePrefix}:sidebar-collapsed`) === "true");
  const [agendaContext, setAgendaContext] = useState<AgendaEnrollmentContext>();
  const [avatarUrl, setAvatarUrl] = useState(() => String(user?.user_metadata?.avatar_url ?? ""));
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarNotice, setAvatarNotice] = useState("");
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    storeValue(`${storagePrefix}:view`, view);
  }, [storagePrefix, view]);
  useEffect(() => {
    storeValue(`${storagePrefix}:unit`, unit);
    storeValue("fisiofit:selected-unit", unit);
    window.dispatchEvent(new CustomEvent("fisiofit:unit-changed", { detail: unit }));
  }, [storagePrefix, unit]);
  useEffect(() => {
    storeValue(`${storagePrefix}:sidebar-collapsed`, String(sidebarCollapsed));
  }, [sidebarCollapsed, storagePrefix]);
  useEffect(() => setAvatarUrl(String(user?.user_metadata?.avatar_url ?? "")), [user]);
  useEffect(() => {
    const restore = () => {
      const savedView = storedValue(`${storagePrefix}:view`);
      const savedUnit = storedValue(`${storagePrefix}:unit`);
      if (savedView && isView(savedView)) setView(savedView);
      setUnit(savedUnit);
    };
    restore();
  }, [storagePrefix]);
  useEffect(() => {
    if (!loading && unit && !units.some((item) => item.id === unit)) {
      setUnit("");
    }
  }, [loading, unit, units]);
  useEffect(() => {
    async function loadPortal() {
      try {
        const me = await api<{ profile: Profile }>("/me");
        const loadedProfile = me.data?.profile;
        if (!loadedProfile) throw new Error("Não foi possível identificar o perfil deste usuário.");
        setProfile(loadedProfile);
        const requests = [
          api<Unit[]>("/units"),
          canViewModule(loadedProfile, "dashboard") ? api<DashboardData>("/dashboard") : Promise.resolve({ data: null }),
          ["admin", "manager", "reception", "professional"].includes(loadedProfile.role) && canViewModule(loadedProfile, "patients")
            ? list<Patient>("/patients?page=1&pageSize=100")
            : Promise.resolve({ data: null }),
        ] as const;
        const [unitResult, dashboardResult, patientResult] = await Promise.allSettled(requests);
        if (unitResult.status === "fulfilled") setUnits(unitResult.value.data ?? []);
        if (dashboardResult.status === "fulfilled") setDashboard(dashboardResult.value.data);
        if (patientResult.status === "fulfilled") setPatients(patientResult.value.data?.items ?? []);
        const failure = [unitResult, dashboardResult, patientResult].find((result) => result.status === "rejected");
        if (failure?.status === "rejected") setError(failure.reason instanceof Error ? failure.reason.message : "Alguns dados não foram carregados.");
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : "Não foi possível carregar o portal.");
      } finally {
        setLoading(false);
      }
    }
    void loadPortal();
  }, []);
  const visibleNav = useMemo(
    () => nav.filter((item) => item.roles.includes(profile.role) && canViewModule(profile, navModule[item.label]!)),
    [profile.role, profile.profile_permissions],
  );
  useEffect(() => {
    if (!loading && view !== "Meu perfil" && !visibleNav.some((item) => item.label === view)) {
      setView(visibleNav[0]?.label ?? "Painel");
    }
  }, [loading, view, visibleNav]);
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileMenuOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [mobileMenuOpen]);
  const mobilePrimaryNav = visibleNav.slice(0, 4);
  const mobileSecondaryNav = visibleNav.slice(4);
  const mobileViewIsSecondary = mobileSecondaryNav.some(
    (item) => item.label === view,
  );
  const navigate = (nextView: View) => {
    setView(nextView);
    setMobileMenuOpen(false);
  };
  const results = useMemo(() => {
    const text = search.trim().toLocaleLowerCase("pt-BR"),
      digits = text.replace(/\D/g, "");
    if (text.length < 2) return [];
    return patients
      .filter(
        (p) =>
          (!unit || p.primary_unit_id === unit) &&
          (p.name.toLocaleLowerCase("pt-BR").includes(text) ||
            (digits.length > 0 &&
              (p.phone ?? "").replace(/\D/g, "").includes(digits)) ||
            (digits.length > 0 &&
              (p.cpf ?? "").replace(/\D/g, "").includes(digits))),
      )
      .slice(0, 8);
  }, [patients, search, unit]);
  const initials = profile.name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  async function changeAvatar(file: File | undefined) {
    if (!file || !user) return;
    setAvatarBusy(true);
    setAvatarNotice("");
    try {
      const avatar = await compressAvatar(file);
      const path = `${user.id}/avatar.webp`;
      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(path, avatar, { contentType: "image/webp", upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`;
      const { error: updateError } = await supabase.auth.updateUser({ data: { avatar_url: publicUrl } });
      if (updateError) throw updateError;
      setAvatarUrl(publicUrl);
      setAvatarNotice("Foto de perfil atualizada.");
    } catch (reason) {
      setAvatarNotice(reason instanceof Error ? reason.message : "Não foi possível atualizar a foto.");
    } finally { setAvatarBusy(false); }
  }
  return (
    <>
      <a className="skip-link" href="#portal-content">Pular para o conteúdo principal</a>
      <main className={`app-shell${sidebarCollapsed ? " sidebar-collapsed" : ""}`} aria-busy={loading}>
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("Painel")}>
          <img className="brand-logo" src="/sistema/fisiofit-logo.jpg" alt="" />
          <span>
            <strong>FISIOFIT</strong>
            <small>Gestão clínica</small>
          </span>
        </button>
        <nav aria-label="Navegação principal">
          <div className="sidebar-nav-toolbar">
            <button
              type="button"
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
              aria-expanded={!sidebarCollapsed}
              aria-label={sidebarCollapsed ? "Maximizar menu lateral" : "Minimizar menu lateral"}
              title={sidebarCollapsed ? "Maximizar menu lateral" : "Minimizar menu lateral"}
            >
              <span aria-hidden="true">{sidebarCollapsed ? "›" : "‹"}</span>
              <span className="sidebar-toggle-label">{sidebarCollapsed ? "Maximizar menu" : "Minimizar menu"}</span>
            </button>
          </div>
          {sidebarGroups.map((group) => {
            const groupItems = visibleNav.filter((item) => group.items.includes(item.label));
            if (!groupItems.length) return null;
            return <section className="sidebar-nav-group" key={group.label} aria-labelledby={`sidebar-group-${group.label}`}>
              <h2 className="nav-label" id={`sidebar-group-${group.label}`}>{group.label}</h2>
              {groupItems.map((item) => (
                <button
                  key={item.label}
                  className={view === item.label ? "nav-item active" : "nav-item"}
                  onClick={() => navigate(item.label)}
                  aria-current={view === item.label ? "page" : undefined}
                  title={sidebarCollapsed ? item.label : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-item-label">{item.label}</span>
                </button>
              ))}
            </section>;
          })}
        </nav>
        <div className="profile">
          <button type="button" className="profile-open" onClick={() => navigate("Meu perfil")} aria-label="Abrir meu perfil">
            <Avatar initials={initials} url={avatarUrl} />
            <span>
              <strong>{loading ? "Carregando…" : profile.name}</strong>
              <small>{roleLabel[profile.role]}</small>
            </span>
          </button>
          <button className="profile-signout" onClick={() => void signOut()} aria-label="Sair">
            Sair
          </button>
        </div>
      </aside>
      <nav className="mobile-bottom-nav" aria-label="Navegação principal no celular">
        {mobilePrimaryNav.map((item) => (
          <button
            key={item.label}
            className={view === item.label ? "mobile-nav-item active" : "mobile-nav-item"}
            onClick={() => navigate(item.label)}
            aria-current={view === item.label ? "page" : undefined}
          >
            <span className="nav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
        {mobileSecondaryNav.length > 0 && (
          <button
            className={mobileViewIsSecondary || mobileMenuOpen ? "mobile-nav-item active" : "mobile-nav-item"}
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-more-menu"
          >
            <span className="nav-icon" aria-hidden="true">•••</span>
            <span>Mais</span>
          </button>
        )}
      </nav>
      {mobileMenuOpen && (
        <div className="mobile-menu-backdrop" onClick={() => setMobileMenuOpen(false)}>
          <section
            className="mobile-more-menu"
            id="mobile-more-menu"
            aria-label="Mais módulos"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mobile-menu-heading">
              <div><strong>Mais módulos</strong><small>Escolha uma área do sistema</small></div>
              <button onClick={() => setMobileMenuOpen(false)} aria-label="Fechar menu">×</button>
            </div>
            <div className="mobile-menu-grid">
              {mobileSecondaryNav.map((item) => (
                <button
                  key={item.label}
                  className={view === item.label ? "mobile-menu-item active" : "mobile-menu-item"}
                  onClick={() => navigate(item.label)}
                  aria-current={view === item.label ? "page" : undefined}
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              ))}
            </div>
            <div className="mobile-profile-actions">
              <button type="button" className="mobile-profile-open" onClick={() => navigate("Meu perfil")}>
                <Avatar initials={initials} url={avatarUrl} />
                <span><strong>{profile.name}</strong><small>{roleLabel[profile.role]}</small></span>
              </button>
              <button onClick={() => void signOut()}>Sair</button>
            </div>
          </section>
        </div>
      )}
      <section className="workspace" id="portal-content">
        <header className="topbar">
          <div className="mobile-brand">
            <img
              className="brand-logo"
              src="/sistema/fisiofit-logo.jpg"
              alt=""
            />
            <strong>Fisiofit</strong>
          </div>
          <div className="current-view" aria-live="polite">
            <strong>{view}</strong>
          </div>
          <label className="global-search">
            <span className="sr-only">Buscar paciente, telefone ou CPF</span>
            <span aria-hidden="true">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar paciente, telefone ou CPF…"
              role="combobox"
              aria-expanded={search.trim().length >= 2}
              aria-controls="global-search-results"
              aria-autocomplete="list"
            />
          </label>
          <div className="top-actions">
            <label className="unit-select">
              <span className="unit-select-icon" aria-hidden="true">⌖</span>
              <span className="unit-select-copy"><small>Unidade ativa</small><select
                aria-label="Selecionar unidade ativa"
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              >
                <option value="">Todas as unidades</option>
                {units.map((row) => (
                  <option value={row.id} key={row.id}>
                    {row.name}
                  </option>
                ))}
              </select></span>
            </label>
            <span className="today">
              {new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "long",
                timeZone: "America/Sao_Paulo",
              }).format(new Date())}
            </span>
          </div>
          {results.length > 0 && (
            <div className="global-results" id="global-search-results" role="listbox" aria-label="Pacientes encontrados">
              {results.map((patient) => (
                <button
                  key={patient.id}
                  role="option"
                  onClick={() => {
                    setView("Pacientes");
                    setSearch("");
                  }}
                >
                  <strong>{patient.name}</strong>
                  <small>{patient.phone ?? "Sem telefone"}</small>
                </button>
              ))}
            </div>
          )}
        </header>
        {error && (
          <div className="content">
            <div className="system-message error-message" role="alert"><span className="message-icon" aria-hidden="true">!</span><div><strong>Alguns dados não foram carregados</strong><p>{error}</p></div></div>
          </div>
        )}
        {view === "Meu perfil" && <ProfilePage profile={profile} email={user?.email ?? ""} avatarUrl={avatarUrl} avatarBusy={avatarBusy} avatarNotice={avatarNotice} onAvatarChange={changeAvatar} onSignOut={() => void signOut()} />}
        {view === "Painel" && (
          <Dashboard data={dashboard} name={profile.name} setView={setView} loading={loading} />
        )}{" "}
        {view === "Agenda" && <OperationalAgenda role={profile.role} canEdit={canEditModule(profile, "agenda")} onOpenPatients={() => navigate("Pacientes")} onOpenEnrollment={(context) => { setAgendaContext(context); navigate("Matrículas"); }} />}{" "}
        {view === "Chamada diária" && <OperationalDailyAttendance canEdit={canEditModule(profile, "agenda")} />}{" "}
        {view === "Pacientes" && <OperationalPatients canEdit={canEditModule(profile, "patients")} canViewEnrollments={canViewModule(profile, "enrollments")} canEditEnrollments={canEditModule(profile, "enrollments")} canViewAgenda={canViewModule(profile, "agenda")} canEditAgenda={canEditModule(profile, "agenda")} canViewTimeline={["admin", "manager"].includes(profile.role)} />}{" "}
        {view === "Matrículas" && <OperationalEnrollments agendaContext={agendaContext} onClearAgendaContext={() => setAgendaContext(undefined)} units={units} selectedUnitId={unit} onUnitChange={setUnit} canEdit={canEditModule(profile, "enrollments")} canManagePlans={canEditModule(profile, "enrollments") && ["admin", "manager", "finance"].includes(profile.role)} canDeletePlans={profile.role === "admin"} canViewCharges={["admin", "manager", "finance"].includes(profile.role) && canViewModule(profile, "enrollments")} canManageChargeStatus={["admin", "manager", "finance"].includes(profile.role) && canEditModule(profile, "enrollments")} canViewPayments={["admin", "manager", "finance"].includes(profile.role) && canViewModule(profile, "finance")} canReceivePayments={["admin", "manager", "finance"].includes(profile.role) && canEditModule(profile, "finance")} canRollback={["admin", "manager", "finance"].includes(profile.role) && canEditModule(profile, "enrollments")} />}{" "}
        {view === "Prontuários" && <OperationalRecords canEdit={canEditModule(profile, "records")} />}{" "}
        {view === "Financeiro" && <OperationalFinance canEdit={canEditModule(profile, "finance")} />}{" "}
        {view === "Relatórios" && <OperationalReports />}{" "}
        {view === "Importações" && (
          <Suspense fallback={<div className="content"><div className="card module-skeleton" role="status">Carregando importações…</div></div>}>
            <OperationalImports />
          </Suspense>
        )}{" "}
        {view === "Usuários" && <OperationalUsers canManageUsers={profile.role === "admin"} />}
        {view === "Configurações" && <OperationalAdministration canEdit={canEditModule(profile, "settings")} canManageUnits={profile.role === "admin"} canDelete={profile.role === "admin"} />}
        {view === "Privacidade" && (
          <OperationalPrivacy
            canEditPrivacy={profile.role === "admin" || Boolean(profile.profile_permissions?.some((permission) => permission.module === "privacy" && permission.can_edit))}
            canManageIncidents={profile.role === "admin"}
          />
        )}
      </section>
      </main>
    </>
  );
}

function ProfilePage({ profile, email, avatarUrl, avatarBusy, avatarNotice, onAvatarChange, onSignOut }: { profile: Profile; email: string; avatarUrl: string; avatarBusy: boolean; avatarNotice: string; onAvatarChange: (file: File | undefined) => Promise<void>; onSignOut: () => void }) {
  const initials = profile.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="content profile-page">
      <div className="page-title">
        <div><p className="eyebrow">CONTA</p><h1>Meu perfil</h1><p>Consulte seus dados de acesso e as informações do seu perfil.</p></div>
      </div>
      <section className="card profile-hero" aria-labelledby="profile-name">
        <Avatar initials={initials} url={avatarUrl} className="profile-avatar" />
        <div className="profile-hero-copy"><h2 id="profile-name">{profile.name}</h2><p>{roleLabel[profile.role]}</p><label className="profile-photo-action">{avatarBusy ? "Atualizando foto…" : avatarUrl ? "Trocar foto" : "Adicionar foto"}<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void onAvatarChange(event.target.files?.[0])} disabled={avatarBusy} /></label>{avatarNotice && <small className="profile-photo-notice" role="status">{avatarNotice}</small>}</div>
      </section>
      <section className="card profile-details" aria-labelledby="profile-details-title">
        <div className="card-head"><div><h2 id="profile-details-title">Dados da conta</h2><p>Informações vinculadas ao seu acesso ao sistema.</p></div></div>
        <dl className="profile-data-list">
          <div><dt>Nome</dt><dd>{profile.name}</dd></div>
          <div><dt>E-mail</dt><dd>{email || "Não informado"}</dd></div>
          <div><dt>Perfil de acesso</dt><dd>{roleLabel[profile.role]}</dd></div>
        </dl>
      </section>
      <section className="card profile-actions-card" aria-labelledby="profile-actions-title">
        <div><h2 id="profile-actions-title">Sessão</h2><p>Encerre seu acesso neste dispositivo.</p></div>
        <button type="button" className="btn secondary" onClick={onSignOut}>Sair do sistema</button>
      </section>
    </div>
  );
}

function Dashboard({
  data,
  name,
  setView,
  loading = false,
}: {
  data: DashboardData | null;
  name: string;
  setView: (view: View) => void;
  loading?: boolean;
}) {
  const result =
    (data?.receivedMonthCents ?? 0) - (data?.paidExpensesMonthCents ?? 0);
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">VISÃO OPERACIONAL</p>
          <h1>Olá, {name.split(" ")[0]}</h1>
          <p>Indicadores calculados a partir dos registros da clínica.</p>
        </div>
        <div className="title-actions">
          <button
            className="btn secondary"
            onClick={() => setView("Pacientes")}
          >
            Novo paciente
          </button>
          <button className="btn primary" onClick={() => setView("Agenda")}>
            Novo agendamento
          </button>
        </div>
      </div>
      {loading && <section className="metrics" aria-label="Carregando indicadores" aria-live="polite">
        {Array.from({ length: 4 }, (_, index) => <div className="metric-card module-skeleton" key={index}><div className="skeleton-line skeleton-short" /><div className="skeleton-line skeleton-title" /></div>)}
      </section>}
      {!loading && <>
      <section className="card table-card dashboard-agenda-top" aria-labelledby="dashboard-agenda-title">
        <div className="table-toolbar"><div><p className="eyebrow">PRÓXIMOS HORÁRIOS</p><h2 id="dashboard-agenda-title">Agenda de hoje</h2></div><button className="text-button" onClick={() => setView("Agenda")}>Abrir agenda →</button></div>
        {(data?.appointments ?? []).map((item) => <div className="operational-row" key={item.id}><div><strong>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(item.starts_at))} · {item.patients?.name ?? "Horário bloqueado"}</strong><small>{item.services?.name ?? "Atendimento"} · {item.professionals?.name ?? "Sem profissional"} · {item.units?.name ?? "Sem unidade"}</small></div><span className="status info">{item.status}</span></div>)}
        {!data?.appointments?.length && <div className="empty-state compact-empty"><strong>Nenhum atendimento para hoje</strong><p>A agenda está livre.</p></div>}
      </section>
      {Boolean(data?.dueCharges?.length) && <section className="dashboard-due-alert" role="status" aria-labelledby="dashboard-due-title"><div><strong id="dashboard-due-title">Vencimentos próximos</strong><span>Há cobranças com vencimento nos próximos 7 dias.</span></div><div className="dashboard-due-list">{data?.dueCharges.map((charge) => <span key={charge.id}><b>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(new Date(`${charge.due_at}T12:00:00`))}</b> · {charge.patients?.name ?? "Paciente"} · {brl(Math.max(Number(charge.amount_cents) - Number(charge.paid_cents), 0))}</span>)}</div></section>}
      <div className="metrics">
        <Metric
          label="Atendimentos hoje"
          value={data?.appointmentsToday ?? 0}
        />
        <Metric label="Pacientes ativos" value={data?.activePatients ?? 0} />
        <Metric label="Resultado no mês" value={brl(result)} />
        <Metric
          label="Cobranças vencidas"
          value={`${data?.overdueCharges ?? 0} · ${brl(data?.overdueAmountCents ?? 0)}`}
        />
      </div>
      </>}
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="metric-card">
      <div className="metric-copy">
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}
