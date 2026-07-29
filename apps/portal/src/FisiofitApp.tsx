"use client";

import { useEffect, useMemo, useState } from "react";
import { api, list } from "./api";
import { useAuth } from "./AuthProvider";
import { isSupabaseConfigured } from "./supabase";

type View = "Painel" | "Agenda" | "Pacientes" | "Matrículas" | "Prontuários" | "Financeiro" | "Relatórios" | "Configurações";

const nav: { label: View; icon: string }[] = [
  { label: "Painel", icon: "⌂" },
  { label: "Agenda", icon: "□" },
  { label: "Pacientes", icon: "♙" },
  { label: "Matrículas", icon: "◇" },
  { label: "Prontuários", icon: "▤" },
  { label: "Financeiro", icon: "₿" },
  { label: "Relatórios", icon: "↗" },
  { label: "Configurações", icon: "⚙" },
];

const appointments = [
  { day: 0, time: "08:00", span: 2, name: "Maria Eduarda", initials: "ME", type: "Pilates", color: "mint", professional: "Marina" },
  { day: 0, time: "10:30", span: 2, name: "Cláudio Reis", initials: "CR", type: "Fisioterapia", color: "blue", professional: "Marina" },
  { day: 0, time: "15:00", span: 2, name: "Lívia Santos", initials: "LS", type: "Pilates", color: "sand", professional: "Marina" },
  { day: 1, time: "09:00", span: 2, name: "João Pedro", initials: "JP", type: "RPG", color: "blue", professional: "Marina" },
  { day: 1, time: "13:30", span: 2, name: "Sofia Azevedo", initials: "SA", type: "Fisioterapia", color: "mint", professional: "Marina" },
  { day: 2, time: "08:30", span: 2, name: "Ana Clara", initials: "AC", type: "Pilates", color: "sand", professional: "Marina" },
  { day: 2, time: "11:00", span: 2, name: "Pedro Lima", initials: "PL", type: "Fisioterapia", color: "blue", professional: "Marina" },
  { day: 2, time: "16:00", span: 2, name: "Rita Gomes", initials: "RG", type: "Pilates", color: "mint", professional: "Marina" },
  { day: 3, time: "09:30", span: 2, name: "Bruno Alves", initials: "BA", type: "RPG", color: "sand", professional: "Marina" },
  { day: 3, time: "14:00", span: 2, name: "Helena Moura", initials: "HM", type: "Fisioterapia", color: "blue", professional: "Marina" },
  { day: 4, time: "08:00", span: 2, name: "Laura Nunes", initials: "LN", type: "Pilates", color: "mint", professional: "Marina" },
  { day: 4, time: "10:30", span: 2, name: "Caio Rocha", initials: "CR", type: "Fisioterapia", color: "sand", professional: "Marina" },
];

const team = [
  { name: "Marina", role: "Fisioterapeuta", initials: "MS", color: "#267365", appts: ["ME", "CR", "LS"] },
  { name: "Camila", role: "Fisioterapeuta", initials: "CO", color: "#446e9b", appts: ["JP", "SA", "HM"] },
  { name: "Renata", role: "Instrutora", initials: "RA", color: "#b27649", appts: ["AC", "PL", "RG"] },
  { name: "Bianca", role: "Fisioterapeuta", initials: "BM", color: "#765b96", appts: ["BA", "LN"] },
];

const patients = [
  { name: "Maria Eduarda Costa", initials: "ME", phone: "(11) 99234-1120", plan: "Pilates 2x", status: "Ativo", next: "Hoje, 08:00", unit: "Jardins" },
  { name: "Cláudio Reis", initials: "CR", phone: "(11) 98871-2204", plan: "Fisioterapia • 10", status: "Ativo", next: "Hoje, 10:30", unit: "Jardins" },
  { name: "João Pedro Silva", initials: "JP", phone: "(11) 99720-0421", plan: "RPG mensal", status: "Pendente", next: "Amanhã, 09:00", unit: "Moema" },
  { name: "Sofia Azevedo", initials: "SA", phone: "(11) 99115-3080", plan: "Avulso", status: "Ativo", next: "Amanhã, 13:30", unit: "Jardins" },
  { name: "Ana Clara Moreira", initials: "AC", phone: "(11) 98542-7166", plan: "Pilates 3x", status: "Ativo", next: "Qua, 08:30", unit: "Moema" },
  { name: "Pedro Lima", initials: "PL", phone: "(11) 98004-7712", plan: "Fisioterapia • 10", status: "Inativo", next: "Sem agenda", unit: "Jardins" },
];

const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
const income = [42, 46, 49, 47, 53, 57, 61, 58, 63, 67, 70, 74];
const expenses = [25, 27, 28, 29, 31, 30, 33, 34, 35, 36, 37, 39];

type Unit = { id: string; name: string; active: boolean };
type DashboardData = {
  activePatients: number;
  appointmentsToday: number;
  overdueCharges: number;
  overdueAmountCents: number;
  receivedMonthCents: number;
  paidExpensesMonthCents: number;
  appointments: Array<{
    id: string;
    status: string;
    starts_at: string;
    patients?: { id: string; name: string } | null;
    professionals?: { id: string; name: string } | null;
    services?: { id: string; name: string } | null;
    units?: { id: string; name: string } | null;
  }>;
  units: Unit[];
};

