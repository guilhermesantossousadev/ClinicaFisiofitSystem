import { useEffect, useMemo, useState } from "react";
import { api, list } from "../../infrastructure/http/api";
import "../styles/portal-enhancements.css";
import { useAuth } from "../auth/AuthProvider";
import {
  OperationalAdministration,
  OperationalAgenda,
  OperationalEnrollments,
  OperationalFinance,
  OperationalImports,
  OperationalPatients,
  OperationalPrivacy,
  OperationalRecords,
  OperationalReports,
  OperationalUsers,
} from "../modules/OperationalModules";
import type { AgendaEnrollmentContext } from "../modules/OperationalModules";
import type { DashboardData, Patient, Profile, Unit, View } from "../../domain/portal";
import { isView, nav, navModule, roleLabel } from "../../application/portal/navigation";
const sidebarGroups: Array<{ label: string; items: View[] }> = [
  { label: "Operação", items: ["Painel", "Agenda", "Pacientes", "Matrículas", "Prontuários"] },
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
    void Promise.all([
      api<{ profile: Profile }>("/me"),
      api<DashboardData>("/dashboard"),
      api<Unit[]>("/units"),
      list<Patient>("/patients?page=1&pageSize=100"),
    ])
      .then(([me, dash, unitRows, patientRows]) => {
        if (me.data?.profile) setProfile(me.data.profile);
        setDashboard(dash.data);
        setUnits(unitRows.data ?? []);
        setPatients(patientRows.data?.items ?? []);
      })
      .catch((reason) =>
        setError(
          reason instanceof Error
            ? reason.message
            : "Não foi possível carregar o portal.",
        ),
      )
      .finally(() => setLoading(false));
  }, []);
  const visibleNav = useMemo(
    () => nav.filter((item) => item.roles.includes(profile.role) && (profile.role === "admin" || !profile.profile_permissions || profile.profile_permissions.some((permission) => permission.module === navModule[item.label] && permission.can_view))),
    [profile.role, profile.profile_permissions],
  );
  useEffect(() => {
    if (!loading && !visibleNav.some((item) => item.label === view)) {
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
        <nav aria-label="Navegação principal">
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
                >
                  <span className="nav-icon" aria-hidden="true">{item.icon}</span>
                  <span className="nav-item-label">{item.label}</span>
                </button>
              ))}
            </section>;
          })}
        </nav>
        <div className="privacy-card">
          <span className="privacy-icon">✓</span>
          <div>
            <strong>Dados protegidos</strong>
            <small>MFA e auditoria ativos</small>
          </div>
        </div>
        <div className="profile">
          <span className="avatar admin">{initials}</span>
          <div>
          <strong>{loading ? "Carregando…" : profile.name}</strong>
            <small>{roleLabel[profile.role]}</small>
          </div>
          <button onClick={() => void signOut()} aria-label="Sair">
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
              <span className="avatar admin" aria-hidden="true">{initials}</span>
              <div><strong>{profile.name}</strong><small>{roleLabel[profile.role]}</small></div>
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
              <span>⌖</span>
              <select
                value={unit}
                onChange={(event) => setUnit(event.target.value)}
              >
                <option value="">Todas as unidades</option>
                {units.map((row) => (
                  <option value={row.id} key={row.id}>
                    {row.name}
                  </option>
                ))}
              </select>
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
        {view === "Painel" && (
          <Dashboard data={dashboard} name={profile.name} setView={setView} loading={loading} />
        )}{" "}
        {view === "Agenda" && <OperationalAgenda canEdit={profile.role === "admin" || !profile.profile_permissions || profile.profile_permissions.some((permission) => permission.module === "agenda" && permission.can_edit)} onOpenPatients={() => navigate("Pacientes")} onOpenEnrollment={(context) => { setAgendaContext(context); navigate("Matrículas"); }} />}{" "}
        {view === "Pacientes" && <OperationalPatients />}{" "}
        {view === "Matrículas" && <OperationalEnrollments agendaContext={agendaContext} onClearAgendaContext={() => setAgendaContext(undefined)} />}{" "}
        {view === "Prontuários" && <OperationalRecords />}{" "}
        {view === "Financeiro" && <OperationalFinance />}{" "}
        {view === "Relatórios" && <OperationalReports />}{" "}
        {view === "Importações" && <OperationalImports />}{" "}
        {view === "Usuários" && <OperationalUsers canManageUsers={profile.role === "admin"} />}
        {view === "Configurações" && <OperationalAdministration />}
        {view === "Privacidade" && <OperationalPrivacy />}
      </section>
      </main>
    </>
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
