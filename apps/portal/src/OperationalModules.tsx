import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "./api";

type Row = Record<string, any>;
type Unit = { id: string; name: string };

function messageOf(error: unknown) {
  return error instanceof Error ? error.message : "Não foi possível concluir a operação.";
}

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function cents(raw: string) {
  return Math.round(Number(raw.replace(",", ".")) * 100);
}

function brl(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(amountCents / 100);
}

function isoLocal(raw: string) {
  return new Date(raw).toISOString();
}

function useResources(paths: string[]) {
  const [data, setData] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const key = paths.join("|");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all(paths.map((path) => api<any>(path)));
      setData(Object.fromEntries(paths.map((path, index) => [path, responses[index].data])));
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setLoading(false);
    }
  }, [key]);
  useEffect(() => void reload(), [reload]);
  return { data, loading, error, reload };
}

function Select({ name, rows, label, required = true }: { name: string; rows: Row[]; label: string; required?: boolean }) {
  return <label>{label}<select name={name} required={required}><option value="">Selecione</option>{rows.map((row) => <option key={row.id} value={row.id}>{row.name ?? row.description}</option>)}</select></label>;
}

function ModuleState({ loading, error }: { loading: boolean; error: string }) {
  if (loading) return <div className="card empty-state">Carregando dados…</div>;
  if (error) return <div className="login-error">{error}</div>;
  return null;
}