function money(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(value);
}

export default function FisiofitApp() {
  const { user } = useAuth();
  const [view, setView] = useState<View>("Painel");
  const [agendaMode, setAgendaMode] = useState<"week" | "team" | "units">("week");
  const [unit, setUnit] = useState("");
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"patient" | "appointment" | "evolution" | "entry" | null>(null);
  const [patientRows, setPatientRows] = useState<typeof patients>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [profileName, setProfileName] = useState<string>(
    typeof user?.user_metadata?.name === "string" ? user.user_metadata.name : "Administradora",
  );
  const filteredPatients = patientRows.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    void Promise.all([
      list<{ id: string; name: string; phone?: string; primary_unit_id: string }>("/patients?page=1&pageSize=100"),
      api<{ profile: { name: string } }>("/me"),
      api<Unit[]>("/units"),
      api<DashboardData>("/dashboard"),
    ])
      .then(([patientsResponse, meResponse, unitsResponse, dashboardResponse]) => {
        setProfileName(meResponse.data?.profile.name ?? "Administradora");
        setUnits(unitsResponse.data ?? []);
        setDashboard(dashboardResponse.data ?? null);
        setPatientRows((patientsResponse.data?.items ?? []).map((patient) => ({
          name: patient.name,
          initials: patient.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase(),
          phone: patient.phone ?? "Não informado",
          plan: "Sem matrícula ativa",
          status: "Ativo",
          next: "Sem agendamento",
          unit: unitsResponse.data?.find((item) => item.id === patient.primary_unit_id)?.name ?? "Não informada",
        })));
      })
      .catch(() => setNotice("Não foi possível carregar os dados operacionais."));
  }, []);

  function flash(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2800);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setView("Painel")} aria-label="Ir para o painel">
          <img className="brand-logo" src="/sistema/fisiofit-logo.jpg" alt="" />
          <span><strong>FISIOFIT</strong><small>Gestão clínica</small></span>
        </button>
        <nav aria-label="Navegação principal">
          <p className="nav-label">GESTÃO</p>
          {nav.slice(0, 6).map((item) => (
            <button key={item.label} className={view === item.label ? "nav-item active" : "nav-item"} onClick={() => setView(item.label)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
              {item.label === "Agenda" && <span className="nav-badge">12</span>}
            </button>
          ))}
          <p className="nav-label second">ANÁLISE</p>
          {nav.slice(6).map((item) => (
            <button key={item.label} className={view === item.label ? "nav-item active" : "nav-item"} onClick={() => setView(item.label)}>
              <span className="nav-icon">{item.icon}</span>{item.label}
            </button>
          ))}
        </nav>
        <div className="privacy-card">
          <span className="privacy-icon">✓</span>
          <div><strong>Dados protegidos</strong><small>Auditoria e LGPD ativas</small></div>
        </div>
        <div className="profile">
          <span className="avatar admin">{profileName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}</span>
          <div><strong>{profileName}</strong><small>Administradora</small></div>
          <button aria-label="Mais opções">•••</button>
        </div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="mobile-brand"><img className="brand-logo" src="/sistema/fisiofit-logo.jpg" alt="" /><strong>Fisiofit</strong></div>
          <label className="global-search">
            <span>⌕</span>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar paciente, telefone ou CPF..." />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <label className="unit-select"><span>⌖</span><select value={unit} onChange={(e) => setUnit(e.target.value)} aria-label="Selecionar unidade"><option value="">Todas as unidades</option>{units.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <button className="icon-button" aria-label="Notificações">♢<i /></button>
            <span className="today">Terça, 28 de julho</span>
          </div>
        </header>

        {view === "Painel" && <Dashboard data={dashboard} adminName={profileName} setView={setView} setModal={setModal} />}
        {view === "Agenda" && <Agenda mode={agendaMode} setMode={setAgendaMode} setModal={setModal} flash={flash} />}
        {view === "Pacientes" && <Patients data={filteredPatients} search={search} setSearch={setSearch} setModal={setModal} />}
        {view === "Matrículas" && <Enrollments flash={flash} />}
        {view === "Prontuários" && <Records setModal={setModal} flash={flash} />}
        {view === "Financeiro" && <Finance setModal={setModal} flash={flash} />}
        {view === "Relatórios" && <Reports flash={flash} />}
        {view === "Configurações" && <Settings flash={flash} />}
      </section>

      {notice && <div className="toast"><span>✓</span>{notice}</div>}
      {modal && <Modal type={modal} onClose={() => setModal(null)} onSave={(msg) => { setModal(null); flash(msg); }} />}
    </main>
  );
}

function Dashboard({
  data,
  adminName,
  setView,
  setModal,
}: {
  data: DashboardData | null;
  adminName: string;
  setView: (v: View) => void;
  setModal: (m: "patient" | "appointment") => void;
}) {
  const firstName = adminName.split(" ")[0] || "Administradora";
  return (
    <div className="content">
      <div className="page-title">
        <div><p className="eyebrow">VISÃO GERAL · TODAS AS UNIDADES</p><h1>Olá, {firstName}</h1><p>Indicadores calculados a partir dos registros reais da clínica.</p></div>
        <div className="title-actions"><button className="btn secondary" onClick={() => setModal("patient")}>＋ Novo paciente</button><button className="btn primary" onClick={() => setModal("appointment")}>＋ Novo agendamento</button></div>
      </div>

      <div className="metrics">
        <Metric icon="◷" label="Atendimentos hoje" value={String(data?.appointmentsToday ?? 0)} detail="Agenda de todas as unidades" trend="Hoje" color="green" />
        <Metric icon="♙" label="Pacientes ativos" value={String(data?.activePatients ?? 0)} detail="Cadastros não excluídos" trend="Atual" color="blue" />
        <Metric icon="R$" label="Recebido no mês" value={money((data?.receivedMonthCents ?? 0) / 100)} detail={`Despesas: ${money((data?.paidExpensesMonthCents ?? 0) / 100)}`} trend="Realizado" color="sand" />
        <Metric icon="!" label="Pagamentos vencidos" value={money((data?.overdueAmountCents ?? 0) / 100)} detail={`${data?.overdueCharges ?? 0} cobranças vencidas`} trend="Ver lista" color="rose" />
      </div>

      <div className="dashboard-grid">
        <section className="card schedule-card">
          <div className="card-head"><div><h2>Agenda de hoje</h2><p>{data?.appointmentsToday ?? 0} atendimentos cadastrados</p></div><button className="text-button" onClick={() => setView("Agenda")}>Ver agenda completa →</button></div>
          <div className="timeline-list">
            {(data?.appointments ?? []).map((appointment) => {
              const patientName = appointment.patients?.name ?? "Horário bloqueado";
              const initials = patientName.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
              const time = new Intl.DateTimeFormat("pt-BR", {
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              }).format(new Date(appointment.starts_at));
              return <div className="timeline-row" key={appointment.id}><time>{time}</time><span className="avatar mint">{initials}</span><div className="patient-main"><strong>{patientName}</strong><small>{appointment.services?.name ?? "Atendimento"}</small></div><div className="professional"><strong>{appointment.professionals?.name ?? "Sem profissional"}</strong><small>{appointment.units?.name ?? "Sem unidade"}</small></div><span className="status info">{appointment.status}</span><button aria-label={`Abrir ${patientName}`}>›</button></div>;
            })}
            {!data?.appointments?.length && <div className="empty-state">Nenhum atendimento cadastrado para hoje.</div>}
          </div>
        </section>

        <section className="card cash-card">
          <div className="card-head"><div><h2>Fluxo do mês</h2><p>Julho de 2026</p></div><button className="dots">•••</button></div>
          <div className="cash-total"><div><small>Resultado realizado</small><strong>R$ 23.860</strong></div><span className="trend-up">↑ 8,4%</span></div>
          <div className="mini-chart" aria-label="Gráfico de entradas e saídas"><div className="chart-line line-a" /><div className="chart-line line-b" />{[45,60,42,72,55,82,68,90,76,98,88,110].map((h,i)=><i key={i} style={{height:h}} />)}</div>
          <div className="legend"><span><i className="dot green" />Entradas <strong>R$ 58.420</strong></span><span><i className="dot coral" />Saídas <strong>R$ 34.560</strong></span></div>
        </section>

        <section className="card attention-card">
          <div className="card-head"><div><h2>Precisa da sua atenção</h2><p>Pendências prioritárias</p></div><span className="count">5</span></div>
          <button className="attention-row" onClick={() => setView("Financeiro")}><span className="attention-icon rose">!</span><div><strong>17 pagamentos vencidos</strong><small>R$ 8.740 pendentes</small></div><span>›</span></button>
          <button className="attention-row" onClick={() => setView("Matrículas")}><span className="attention-icon sand">◇</span><div><strong>8 planos próximos do fim</strong><small>Vencem nos próximos 7 dias</small></div><span>›</span></button>
          <button className="attention-row" onClick={() => setView("Prontuários")}><span className="attention-icon blue">▤</span><div><strong>3 evoluções em rascunho</strong><small>Aguardando assinatura</small></div><span>›</span></button>
        </section>

        <section className="card quick-card">
          <div className="card-head"><div><h2>Ações rápidas</h2><p>Atalhos do dia a dia</p></div></div>
          <div className="quick-grid">
            <button onClick={() => setModal("patient")}><span>♙</span><strong>Novo paciente</strong><small>Cadastro completo</small></button>
            <button onClick={() => setModal("appointment")}><span>□</span><strong>Agendar sessão</strong><small>Escolher horário</small></button>
            <button onClick={() => setView("Financeiro")}><span>R$</span><strong>Registrar pagamento</strong><small>Dar baixa</small></button>
            <button onClick={() => setView("Relatórios")}><span>↗</span><strong>Fechar o mês</strong><small>Relatório mensal</small></button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ icon, label, value, detail, trend, color }: { icon: string; label: string; value: string; detail: string; trend: string; color: string }) {
  return <article className="metric-card"><div className={`metric-icon ${color}`}>{icon}</div><div className="metric-copy"><small>{label}</small><strong>{value}</strong><span>{detail}</span></div><em className={color === "rose" ? "metric-link" : "metric-trend"}>{trend}</em></article>;
}