export function OperationalAgenda() {
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().slice(0, 10));
  const range = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [fromDate]);
  const paths = [
    `/appointments?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
    "/units", "/professionals", "/services", "/rooms", "/patients?page=1&pageSize=100", "/group-slots",
  ];
  const { data, loading, error, reload } = useResources(paths);
  const appointments: Row[] = data[paths[0]] ?? [];
  const patients: Row[] = data["/patients?page=1&pageSize=100"]?.items ?? [];
  const [notice, setNotice] = useState("");

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/appointments", { method: "POST", body: JSON.stringify({
        unit_id: value(form, "unit_id"),
        patient_id: value(form, "patient_id") || undefined,
        professional_id: value(form, "professional_id"),
        service_id: value(form, "service_id") || undefined,
        room_id: value(form, "room_id") || undefined,
        starts_at: isoLocal(value(form, "starts_at")),
        ends_at: isoLocal(value(form, "ends_at")),
        notes: value(form, "notes") || undefined,
      }) });
      event.currentTarget.reset();
      setNotice("Agendamento criado.");
      await reload();
    } catch (actionError) { setNotice(messageOf(actionError)); }
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weekdays = form.getAll("weekdays").map(Number);
    try {
      await api("/group-slots", { method: "POST", body: JSON.stringify({
        unit_id: value(form, "unit_id"), room_id: value(form, "room_id"),
        professional_id: value(form, "professional_id"), service_id: value(form, "service_id"),
        name: value(form, "name"), weekdays, starts_at: value(form, "starts_at"),
        duration_minutes: Number(value(form, "duration_minutes")), capacity: 7,
      }) });
      event.currentTarget.reset();
      setNotice("Turma semanal criada com capacidade 7.");
      await reload();
    } catch (actionError) { setNotice(messageOf(actionError)); }
  }

  async function status(id: string, next: string) {
    try {
      if (next === "completed") {
        await api(`/appointments/${id}/complete`, { method: "POST" });
      } else {
        await api(`/appointments/${id}/status`, { method: "PATCH", body: JSON.stringify({ status: next }) });
      }
      await reload();
    } catch (actionError) { setNotice(messageOf(actionError)); }
  }

  return <div className="content">
    <div className="page-title"><div><p className="eyebrow">AGENDA OPERACIONAL</p><h1>Agenda e turmas</h1><p>Conflitos de profissional, sala e capacidade são validados pela API.</p></div><label>Semana<input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} /></label></div>
    {notice && <div className="toast"><span>✓</span>{notice}</div>}
    <ModuleState loading={loading} error={error} />
    <div className="dashboard-grid">
      <form className="card modal-form" onSubmit={createAppointment}><h2>Novo agendamento</h2>
        <div className="form-row"><Select name="unit_id" label="Unidade" rows={data["/units"] ?? []}/><Select name="professional_id" label="Profissional" rows={data["/professionals"] ?? []}/></div>
        <div className="form-row"><Select name="patient_id" label="Paciente" rows={patients}/><Select name="service_id" label="Serviço" rows={data["/services"] ?? []} required={false}/></div>
        <div className="form-row"><Select name="room_id" label="Sala" rows={data["/rooms"] ?? []} required={false}/><label>Início<input name="starts_at" type="datetime-local" required/></label></div>
        <div className="form-row"><label>Término<input name="ends_at" type="datetime-local" required/></label><label>Observações<input name="notes"/></label></div>
        <button className="btn primary">Agendar</button>
      </form>
      <form className="card modal-form" onSubmit={createGroup}><h2>Nova turma semanal</h2>
        <label>Nome da turma<input name="name" required minLength={3}/></label>
        <div className="form-row"><Select name="unit_id" label="Unidade" rows={data["/units"] ?? []}/><Select name="room_id" label="Sala" rows={data["/rooms"] ?? []}/></div>
        <div className="form-row"><Select name="professional_id" label="Profissional" rows={data["/professionals"] ?? []}/><Select name="service_id" label="Serviço" rows={data["/services"] ?? []}/></div>
        <div className="form-row"><label>Horário<input name="starts_at" type="time" required/></label><label>Duração (min)<input name="duration_minutes" type="number" min="15" defaultValue="50" required/></label></div>
        <label>Dias da semana<div className="weekday-checks">{["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"].map((day, index) => <label key={day}><input type="checkbox" name="weekdays" value={index}/>{day}</label>)}</div></label>
        <button className="btn primary">Criar turma (7 vagas)</button>
      </form>
    </div>
    <section className="card table-card"><div className="table-toolbar"><h2>Atendimentos da semana</h2></div>
      {appointments.map((item) => <div className="operational-row" key={item.id}><div><strong>{new Date(item.starts_at).toLocaleString("pt-BR")}</strong><small>{item.patients?.name ?? "Bloqueio"} · {item.professionals?.name ?? "Sem profissional"}</small></div><span className="status info">{item.status}</span><div className="row-actions"><button onClick={() => status(item.id, "confirmed")}>Confirmar</button><button onClick={() => status(item.id, "completed")}>Concluir</button><button onClick={() => status(item.id, "missed")}>Falta</button><button onClick={() => status(item.id, "cancelled")}>Cancelar</button></div></div>)}
      {!appointments.length && <div className="empty-state">Nenhum atendimento nesta semana.</div>}
    </section>
    <section className="card table-card"><div className="table-toolbar"><h2>Turmas fixas</h2></div>{(data["/group-slots"] ?? []).map((item: Row) => <div className="operational-row" key={item.id}><div><strong>{item.name}</strong><small>{item.starts_at} · {item.weekdays?.join(", ")} · capacidade {item.capacity}/7</small></div></div>)}</section>
  </div>;
}

export function OperationalPatients() {
  const paths = ["/patients?page=1&pageSize=100", "/units"];
  const { data, loading, error, reload } = useResources(paths);
  const patients: Row[] = data[paths[0]]?.items ?? [];
  const [selected, setSelected] = useState<Row | null>(null);
  const [detail, setDetail] = useState<{ responsibles: Row[]; consents: Row[]; timeline?: Row }>({ responsibles: [], consents: [] });
  const [notice, setNotice] = useState("");
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const f = new FormData(event.currentTarget);
    const address = { street: value(f,"street"), number: value(f,"number"), city: value(f,"city"), state: value(f,"state"), zip: value(f,"zip") };
    try { await api("/patients",{method:"POST",body:JSON.stringify({primary_unit_id:value(f,"primary_unit_id"),name:value(f,"name"),cpf:value(f,"cpf")||undefined,birth_date:value(f,"birth_date")||undefined,phone:value(f,"phone")||undefined,email:value(f,"email")||undefined,address,tax_data:{fiscal_name:value(f,"fiscal_name"),document:value(f,"fiscal_document")},notes:value(f,"notes")||undefined})});event.currentTarget.reset();await reload();setNotice("Paciente cadastrado.");}catch(e){setNotice(messageOf(e));}
  }
  async function open(row:Row){setSelected(row);try{const [responsibles,consents,timeline]=await Promise.all([api<Row[]>(`/patients/${row.id}/responsibles`),api<Row[]>(`/patients/${row.id}/consents`),api<Row>(`/patients/${row.id}/timeline`)]);setDetail({responsibles:responsibles.data??[],consents:consents.data??[],timeline:timeline.data??undefined});}catch(e){setNotice(messageOf(e));}}
  async function responsible(event:FormEvent<HTMLFormElement>){event.preventDefault();if(!selected)return;const f=new FormData(event.currentTarget);try{await api(`/patients/${selected.id}/responsibles`,{method:"POST",body:JSON.stringify({name:value(f,"name"),relationship:value(f,"relationship"),cpf:value(f,"cpf")||undefined,phone:value(f,"phone")||undefined,email:value(f,"email")||undefined})});event.currentTarget.reset();await open(selected);}catch(e){setNotice(messageOf(e));}}
  async function consent(kind:string,granted:boolean){if(!selected)return;try{await api(`/patients/${selected.id}/consents`,{method:"POST",body:JSON.stringify({kind,granted})});await open(selected);}catch(e){setNotice(messageOf(e));}}
  return <div className="content"><div className="page-title"><div><p className="eyebrow">CADASTRO COMPLETO</p><h1>Pacientes</h1><p>Dados pessoais, fiscais, responsável, consentimentos e linha do tempo.</p></div></div>{notice&&<div className="toast"><span>✓</span>{notice}</div>}<ModuleState loading={loading} error={error}/>
    <form className="card modal-form" onSubmit={create}><h2>Novo paciente</h2><div className="form-row"><label>Nome completo<input name="name" required/></label><Select name="primary_unit_id" label="Unidade principal" rows={data["/units"]??[]}/></div><div className="form-row"><label>CPF<input name="cpf"/></label><label>Nascimento<input name="birth_date" type="date"/></label></div><div className="form-row"><label>Telefone<input name="phone"/></label><label>E-mail<input name="email" type="email"/></label></div><div className="form-row"><label>Rua<input name="street"/></label><label>Número<input name="number"/></label></div><div className="form-row"><label>Cidade<input name="city"/></label><label>Estado<input name="state" maxLength={2}/></label></div><div className="form-row"><label>CEP<input name="zip"/></label><label>Nome fiscal<input name="fiscal_name"/></label></div><label>Documento fiscal<input name="fiscal_document"/></label><label>Observações<textarea name="notes" rows={3}/></label><button className="btn primary">Cadastrar paciente</button></form>
    <section className="card table-card"><div className="table-toolbar"><h2>Pacientes cadastrados</h2><span>{patients.length}</span></div>{patients.map(row=><button className="operational-row patient-button" key={row.id} onClick={()=>open(row)}><div><strong>{row.name}</strong><small>{row.phone??"Sem telefone"} · {row.email??"Sem e-mail"}</small></div><span>›</span></button>)}{!patients.length&&<div className="empty-state">Nenhum paciente cadastrado.</div>}</section>
    {selected&&<div className="modal-backdrop" onClick={()=>setSelected(null)}><section className="modal" onClick={e=>e.stopPropagation()}><div className="modal-head"><div><p className="eyebrow">PACIENTE</p><h2>{selected.name}</h2><p>{selected.cpf??"CPF não informado"}</p></div><button onClick={()=>setSelected(null)}>×</button></div><div className="modal-form"><h3>Consentimentos</h3><div className="row-actions"><button onClick={()=>consent("whatsapp",true)}>Autorizar contato</button><button onClick={()=>consent("whatsapp",false)}>Revogar contato</button><button onClick={()=>consent("data_processing",true)}>Autorizar tratamento de dados</button></div><p>{detail.consents.length} registros de consentimento.</p><form onSubmit={responsible}><h3>Adicionar responsável</h3><div className="form-row"><label>Nome<input name="name" required/></label><label>Relação<input name="relationship"/></label></div><div className="form-row"><label>CPF<input name="cpf"/></label><label>Telefone<input name="phone"/></label></div><label>E-mail<input name="email" type="email"/></label><button className="btn primary">Salvar responsável</button></form><h3>Linha do tempo</h3><p>{detail.timeline?.appointments?.length??0} atendimentos · {detail.timeline?.records?.length??0} registros clínicos · {detail.timeline?.charges?.length??0} cobranças</p></div></section></div>}
  </div>;
}

export function OperationalEnrollments() {
  const paths = ["/plans", "/enrollments", "/charges", "/payments", "/patients?page=1&pageSize=100", "/units", "/group-slots"];
  const { data, loading, error, reload } = useResources(paths);
  const patients = data["/patients?page=1&pageSize=100"]?.items ?? [];
  const [notice, setNotice] = useState("");

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await api("/plans", { method: "POST", body: JSON.stringify({
      name: value(form, "name"), kind: value(form, "kind"),
      sessions_included: Number(value(form, "sessions_included")) || undefined,
      duration_days: Number(value(form, "duration_days")) || undefined,
      price_cents: cents(value(form, "price")), active: true,
    }) }); event.currentTarget.reset(); await reload(); setNotice("Plano criado."); } catch (e) { setNotice(messageOf(e)); }
  }
  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try {
      const response = await api<Row>("/enrollments", { method: "POST", body: JSON.stringify({
        patient_id: value(form, "patient_id"), plan_id: value(form, "plan_id"), unit_id: value(form, "unit_id"),
        starts_at: value(form, "starts_at"), due_day: Number(value(form, "due_day")),
        discount_cents: cents(value(form, "discount") || "0"), surcharge_cents: 0,
      }) });
      const group = value(form, "group_slot_id");
      if (group && response.data) await api(`/group-slots/${group}/members`, { method: "POST", body: JSON.stringify({
        enrollment_id: response.data.id, patient_id: value(form, "patient_id"), starts_at: value(form, "starts_at"),
      }) });
      event.currentTarget.reset(); await reload(); setNotice("Matrícula e cobrança criadas.");
    } catch (e) { setNotice(messageOf(e)); }
  }
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await api("/payments", { method: "POST", idempotencyKey: crypto.randomUUID(), body: JSON.stringify({
      charge_id: value(form, "charge_id"), amount_cents: cents(value(form, "amount")),
      method: value(form, "method"), paid_at: new Date().toISOString(),
    }) }); event.currentTarget.reset(); await reload(); setNotice("Pagamento registrado."); } catch (e) { setNotice(messageOf(e)); }
  }
  return <div className="content"><div className="page-title"><div><p className="eyebrow">PLANOS E COBRANÇAS</p><h1>Matrículas</h1><p>Planos mensais, pacotes, avulsos e vínculo com turma semanal.</p></div></div>{notice && <div className="toast"><span>✓</span>{notice}</div>}<ModuleState loading={loading} error={error}/>
    <div className="metrics">
      <MetricLite label="Planos" value={(data["/plans"] ?? []).length}/><MetricLite label="Matrículas" value={(data["/enrollments"] ?? []).length}/><MetricLite label="Cobranças" value={(data["/charges"] ?? []).length}/><MetricLite label="Pagamentos" value={(data["/payments"] ?? []).length}/>
    </div>
    <div className="dashboard-grid">
      <form className="card modal-form" onSubmit={createPlan}><h2>Novo plano</h2><label>Nome<input name="name" required/></label><div className="form-row"><label>Tipo<select name="kind"><option value="monthly">Mensal</option><option value="package">Pacote</option><option value="single">Avulso</option></select></label><label>Preço<input name="price" type="number" step=".01" required/></label></div><div className="form-row"><label>Sessões incluídas<input name="sessions_included" type="number" min="1"/></label><label>Duração (dias)<input name="duration_days" type="number" min="1"/></label></div><button className="btn primary">Criar plano</button></form>
      <form className="card modal-form" onSubmit={enroll}><h2>Nova matrícula</h2><div className="form-row"><Select name="patient_id" label="Paciente" rows={patients}/><Select name="plan_id" label="Plano" rows={data["/plans"] ?? []}/></div><div className="form-row"><Select name="unit_id" label="Unidade" rows={data["/units"] ?? []}/><Select name="group_slot_id" label="Turma (opcional)" rows={data["/group-slots"] ?? []} required={false}/></div><div className="form-row"><label>Início<input name="starts_at" type="date" required/></label><label>Dia do vencimento<input name="due_day" type="number" min="1" max="31" required/></label></div><label>Desconto<input name="discount" type="number" step=".01" defaultValue="0"/></label><button className="btn primary">Matricular</button></form>
    </div>
    <form className="card modal-form inline-form" onSubmit={pay}><h2>Registrar pagamento</h2><Select name="charge_id" label="Cobrança" rows={(data["/charges"] ?? []).map((row: Row) => ({...row,name:`${row.description} — ${brl(row.amount_cents-row.paid_cents)}`}))}/><label>Valor<input name="amount" type="number" step=".01" required/></label><label>Forma<select name="method"><option value="pix">PIX</option><option value="card">Cartão</option><option value="cash">Dinheiro</option><option value="transfer">Transferência</option></select></label><button className="btn primary">Receber</button></form>
    <OperationalTable title="Matrículas ativas" rows={data["/enrollments"] ?? []} fields={["status","starts_at","due_day","sessions_used"]}/>
    <OperationalTable title="Cobranças" rows={data["/charges"] ?? []} fields={["description","due_at","status","amount_cents","paid_cents"]}/>
  </div>;
}

export function OperationalRecords() {
  const basePaths = ["/patients?page=1&pageSize=100", "/professionals", "/units", "/record-templates"];
  const { data, loading, error, reload } = useResources(basePaths);
  const patients = data[basePaths[0]]?.items ?? [];
  const [patientId, setPatientId] = useState("");
  const [records, setRecords] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  const loadRecords = useCallback(async (id: string) => {
    setPatientId(id);
    if (!id) return setRecords([]);
    try { setRecords((await api<Row[]>(`/clinical-records?patientId=${id}`)).data ?? []); } catch (e) { setNotice(messageOf(e)); }
  }, []);
  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    try { await api("/clinical-records", { method: "POST", body: JSON.stringify({
      patient_id: patientId, professional_id: value(form, "professional_id"), unit_id: value(form, "unit_id"),
      kind: value(form, "kind"), template_id: value(form, "template_id") || undefined,
      payload: { text: value(form, "text"), measures: value(form, "measures") },
    }) }); event.currentTarget.reset(); await loadRecords(patientId); setNotice("Registro clínico salvo como rascunho."); } catch (e) { setNotice(messageOf(e)); }
  }
  async function sign(id: string) { try { await api(`/clinical-records/${id}/sign`, { method: "POST", idempotencyKey: crypto.randomUUID() }); await loadRecords(patientId); } catch (e) { setNotice(messageOf(e)); } }
  async function rectify(id: string) {
    const reason = window.prompt("Justificativa da retificação (mínimo 10 caracteres):");
    const text = window.prompt("Texto corrigido:");
    if (!reason || !text) return;
    try { await api(`/clinical-records/${id}/rectify`, { method: "POST", body: JSON.stringify({ reason, payload: { text } }) }); await loadRecords(patientId); } catch (e) { setNotice(messageOf(e)); }
  }
  return <div className="content"><div className="page-title"><div><p className="eyebrow">PRONTUÁRIO ELETRÔNICO</p><h1>Avaliações e evoluções</h1><p>Registros assinados são imutáveis; correções geram retificações.</p></div><Select name="patient" label="Paciente" rows={patients}/></div>
    <label className="card record-selector">Paciente<select value={patientId} onChange={(e) => loadRecords(e.target.value)}><option value="">Selecione</option>{patients.map((row: Row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
    {notice && <div className="toast"><span>✓</span>{notice}</div>}<ModuleState loading={loading} error={error}/>
    {patientId && <form className="card modal-form" onSubmit={createRecord}><h2>Novo registro</h2><div className="form-row"><label>Tipo<select name="kind"><option value="assessment">Avaliação</option><option value="evolution">Evolução</option></select></label><Select name="template_id" label="Modelo (opcional)" rows={data["/record-templates"] ?? []} required={false}/></div><div className="form-row"><Select name="professional_id" label="Profissional" rows={data["/professionals"] ?? []}/><Select name="unit_id" label="Unidade" rows={data["/units"] ?? []}/></div><label>Descrição<textarea name="text" rows={6} required/></label><label>Medidas/escalas<textarea name="measures" rows={2}/></label><button className="btn primary">Salvar rascunho</button></form>}
    <section className="card table-card">{records.map((row) => <div className="operational-row" key={row.id}><div><strong>{row.kind} · {row.status}</strong><small>{new Date(row.created_at).toLocaleString("pt-BR")} · {JSON.stringify(row.payload)}</small></div><div className="row-actions">{row.status === "draft" && <button onClick={() => sign(row.id)}>Assinar</button>}{row.status === "signed" && <button onClick={() => rectify(row.id)}>Retificar</button>}</div></div>)}{patientId && !records.length && <div className="empty-state">Paciente sem registros clínicos.</div>}</section>
  </div>;
}

export function OperationalFinance() {
  const today = new Date();
  const first = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-01`;
  const last = new Date(today.getFullYear(), today.getMonth()+1, 0).toISOString().slice(0,10);
  const paths = [`/financial-entries?from=${first}&to=${last}`, "/charges", "/payments", "/commissions", "/professionals", "/units"];
  const { data, loading, error, reload } = useResources(paths); const [notice,setNotice]=useState("");
  async function entry(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f=new FormData(event.currentTarget); try { await api("/financial-entries",{method:"POST",body:JSON.stringify({unit_id:value(f,"unit_id"),kind:value(f,"kind"),description:value(f,"description"),category:value(f,"category"),cost_center:value(f,"cost_center")||undefined,amount_cents:cents(value(f,"amount")),competence_date:value(f,"date"),settled_at:f.get("settled")?new Date().toISOString():undefined})}); event.currentTarget.reset(); await reload(); setNotice("Movimento salvo."); } catch(e){setNotice(messageOf(e));}}
  async function commission(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const f=new FormData(event.currentTarget); try { await api("/commissions",{method:"POST",body:JSON.stringify({unit_id:value(f,"unit_id"),professional_id:value(f,"professional_id"),amount_cents:cents(value(f,"amount")),basis:value(f,"basis")})}); event.currentTarget.reset(); await reload(); setNotice("Comissão calculada."); } catch(e){setNotice(messageOf(e));}}
  async function approve(id:string){try{await api(`/commissions/${id}/approve`,{method:"POST"});await reload();}catch(e){setNotice(messageOf(e));}}
  const entries:Row[]=data[paths[0]]??[]; const income=entries.filter(x=>x.kind==="income").reduce((s,x)=>s+x.amount_cents,0); const expense=entries.filter(x=>x.kind==="expense").reduce((s,x)=>s+x.amount_cents,0);
  return <div className="content"><div className="page-title"><div><p className="eyebrow">FINANCEIRO REAL</p><h1>Entradas, saídas e comissões</h1><p>Regime de competência e realizado por unidade.</p></div></div>{notice&&<div className="toast"><span>✓</span>{notice}</div>}<ModuleState loading={loading} error={error}/>
    <div className="metrics"><MetricLite label="Receitas do mês" value={brl(income)}/><MetricLite label="Despesas do mês" value={brl(expense)}/><MetricLite label="Resultado" value={brl(income-expense)}/><MetricLite label="Comissões" value={(data["/commissions"]??[]).length}/></div>
    <div className="dashboard-grid"><form className="card modal-form" onSubmit={entry}><h2>Novo movimento</h2><div className="form-row"><Select name="unit_id" label="Unidade" rows={data["/units"]??[]}/><label>Tipo<select name="kind"><option value="income">Entrada</option><option value="expense">Saída</option></select></label></div><label>Descrição<input name="description" required/></label><div className="form-row"><label>Categoria<input name="category" required/></label><label>Centro de custo<input name="cost_center"/></label></div><div className="form-row"><label>Valor<input name="amount" type="number" step=".01" required/></label><label>Competência<input name="date" type="date" required defaultValue={today.toISOString().slice(0,10)}/></label></div><label className="check"><input type="checkbox" name="settled"/>Já realizado</label><button className="btn primary">Lançar</button></form>
    <form className="card modal-form" onSubmit={commission}><h2>Nova comissão</h2><Select name="unit_id" label="Unidade" rows={data["/units"]??[]}/><Select name="professional_id" label="Profissional" rows={data["/professionals"]??[]}/><div className="form-row"><label>Base<select name="basis"><option value="appointment">Atendimento</option><option value="payment">Recebimento</option></select></label><label>Valor<input name="amount" type="number" step=".01" required/></label></div><button className="btn primary">Calcular comissão</button></form></div>
    <OperationalTable title="Movimentos do mês" rows={entries} fields={["competence_date","description","category","kind","amount_cents"]}/>
    <section className="card table-card"><div className="table-toolbar"><h2>Comissões</h2></div>{(data["/commissions"]??[]).map((row:Row)=><div className="operational-row" key={row.id}><div><strong>{brl(row.amount_cents)}</strong><small>{row.basis} · {row.status}</small></div>{row.status==="pending"&&<button onClick={()=>approve(row.id)}>Aprovar e lançar despesa</button>}</div>)}</section>
  </div>;
}