function Agenda({ mode, setMode, setModal, flash }: { mode: "week" | "team" | "units"; setMode: (m: "week" | "team" | "units") => void; setModal: (m: "appointment" | "evolution") => void; flash: (s: string) => void }) {
  const days = [["SEG", "27"], ["TER", "28"], ["QUA", "29"], ["QUI", "30"], ["SEX", "31"]];
  return <div className="content">
    <div className="page-title compact"><div><p className="eyebrow">ORGANIZAÇÃO DA CLÍNICA</p><h1>Agenda</h1><p>Visualize horários, profissionais e salas em um só lugar.</p></div><button className="btn primary" onClick={() => setModal("appointment")}>＋ Novo agendamento</button></div>
    <div className="toolbar">
      <div className="segmented"><button className={mode === "week" ? "selected" : ""} onClick={() => setMode("week")}>Semana</button><button className={mode === "team" ? "selected" : ""} onClick={() => setMode("team")}>Equipe hoje</button><button className={mode === "units" ? "selected" : ""} onClick={() => setMode("units")}>Por unidade</button></div>
      <div className="date-nav"><button>‹</button><strong>{mode === "week" ? "27 – 31 de julho de 2026" : "Terça, 28 de julho"}</strong><button>›</button><button className="today-btn">Hoje</button></div>
      <label className="mini-select">{mode === "week" ? "Unidade: " : "Profissional: "}<select>{mode === "week" ? <><option>Todas as unidades</option><option>Unidade principal</option><option>Unidade 2</option></> : <><option>Todos</option><option>Marina Souza</option><option>Camila Oliveira</option></>}</select></label>
    </div>
    {mode === "week" ? <section className="calendar card">
      <div className="calendar-head"><div className="time-head">Horário</div>{days.map((d,i)=><div key={d[0]} className={i===1?"current-day":""}><small>{d[0]}</small><strong>{d[1]}</strong></div>)}</div>
      <div className="calendar-body">
        <div className="time-column">{["08:00","09:00","10:00","11:00","12:00","13:00","14:00","15:00","16:00","17:00"].map(t=><span key={t}>{t}</span>)}</div>
        {days.map((_,day)=><div className={`day-column ${day===1?"today-column":""}`} key={day}>{Array.from({length:20},(_,i)=><i key={i}/>)}
          {appointments.filter(a=>a.day===day).map((a, i)=><button className={`appointment ${a.color}`} key={a.time} style={{top:`${((parseInt(a.time)-8)*60 + parseInt(a.time.slice(3)))*.84 + 8}px`,height:`${a.span*25}px`}} onClick={() => setModal("evolution")}><span className="appointment-avatar">{a.initials}</span><div><strong>{a.time} · {a.name}</strong><small>{a.type}</small></div><em>{i===0&&day===1?"A confirmar":""}</em></button>)}
        </div>)}
      </div>
    </section> : mode === "team" ? <section className="team-day card">
      <div className="team-columns">{team.map((p)=><div className="team-column" key={p.name}><div className="team-head"><span className="avatar" style={{background:p.color}}>{p.initials}</span><div><strong>{p.name}</strong><small>{p.role}</small></div><em>{p.appts.length} sessões</em></div>
        {["08:00","09:00","10:00","11:00","13:00","14:00","15:00","16:00"].map((t,i)=>p.appts[i%p.appts.length] && i%2===0?<button className="team-appt" key={t} onClick={() => setModal("evolution")}><time>{t}</time><span className="initial-big">{p.appts[i%p.appts.length]}</span><small>{i%4===0?"Pilates":"Fisioterapia"}</small></button>:<button className="free-slot" key={t} onClick={()=>flash(`Horário ${t} selecionado para ${p.name}`)}><time>{t}</time><span>Horário livre</span></button>)}
      </div>)}</div>
    </section> : <section className="unit-agenda">
      {["Unidade principal", "Unidade 2"].map((unitName, unitIndex) => <article className="card unit-agenda-card" key={unitName}>
        <div className="unit-agenda-head"><div><p className="eyebrow">UNIDADE</p><h2>{unitName}</h2></div><span>{unitIndex === 0 ? "5/7" : "4/7"} alunos por turma</span></div>
        <div className="unit-professionals">
          {team.slice(unitIndex * 2, unitIndex * 2 + 2).map((professional) => <div className="unit-professional" key={professional.name}>
            <div className="team-head"><span className="avatar" style={{background:professional.color}}>{professional.initials}</span><div><strong>{professional.name}</strong><small>{professional.role}</small></div></div>
            {["08:00","09:00","10:00","11:00","14:00","15:00"].map((time, index) => index % 2 === 0
              ? <button className="team-appt" key={time} onClick={() => setModal("evolution")}><time>{time}</time><span className="initial-big">{professional.appts[index % professional.appts.length]}</span><small>{index % 4 === 0 ? "Pilates" : "Fisioterapia"}</small></button>
              : <button className="free-slot" key={time} onClick={() => flash(`Horário ${time} selecionado em ${unitName}`)}><time>{time}</time><span>Horário livre</span></button>)}
          </div>)}
        </div>
      </article>)}
    </section>}
  </div>;
}