export function OperationalReports() {
  const [year,setYear]=useState(new Date().getFullYear()); const [report,setReport]=useState<Row|null>(null); const [error,setError]=useState("");
  async function load(){try{setReport((await api<Row>(`/reports/annual?year=${year}`)).data);}catch(e){setError(messageOf(e));}}
  useEffect(()=>void load(),[year]);
  function exportCsv(){if(!report)return;const csv=["Mês;Receitas;Despesas;Previsto receitas;Previsto despesas",...(report.months??[]).map((m:Row)=>[m.month,m.realizedIncomeCents,m.realizedExpenseCents,m.expectedIncomeCents,m.expectedExpenseCents].join(";"))].join("\n");const url=URL.createObjectURL(new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download=`fisiofit-relatorio-${year}.csv`;a.click();URL.revokeObjectURL(url);}
  return <div className="content"><div className="page-title"><div><p className="eyebrow">FECHAMENTO E ANÁLISE</p><h1>Relatório anual</h1><p>Doze meses lado a lado, previsto e realizado.</p></div><div className="title-actions"><input type="number" value={year} onChange={e=>setYear(Number(e.target.value))}/><button className="btn secondary" onClick={exportCsv}>Exportar planilha</button><button className="btn primary" onClick={()=>window.print()}>Gerar PDF</button></div></div>{error&&<div className="login-error">{error}</div>}
    <div className="metrics"><MetricLite label="Receitas realizadas" value={brl(report?.totals?.realizedIncomeCents??0)}/><MetricLite label="Despesas realizadas" value={brl(report?.totals?.realizedExpenseCents??0)}/><MetricLite label="Resultado" value={brl((report?.totals?.realizedIncomeCents??0)-(report?.totals?.realizedExpenseCents??0))}/><MetricLite label="Ano" value={year}/></div>
    <section className="card annual-table"><div className="month-grid"><div className="month-row head"><strong>Indicador</strong>{(report?.months??[]).map((m:Row)=><span key={m.month}>{m.month.slice(5,7)}</span>)}<strong>Total</strong></div>{[["Receitas","realizedIncomeCents"],["Despesas","realizedExpenseCents"],["Prev. receitas","expectedIncomeCents"],["Prev. despesas","expectedExpenseCents"]].map(([label,key])=><div className="month-row" key={key}><strong>{label}</strong>{(report?.months??[]).map((m:Row)=><span key={m.month}>{brl(m[key])}</span>)}<strong>{brl(report?.totals?.[key]??0)}</strong></div>)}</div></section>
  </div>;
}

export function OperationalImports() {
  const {data,loading,error,reload}=useResources(["/units","/imports"]);const [rows,setRows]=useState<Row[]>([]);const [filename,setFilename]=useState("");const [preview,setPreview]=useState<Row|null>(null);const [notice,setNotice]=useState("");
  function choose(event:React.ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file)return;setFilename(file.name);void file.text().then(text=>{const lines=text.split(/\r?\n/).filter(Boolean);const headers=lines.shift()?.split(/[;,]/).map(h=>h.trim().toLowerCase())??[];setRows(lines.map(line=>{const cells=line.split(/[;,]/);return Object.fromEntries(headers.map((h,i)=>[h,cells[i]?.trim()||undefined]));}));});}
  async function run(event:FormEvent<HTMLFormElement>,dryRun:boolean){event.preventDefault();const f=new FormData(event.currentTarget);try{const response=await api<Row>("/imports/patients",{method:"POST",idempotencyKey:crypto.randomUUID(),body:JSON.stringify({source:value(f,"source"),filename,unit_id:value(f,"unit_id"),dryRun,rows:rows.map(r=>({external_id:r.external_id||r.id,name:r.name||r.nome,cpf:r.cpf,birth_date:r.birth_date||r.nascimento,phone:r.phone||r.telefone,email:r.email,notes:r.notes||r.observacoes}))})});setPreview(response.data);setNotice(dryRun?"Pré-validação concluída.":"Importação concluída.");if(!dryRun)await reload();}catch(e){setNotice(messageOf(e));}}
  return <div className="content"><div className="page-title"><div><p className="eyebrow">MIGRAÇÃO RASTREÁVEL</p><h1>Importações</h1><p>CSV com prévia, validação de CPF, deduplicação e lote auditável.</p></div></div>{notice&&<div className="toast"><span>✓</span>{notice}</div>}<ModuleState loading={loading} error={error}/><form className="card modal-form" onSubmit={e=>run(e,true)}><div className="form-row"><label>Origem<select name="source"><option value="manual">Planilha manual</option><option value="oluma">Oluma</option><option value="notion">Notion</option></select></label><Select name="unit_id" label="Unidade de destino" rows={data["/units"]??[]}/></div><label>Arquivo CSV<input type="file" accept=".csv,text/csv" onChange={choose} required/></label><p>{rows.length} linhas carregadas.</p><div className="title-actions"><button className="btn secondary" type="submit">Pré-validar</button><button className="btn primary" type="button" disabled={!preview} onClick={(e)=>run({preventDefault:()=>{},currentTarget:(e.currentTarget.closest("form") as HTMLFormElement)} as any,false)}>Importar válidos</button></div>{preview&&<div className="environment-warning">Aceitos: {preview.accepted??preview.imported??0} · Rejeitados: {preview.rejected?.length??0}</div>}</form><OperationalTable title="Histórico de lotes" rows={data["/imports"]??[]} fields={["filename","source","status","totals","created_at"]}/></div>;
}