function Patients({ data, search, setSearch, setModal }: { data: typeof patients; search: string; setSearch: (s: string) => void; setModal: (m: "patient") => void }) {
  return <div className="content"><div className="page-title compact"><div><p className="eyebrow">RELACIONAMENTO</p><h1>Pacientes</h1><p>386 pacientes ativos em todas as unidades.</p></div><button className="btn primary" onClick={() => setModal("patient")}>＋ Novo paciente</button></div>
    <section className="card table-card"><div className="table-toolbar"><label className="table-search"><span>⌕</span><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar por nome, telefone ou CPF" /></label><div><button className="filter-btn">Status: Todos⌄</button><button className="filter-btn">Unidade: Todas⌄</button><button className="filter-btn">⇩ Exportar</button></div></div>
      <div className="data-table"><div className="table-row table-head-row"><span>Paciente</span><span>Contato</span><span>Plano atual</span><span>Próxima sessão</span><span>Status</span><span /></div>
      {data.map((p,i)=><button className="table-row" key={p.name}><span className="person-cell"><i className={`avatar ${["mint","blue","sand","purple"][i%4]}`}>{p.initials}</i><span><strong>{p.name}</strong><small>Unidade {p.unit}</small></span></span><span>{p.phone}</span><span>{p.plan}</span><span>{p.next}</span><span><i className={`status ${p.status==="Ativo"?"success":p.status==="Pendente"?"warning":"neutral"}`}>{p.status}</i></span><span className="arrow">›</span></button>)}</div>
      <div className="pagination"><span>Exibindo 1–6 de 386 pacientes</span><div><button disabled>‹</button><button className="selected">1</button><button>2</button><button>3</button><button>…</button><button>65</button><button>›</button></div></div>
    </section></div>;
}

function Enrollments({ flash }: { flash: (s:string)=>void }) {
  const rows = [
    ["Maria Eduarda Costa","Pilates 2x por semana","8 de 8 sessões","10/08/2026","Em dia"],
    ["Cláudio Reis","Fisioterapia • pacote 10","6 de 10 sessões","05/08/2026","Em dia"],
    ["João Pedro Silva","RPG mensal","3 de 4 sessões","20/07/2026","Vencido"],
    ["Ana Clara Moreira","Pilates 3x por semana","9 de 12 sessões","02/08/2026","A vencer"],
    ["Bruno Alves","Fisioterapia • pacote 10","10 de 10 sessões","28/07/2026","Renovar"],
  ];
  return <div className="content"><div className="page-title compact"><div><p className="eyebrow">PLANOS E COBRANÇAS</p><h1>Matrículas</h1><p>Acompanhe planos, sessões e vencimentos.</p></div><button className="btn primary" onClick={()=>flash("Nova matrícula iniciada")}>＋ Nova matrícula</button></div>
    <div className="metrics small"><Metric icon="◇" label="Matrículas ativas" value="312" detail="Em todas as unidades" trend="+ 7 este mês" color="green"/><Metric icon="◴" label="A vencer em 7 dias" value="8" detail="R$ 4.680 previstos" trend="Ver planos" color="sand"/><Metric icon="!" label="Vencidas" value="17" detail="R$ 8.740 em aberto" trend="Cobrar" color="rose"/></div>
    <section className="card table-card"><div className="table-toolbar"><h2>Planos ativos</h2><div><button className="filter-btn">Tipo: Todos⌄</button><button className="filter-btn">Situação: Todos⌄</button></div></div><div className="data-table enroll-table"><div className="table-row table-head-row"><span>Paciente</span><span>Plano</span><span>Utilização</span><span>Vencimento</span><span>Situação</span><span/></div>{rows.map((r,i)=><button className="table-row" key={r[0]}><span className="person-cell"><i className={`avatar ${["mint","blue","sand","purple"][i%4]}`}>{r[0].split(" ").map(x=>x[0]).slice(0,2).join("")}</i><strong>{r[0]}</strong></span><span>{r[1]}</span><span><strong>{r[2]}</strong><i className="progress"><b style={{width:`${[100,60,75,75,100][i]}%`}}/></i></span><span>{r[3]}</span><span><i className={`status ${r[4]==="Em dia"?"success":r[4]==="Vencido"?"danger":"warning"}`}>{r[4]}</i></span><span>›</span></button>)}</div></section>
  </div>;
}