export function OperationalUsers() {
  const {data,loading,error,reload}=useResources(["/users","/units"]);const [notice,setNotice]=useState("");
  async function invite(event:FormEvent<HTMLFormElement>){event.preventDefault();const f=new FormData(event.currentTarget);try{await api("/users/invite",{method:"POST",body:JSON.stringify({email:value(f,"email"),name:value(f,"name"),role:value(f,"role"),unitIds:f.getAll("unitIds")})});event.currentTarget.reset();await reload();setNotice("Convite enviado.");}catch(e){setNotice(messageOf(e));}}
  async function update(id:string,status:string){try{await api(`/users/${id}`,{method:"PATCH",body:JSON.stringify({status})});await reload();}catch(e){setNotice(messageOf(e));}}
  return <div className="content"><div className="page-title"><div><p className="eyebrow">ACESSOS E PERMISSÕES</p><h1>Usuários</h1><p>Convites, perfis, unidades, bloqueio e MFA por função.</p></div></div>{notice&&<div className="toast"><span>✓</span>{notice}</div>}<ModuleState loading={loading} error={error}/><form className="card modal-form" onSubmit={invite}><h2>Convidar colaboradora</h2><div className="form-row"><label>Nome<input name="name" required/></label><label>E-mail<input name="email" type="email" required/></label></div><label>Perfil<select name="role"><option value="reception">Recepção</option><option value="professional">Profissional</option><option value="finance">Financeiro</option><option value="manager">Gestor</option><option value="admin">Administrador</option></select></label><label>Unidades<div className="weekday-checks">{(data["/units"]??[]).map((u:Unit)=><label key={u.id}><input type="checkbox" name="unitIds" value={u.id}/>{u.name}</label>)}</div></label><button className="btn primary">Enviar convite</button></form><section className="card table-card">{(data["/users"]??[]).map((row:Row)=><div className="operational-row" key={row.id}><div><strong>{row.name}</strong><small>{row.role} · {row.status} · MFA {row.mfa_required?"obrigatório":"opcional"}</small></div><div className="row-actions"><button onClick={()=>update(row.id,"active")}>Ativar</button><button onClick={()=>update(row.id,"blocked")}>Bloquear</button></div></div>)}</section></div>;
}

function MetricLite({label,value}:{label:string;value:string|number}){return <div className="metric-card"><div className="metric-copy"><small>{label}</small><strong>{value}</strong></div></div>;}
function OperationalTable({title,rows,fields}:{title:string;rows:Row[];fields:string[]}){return <section className="card table-card"><div className="table-toolbar"><h2>{title}</h2><span>{rows.length} registros</span></div>{rows.map((row)=><div className="operational-row" key={row.id}><div>{fields.map((field,index)=>index===0?<strong key={field}>{render(row[field],field)}</strong>:<small key={field}>{field}: {render(row[field],field)}</small>)}</div></div>)}{!rows.length&&<div className="empty-state">Nenhum registro cadastrado.</div>}</section>;}
function render(value:any,field:string){if(value==null)return"—";if(field.includes("amount")||field.includes("paid_cents"))return brl(Number(value));if(typeof value==="object")return JSON.stringify(value);return String(value);}