function Records({ setModal, flash }: { setModal: (m:"evolution")=>void; flash:(s:string)=>void }) {
  return <div className="content"><div className="page-title compact"><div><p className="eyebrow">CUIDADO CLÍNICO</p><h1>Prontuários</h1><p>Avaliações e evoluções com assinatura e histórico protegido.</p></div><button className="btn primary" onClick={()=>setModal("evolution")}>＋ Nova evolução</button></div>
    <div className="record-layout"><section className="card patient-list"><div className="table-toolbar"><label className="table-search"><span>⌕</span><input placeholder="Buscar paciente" /></label></div>{patients.slice(0,5).map((p,i)=><button className={i===0?"record-patient selected": "record-patient"} key={p.name}><span className={`avatar ${["mint","blue","sand"][i%3]}`}>{p.initials}</span><div><strong>{p.name}</strong><small>{i+2} registros clínicos</small></div><span>›</span></button>)}</section>
      <section className="card patient-record"><div className="record-header"><div className="patient-id"><span className="avatar mint big">ME</span><div><h2>Maria Eduarda Costa</h2><p>33 anos · Pilates terapêutico</p></div></div><button className="filter-btn" onClick={()=>flash("Prontuário preparado para exportação em PDF")}>⇩ Exportar prontuário</button></div>
        <div className="record-tabs"><button className="selected">Linha do tempo</button><button>Avaliação inicial</button><button>Anexos <i>3</i></button><button>Consentimentos</button></div>
        <div className="clinical-alert"><span>i</span><div><strong>Atenção clínica</strong><p>Histórico de lombalgia crônica. Evitar hiperextensão lombar durante os exercícios.</p></div></div>
        <div className="timeline">
          <RecordItem date="28 JUL" title="Evolução diária" author="Marina Souza · CREFITO 123456-F" status="Rascunho" text="Paciente relata melhora na dor lombar após a última sessão. Realizados exercícios de estabilização do core, mobilidade de quadril e alongamento de cadeia posterior." onClick={()=>setModal("evolution")}/>
          <RecordItem date="23 JUL" title="Evolução diária" author="Marina Souza · CREFITO 123456-F" status="Assinado" text="Boa evolução funcional, sem intercorrências. Dor referida 2/10 ao início e 1/10 ao final da sessão."/>
          <RecordItem date="08 JUL" title="Avaliação inicial" author="Camila Oliveira · CREFITO 087431-F" status="Assinado" text="Queixa principal: dor lombar há aproximadamente seis meses. Objetivos terapêuticos definidos e plano de tratamento registrado."/>
        </div>
      </section>
    </div>
  </div>;
}

function RecordItem({date,title,author,status,text,onClick}:{date:string;title:string;author:string;status:string;text:string;onClick?:()=>void}) {
  return <article className="record-item"><div className="record-date">{date.split(" ").map(x=><span key={x}>{x}</span>)}</div><div className="record-dot"/><div className="record-content"><div><h3>{title}</h3><i className={`status ${status==="Assinado"?"success":"warning"}`}>{status}</i></div><small>{author}</small><p>{text}</p>{status==="Rascunho"&&<button className="text-button" onClick={onClick}>Continuar preenchimento →</button>}</div></article>
}

function Finance({ setModal, flash }: { setModal:(m:"entry")=>void; flash:(s:string)=>void }) {
  const moves=[["28 jul","Maria Eduarda Costa","Mensalidade Pilates","PIX","R$ 480,00","Recebido"],["28 jul","Aluguel • Unidade Jardins","Despesa fixa","Transferência","− R$ 8.200,00","Pago"],["27 jul","Cláudio Reis","Pacote Fisioterapia","Cartão","R$ 1.250,00","Recebido"],["26 jul","João Pedro Silva","Mensalidade RPG","PIX","R$ 620,00","Vencido"],["25 jul","Energia elétrica","Despesa fixa","Débito","− R$ 1.430,00","Pago"]];
  return <div className="content"><div className="page-title compact"><div><p className="eyebrow">CONTROLE FINANCEIRO</p><h1>Financeiro</h1><p>Entradas, saídas e conciliação de todas as unidades.</p></div><div className="title-actions"><button className="btn secondary" onClick={()=>setModal("entry")}>− Nova despesa</button><button className="btn primary" onClick={()=>setModal("entry")}>＋ Registrar recebimento</button></div></div>
    <div className="metrics"><Metric icon="↑" label="Entradas realizadas" value="R$ 58.420" detail="R$ 6.580 a receber" trend="+ 8,4%" color="green"/><Metric icon="↓" label="Saídas realizadas" value="R$ 34.560" detail="R$ 4.230 a pagar" trend="53,2% da receita" color="rose"/><Metric icon="=" label="Resultado do mês" value="R$ 23.860" detail="Margem de 40,8%" trend="+ 12,6%" color="blue"/><Metric icon="!" label="Inadimplência" value="R$ 8.740" detail="17 cobranças vencidas" trend="13,4%" color="sand"/></div>
    <div className="finance-grid"><section className="card finance-chart"><div className="card-head"><div><h2>Previsto x realizado</h2><p>Julho de 2026</p></div><div className="legend inline"><span><i className="dot green"/>Realizado</span><span><i className="dot gray"/>Previsto</span></div></div><div className="bar-chart">{["1–5","6–10","11–15","16–20","21–25","26–31"].map((x,i)=><div className="bar-group" key={x}><div><i style={{height:[55,80,68,92,72,48][i]}}/><i style={{height:[62,74,78,84,88,70][i]}}/></div><span>{x}</span></div>)}</div></section>
      <section className="card account-summary"><div className="card-head"><div><h2>Por unidade</h2><p>Resultado realizado</p></div></div><div className="unit-result"><span className="unit-dot gardens">J</span><div><strong>Unidade Jardins</strong><i><b style={{width:"72%"}}/></i></div><span><strong>R$ 15.980</strong><small>67%</small></span></div><div className="unit-result"><span className="unit-dot moema">M</span><div><strong>Unidade Moema</strong><i><b style={{width:"38%"}}/></i></div><span><strong>R$ 7.880</strong><small>33%</small></span></div></section></div>
    <section className="card table-card"><div className="table-toolbar"><h2>Movimentações recentes</h2><div><button className="filter-btn">Julho 2026⌄</button><button className="filter-btn" onClick={()=>flash("Movimentações exportadas")}>⇩ Exportar</button></div></div><div className="data-table finance-table"><div className="table-row table-head-row"><span>Data</span><span>Descrição</span><span>Categoria</span><span>Forma</span><span>Valor</span><span>Status</span></div>{moves.map(r=><button className="table-row" key={r[0]+r[1]}>{r.map((x,i)=><span key={i} className={i===4?(x.startsWith("−")?"negative":"positive"):""}>{i===5?<i className={`status ${x==="Recebido"||x==="Pago"?"success":"danger"}`}>{x}</i>:x}</span>)}</button>)}</div></section>
  </div>;
}

function Reports({ flash }: { flash:(s:string)=>void }) {
  const totalIncome=income.reduce((a,b)=>a+b)*1000,totalExpenses=expenses.reduce((a,b)=>a+b)*1000;
  return <div className="content"><div className="page-title compact"><div><p className="eyebrow">INTELIGÊNCIA DA CLÍNICA</p><h1>Relatório anual</h1><p>Os 12 meses lado a lado para uma visão completa do negócio.</p></div><div className="title-actions"><button className="btn secondary" onClick={()=>flash("Planilha anual gerada com os filtros atuais")}>⇩ Planilha</button><button className="btn primary" onClick={()=>flash("PDF anual gerado com sucesso")}>⇩ Exportar PDF</button></div></div>
    <div className="report-toolbar"><label>Ano <select><option>2026</option><option>2025</option></select></label><label>Unidade <select><option>Todas as unidades</option><option>Jardins</option><option>Moema</option></select></label><label>Regime <select><option>Realizado</option><option>Previsto</option></select></label><span>Atualizado hoje às 10:42</span></div>
    <div className="metrics"><Metric icon="↑" label="Receita anual" value={money(totalIncome)} detail="Acumulado em 2026" trend="+ 16,8%" color="green"/><Metric icon="↓" label="Despesas anuais" value={money(totalExpenses)} detail="Acumulado em 2026" trend="54,6% da receita" color="rose"/><Metric icon="=" label="Resultado anual" value={money(totalIncome-totalExpenses)} detail="Margem de 45,4%" trend="+ 21,3%" color="blue"/><Metric icon="♙" label="Atendimentos" value="3.284" detail="Média de 274/mês" trend="+ 11,2%" color="sand"/></div>
    <section className="card annual-chart"><div className="card-head"><div><h2>Evolução financeira</h2><p>Receitas e despesas por mês · valores em milhares</p></div><div className="legend inline"><span><i className="dot green"/>Receitas</span><span><i className="dot coral"/>Despesas</span></div></div><div className="annual-bars">{months.map((m,i)=><div key={m}><div className="bars"><i className="income" style={{height:income[i]*2.1}}/><i className="expense" style={{height:expenses[i]*2.1}}/></div><span>{m}</span></div>)}</div></section>
    <section className="card annual-table"><div className="card-head"><div><h2>Demonstrativo mensal</h2><p>Comparativo completo do ano</p></div></div><div className="month-grid"><div className="month-row head"><strong>Indicador</strong>{months.map(m=><span key={m}>{m}</span>)}<strong>Total</strong></div><div className="month-row"><strong>Receitas</strong>{income.map((x,i)=><span key={i}>{x}k</span>)}<strong className="positive">{money(totalIncome)}</strong></div><div className="month-row"><strong>Despesas</strong>{expenses.map((x,i)=><span key={i}>{x}k</span>)}<strong className="negative">{money(totalExpenses)}</strong></div><div className="month-row result"><strong>Resultado</strong>{income.map((x,i)=><span key={i}>{x-expenses[i]}k</span>)}<strong>{money(totalIncome-totalExpenses)}</strong></div><div className="month-row"><strong>Atendimentos</strong>{[231,248,252,260,271,279,284,276,290,298,302,309].map((x,i)=><span key={i}>{x}</span>)}<strong>3.300</strong></div></div></section>
  </div>;
}

function Settings({ flash }: { flash:(s:string)=>void }) {
  const items=[["Unidades e salas","Gerencie endereços, horários e recursos físicos","2 unidades · 7 salas"],["Equipe e permissões","Convide profissionais e controle acessos","12 usuários ativos"],["Serviços e planos","Configure valores, duração, pacotes e mensalidades","18 serviços"],["Modelos de prontuário","Crie avaliações e evoluções por especialidade","6 modelos"],["Formas de pagamento","PIX, cartão, dinheiro e transferência","4 formas ativas"],["Integrações","Nota fiscal, WhatsApp e migração de dados","2 aguardando configuração"],["Auditoria e LGPD","Histórico de acesso, consentimentos e retenção","Proteção ativa"]];
  return <div className="content narrow"><div className="page-title compact"><div><p className="eyebrow">ADMINISTRAÇÃO</p><h1>Configurações</h1><p>Personalize a operação e a segurança da clínica.</p></div></div><section className="card settings-card">{items.map((x,i)=><button className="setting-row" key={x[0]} onClick={()=>flash(`${x[0]} aberto para configuração`)}><span className={`setting-icon c${i}`}>{["⌖","♙","◇","▤","R$","↗","✓"][i]}</span><div><strong>{x[0]}</strong><small>{x[1]}</small></div><em>{x[2]}</em><span>›</span></button>)}</section></div>;
}

function Modal({ type, onClose, onSave }: { type:"patient"|"appointment"|"evolution"|"entry"; onClose:()=>void; onSave:(s:string)=>void }) {
  const config={
    patient:{title:"Novo paciente",sub:"Cadastre os dados essenciais. O restante pode ser completado depois.",save:"Cadastrar paciente"},
    appointment:{title:"Novo agendamento",sub:"Escolha paciente, profissional, serviço e horário.",save:"Confirmar agendamento"},
    evolution:{title:"Evolução diária",sub:"Registro vinculado ao atendimento de hoje.",save:"Salvar e assinar"},
    entry:{title:"Novo lançamento",sub:"Registre uma entrada ou saída no fluxo financeiro.",save:"Salvar lançamento"}
  }[type];
  return <div className="modal-backdrop" role="presentation" onMouseDown={onClose}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onMouseDown={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">FISIOFIT</p><h2 id="modal-title">{config.title}</h2><p>{config.sub}</p></div><button onClick={onClose} aria-label="Fechar">×</button></div>
    <div className="modal-form">
      {type==="patient"&&<><label className="full">Nome completo<input placeholder="Nome do paciente" autoFocus/></label><div className="form-row"><label>CPF<input placeholder="000.000.000-00"/></label><label>Data de nascimento<input type="date"/></label></div><div className="form-row"><label>Telefone<input placeholder="(00) 00000-0000"/></label><label>E-mail<input type="email" placeholder="nome@email.com"/></label></div><div className="form-row"><label>Unidade principal<select><option>Unidade Jardins</option><option>Unidade Moema</option></select></label><label>Responsável<input placeholder="Opcional"/></label></div><label className="check"><input type="checkbox"/> Paciente autorizou contato por WhatsApp</label></>}
      {type==="appointment"&&<><label className="full">Paciente<input placeholder="Busque pelo nome ou CPF" autoFocus/></label><div className="form-row"><label>Profissional<select><option>Marina Souza</option><option>Camila Oliveira</option><option>Renata Alves</option></select></label><label>Serviço<select><option>Fisioterapia</option><option>Pilates</option><option>RPG</option></select></label></div><div className="form-row"><label>Data<input type="date" defaultValue="2026-07-28"/></label><label>Horário<input type="time" defaultValue="10:00"/></label></div><div className="form-row"><label>Sala<select><option>Sala 01</option><option>Sala 02</option><option>Estúdio</option></select></label><label>Recorrência<select><option>Não repetir</option><option>Semanalmente</option><option>2x por semana</option></select></label></div><div className="conflict-ok"><span>✓</span>Nenhum conflito de profissional ou sala encontrado.</div></>}
      {type==="evolution"&&<><div className="patient-strip"><span className="avatar mint">ME</span><div><strong>Maria Eduarda Costa</strong><small>Pilates terapêutico · Marina Souza</small></div><time>28 jul · 08:00</time></div><label className="full">Relato e resposta ao tratamento<textarea rows={5} autoFocus placeholder="Descreva a evolução clínica, intercorrências e resposta da paciente..."/></label><div className="form-row"><label>Dor antes (0–10)<input type="number" min="0" max="10" defaultValue="2"/></label><label>Dor depois (0–10)<input type="number" min="0" max="10" defaultValue="1"/></label></div><label className="full">Conduta e próximos passos<textarea rows={3} placeholder="Conduta adotada e orientações..."/></label><label className="check"><input type="checkbox"/> Confirmo a autoria deste registro e desejo assiná-lo eletronicamente</label></>}
      {type==="entry"&&<><div className="segmented wide"><button className="selected">Receita</button><button>Despesa</button></div><div className="form-row"><label>Valor<input placeholder="R$ 0,00" autoFocus/></label><label>Data<input type="date" defaultValue="2026-07-28"/></label></div><label className="full">Descrição<input placeholder="Ex.: Mensalidade Pilates"/></label><div className="form-row"><label>Categoria<select><option>Mensalidades</option><option>Pacotes</option><option>Despesa fixa</option></select></label><label>Forma de pagamento<select><option>PIX</option><option>Cartão</option><option>Dinheiro</option><option>Transferência</option></select></label></div><label className="full">Unidade<select><option>Unidade Jardins</option><option>Unidade Moema</option></select></label></>}
    </div><div className="modal-actions"><button className="btn secondary" onClick={onClose}>Cancelar</button><button className="btn primary" onClick={()=>onSave(type==="patient"?"Paciente cadastrado com sucesso":type==="appointment"?"Agendamento confirmado sem conflitos":type==="evolution"?"Evolução assinada e protegida no prontuário":"Lançamento registrado com sucesso")}>{config.save}</button></div></section></div>;
}
