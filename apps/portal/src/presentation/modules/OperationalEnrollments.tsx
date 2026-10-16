import { confirmAction } from '../components/Decisions';
import { Notice } from "@fisiofit/design-system/react";
import { PlanCatalog } from "./PlanCatalog";
import { PlanChangeDialog } from "./PlanChangeDialog";
import { MonthlyPayments } from "./MonthlyPayments";
import { RelatedActions, SectionIntro, useModuleState, useWorkspace } from "../components/ModuleWorkspace";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { buildPlanControlRows, renewalCopy, type PlanControlRow } from "../../application/portal/planControl";
import { buildAvailablePaymentPlans } from "../../application/portal/paymentPlans";
import { SelectField, TextField } from "../components/FormPrimitives";
import { type AgendaEnrollmentContext, Row, messageOf, statusLabel, value, cents, brl, groupSlotLabel, useDialogFocus, useResources, PlanSelect, PatientPicker, DrawerForm, ModuleState, MetricLite, OperationalTable, dateKey, localDateAtNoonIso } from "./OperationalShared";

export function OperationalEnrollments({ agendaContext, onClearAgendaContext, openEnrollment = false, units = [], selectedUnitId = "", onUnitChange = () => undefined, canEdit = true, canManagePlans = true, canViewCharges = true, canViewPayments = true, canReceivePayments = true, canCorrectChargeAmounts = false, canViewPatients = true, canViewAgenda = true }: { agendaContext?: AgendaEnrollmentContext; onClearAgendaContext?: () => void; openEnrollment?: boolean; units?: Array<{ id: string; name: string }>; selectedUnitId?: string; onUnitChange?: (unitId: string) => void; canEdit?: boolean; canManagePlans?: boolean; canDeletePlans?: boolean; canViewCharges?: boolean; canViewPayments?: boolean; canReceivePayments?: boolean; canRollback?: boolean; canCorrectChargeAmounts?: boolean; canViewPatients?: boolean; canViewAgenda?: boolean }) {
  const contextPatient = useWorkspace()?.journey?.patient;
  const paths = [
    "/plans",
    "/enrollments",
    "/enrollment-price-terms",
    ...(canViewPatients ? ["/patients?page=1&pageSize=100"] : []),
    "/units",
    ...(canViewAgenda ? ["/group-slots"] : []),
    "/professionals",
    ...(canViewCharges ? ["/charges"] : []),
    ...(canViewPayments ? ["/payments"] : []),
  ];
  const { data, loading, error, reload } = useResources(paths);
  const patients: Row[] = useMemo(() => canViewPatients ? data["/patients?page=1&pageSize=100"]?.items ?? [] : [...new Map((data["/enrollments"] ?? []).filter((row: Row) => row.patient).map((row: Row) => [row.patient.id, row.patient])).values()] as Row[], [data, canViewPatients]);
  const [notice, setNotice] = useState("");
  const sectionFromPath = () => window.location.pathname.includes("/matriculas/historico") ? "history" : window.location.pathname.includes("/matriculas/planos") ? "catalog" : window.location.pathname.includes("/matriculas/gestao") ? "management" : "control";
  const [section, setSection] = useModuleState<"control" | "management" | "history" | "catalog">("enrollments.section", sectionFromPath);
  const navigateSection = (next: "control" | "management" | "history" | "catalog") => { window.history.pushState({}, "", `/sistema/matriculas/${next === "catalog" ? "planos" : next === "management" ? "gestao" : next === "history" ? "historico" : "controle"}`); setSection(next); };
  useEffect(() => { const sync = () => setSection(sectionFromPath()); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
  const [paymentMonth, setPaymentMonth] = useModuleState("enrollments.month", () => dateKey(new Date()).slice(0, 7));
  const [selectedPatient, setSelectedPatient] = useState<Row>();
  const [selectedEnrollmentGroup, setSelectedEnrollmentGroup] = useState(agendaContext?.groupSlotId ?? "");
  const [selectedEnrollmentUnit, setSelectedEnrollmentUnit] = useState(agendaContext?.unitId ?? selectedUnitId);
  const [patientPickerVersion, setPatientPickerVersion] = useState(0);
  const [changingEnrollmentId, setChangingEnrollmentId] = useState("");
  const [controlSearch, setControlSearch] = useModuleState("enrollments.search", "");
  const [controlFilter, setControlFilter] = useModuleState("enrollments.filter", "all");
  const [editingControlRow, setEditingControlRow] = useState<PlanControlRow | null>(null);
  const [savingControlRow, setSavingControlRow] = useState(false);
  const paymentPending = useRef(false);
  const paymentAttempt = useRef<{ payload: string; key: string }>();
  const [receivingPayment, setReceivingPayment] = useState(false);
  const [selectedPaymentChargeId, setSelectedPaymentChargeId] = useState("");
  const [selectedPaymentPatientId, setSelectedPaymentPatientId] = useState("");
  const [paymentPatientPickerVersion, setPaymentPatientPickerVersion] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState("");
  useEffect(() => {
    setSelectedPatient(undefined); setSelectedEnrollmentUnit(selectedUnitId); setSelectedEnrollmentGroup("");
    setSelectedPaymentPatientId(""); setSelectedPaymentChargeId(""); setPaymentAmount("");
    setPatientPickerVersion((version) => version + 1); setPaymentPatientPickerVersion((version) => version + 1);
  }, [selectedUnitId]);
  useEffect(() => { if (contextPatient) { setSelectedPatient(contextPatient); setSection("control"); setControlSearch(""); setControlFilter("all"); } }, [contextPatient?.id]);
  async function enroll(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const patientId = value(form, "patient_id");
    const planId = value(form, "plan_id");
    try {
      await api<Row>("/enrollments", {
        method: "POST",
        body: JSON.stringify({ patient_id: patientId, plan_id: planId, unit_id: value(form, "unit_id"), group_slot_id: value(form, "group_slot_id") || undefined, starts_at: value(form, "starts_at"), ends_at: value(form, "ends_at") || undefined, due_day: Number(value(form, "due_day")), discount_cents: cents(value(form, "discount") || "0"), surcharge_cents: 0 }),
      });
      formElement.reset();
      setSelectedPatient(undefined);
      setSelectedEnrollmentGroup("");
      setSelectedEnrollmentUnit("");
      setPatientPickerVersion((version) => version + 1);
      await reload();
      setNotice("Matrícula salva com sucesso.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (paymentPending.current) return;
    const paymentForm = event.currentTarget;
    const form = new FormData(paymentForm);
    paymentPending.current = true;
    setReceivingPayment(true);
    try {
      const payload = JSON.stringify({
        charge_id: value(form, "charge_id"),
        amount_cents: cents(value(form, "amount")),
        method: value(form, "method"),
        paid_at: localDateAtNoonIso(value(form, "paid_at")),
      });
      if (paymentAttempt.current?.payload !== payload) {
        paymentAttempt.current = { payload, key: crypto.randomUUID() };
      }
      await api("/payments", {
        method: "POST",
        idempotencyKey: paymentAttempt.current.key,
        body: payload,
      });
      paymentAttempt.current = undefined;
      paymentForm.reset();
      setSelectedPaymentChargeId("");
      setSelectedPaymentPatientId("");
      setPaymentPatientPickerVersion((version) => version + 1);
      setPaymentAmount("");
      await reload();
      setNotice("Pagamento registrado.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      paymentPending.current = false;
      setReceivingPayment(false);
    }
  }
  async function updateControlledPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingControlRow || savingControlRow) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setSavingControlRow(true);
    try {
      await api(`/enrollments/${editingControlRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          sessions_used: Number(value(form, "sessions_used")),
          status: value(form, "status"),
        }),
      });
      await reload();
      setEditingControlRow(null);
      setNotice("Dados do plano atualizados.");
    } catch (error) {
      setNotice(messageOf(error));
    } finally {
      setSavingControlRow(false);
    }
  }
  const availablePaymentPlans = useMemo(() => buildAvailablePaymentPlans({
    charges: (data["/charges"] ?? []).filter((row: Row) => row.coverage_from ? String(row.coverage_from).slice(0, 7) <= paymentMonth && String(row.coverage_to).slice(0, 7) >= paymentMonth : String(row.due_at).slice(0, 7) === paymentMonth),
    enrollments: data["/enrollments"] ?? [],
    plans: data["/plans"] ?? [],
  }), [data, paymentMonth]);
  const payablePatientIds = useMemo(() => [...new Set(availablePaymentPlans.map((row) => row.patientId))], [availablePaymentPlans]);
  const selectedPatientPlans = selectedPaymentPatientId
    ? availablePaymentPlans.filter((row) => row.patientId === selectedPaymentPatientId)
    : [];
  const selectedPaymentPlan = selectedPatientPlans.find((row) => row.chargeId === selectedPaymentChargeId);
  const selectedPaymentBalance = selectedPaymentPlan?.balanceCents ?? 0;
  const selectPaymentPatient = (patient: Row) => {
    const patientPlans = availablePaymentPlans.filter((row) => row.patientId === patient.id);
    const onlyPlan = patientPlans.length === 1 ? patientPlans[0] : undefined;
    setSelectedPaymentPatientId(patient.id);
    setSelectedPaymentChargeId(onlyPlan?.chargeId ?? "");
    setPaymentAmount(onlyPlan ? (onlyPlan.balanceCents / 100).toFixed(2) : "");
  };
  const clearPaymentPatient = () => {
    setSelectedPaymentPatientId("");
    setSelectedPaymentChargeId("");
    setPaymentAmount("");
  };
  const controlRows = useMemo(() => buildPlanControlRows({
    enrollments: data["/enrollments"] ?? [],
    patients,
    plans: data["/plans"] ?? [],
    charges: data["/charges"] ?? [],
    payments: data["/payments"] ?? [],
  }), [data, patients]);
  const filteredControlRows = useMemo(() => {
    const search = controlSearch.trim().toLocaleLowerCase("pt-BR");
    return controlRows.filter((row) => {
      const matchesSearch = !search || `${row.patientName} ${row.patientPhone} ${row.planName}`.toLocaleLowerCase("pt-BR").includes(search);
      const matchesFilter = controlFilter === "all"
        || (controlFilter === "due-soon" && row.renewalState === "due-soon")
        || (controlFilter === "expired" && row.renewalState === "expired")
        || (controlFilter === "active" && row.enrollmentStatus === "active");
      return matchesSearch && matchesFilter && (!contextPatient || (data['/enrollments'] ?? []).some((enrollment: Row) => enrollment.id === row.id && enrollment.patient_id === contextPatient.id));
    });
  }, [controlFilter, controlRows, controlSearch, contextPatient?.id]);
  const activeControlRows = controlRows.filter((row) => row.enrollmentStatus === "active");
  const paidPlans = activeControlRows.filter((row) => row.paymentState === "paid").length;
  const dueSoonPlans = activeControlRows.filter((row) => row.renewalState === "due-soon").length;
  const attentionPlans = activeControlRows.filter((row) => row.renewalState === "expired" || ["overdue", "partial"].includes(row.paymentState)).length;
  return (
    <div className="content">
      <header className="enrollment-module-header"><div><p className="eyebrow">PACIENTES / MATRÍCULAS</p><h1>Matrículas e planos</h1><p>Financeiro mensal e gestão das matrículas dos pacientes.</p></div><nav className="enrollment-module-nav" aria-label="Áreas de matrículas">{([['control', 'Controle de Planos'], ['management', 'Matrículas'], ...(canManagePlans ? [['catalog', 'Gestão de Planos']] as const : []), ['history', 'Histórico']] as const).map(([value, label]) => <button type="button" key={value} className={section === value ? "active" : ""} aria-current={section === value ? "page" : undefined} onClick={() => navigateSection(value)}>{label}</button>)}</nav></header>
      {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
      <ModuleState loading={loading} error={error} retry={reload} />
      {contextPatient && <section className="patient-workspace-heading"><div><p className="eyebrow">JORNADA DO PACIENTE</p><h2>{contextPatient.name}</h2><p>Matrícula → plano → cobrança → recebimento</p></div><RelatedActions patient={contextPatient} exclude="Matrículas" /></section>}
      {section === 'management' && <SectionIntro title="Contratação e vigência">Crie a matrícula com o plano e a turma existentes. Confira cobranças no controle mensal e consulte alterações no histórico.</SectionIntro>}
      {section === "control" && canViewCharges && <MonthlyPayments patientId={contextPatient?.id} onChangePlan={canEdit ? setChangingEnrollmentId : undefined} data={data} month={paymentMonth} onMonth={(month) => { setPaymentMonth(month); clearPaymentPatient(); }} canEdit={canReceivePayments} canCorrectChargeAmounts={canCorrectChargeAmounts} reload={reload} onNotice={setNotice} onRegisterPayment={(row) => { setPaymentPatientPickerVersion((version) => version + 1); setSelectedPaymentPatientId(row.patientId); setSelectedPaymentChargeId(row.chargeId); setPaymentAmount((row.balanceCents / 100).toFixed(2)); requestAnimationFrame(() => { const form = document.getElementById("payment-registration"); form?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? "auto" : "smooth", block: "start" }); form?.querySelector<HTMLInputElement>('#payment-amount')?.focus({preventScroll:true}); }); }} />}
      {section === "catalog" && canManagePlans && <PlanCatalog plans={data["/plans"] ?? []} reload={reload} onNotice={setNotice} />}
      {changingEnrollmentId && <PlanChangeDialog enrollment={(data["/enrollments"] ?? []).find((e: Row) => e.id === changingEnrollmentId)!} plans={data["/plans"] ?? []} onClose={() => setChangingEnrollmentId("")} onChanged={async () => { await reload(); setNotice("Plano trocado com auditoria. Histórico financeiro preservado."); }} />}
      {section === "history" && <EnrollmentHistoryPanel rows={controlRows.filter(row => !contextPatient || (data['/enrollments'] ?? []).some((enrollment: Row) => enrollment.id === row.id && enrollment.patient_id === contextPatient.id))} charges={canViewCharges ? data["/charges"] ?? [] : []} payments={canViewPayments ? data["/payments"] ?? [] : []} />}
      {section === "management" && <>
      <div className="metrics">
        <MetricLite label="Pacientes com plano" value={activeControlRows.length} />
        <MetricLite label="Pagamentos em dia" value={paidPlans} />
        <MetricLite label="Renovam em até 7 dias" value={dueSoonPlans} />
        <MetricLite label="Precisam de atenção" value={attentionPlans} />
      </div>
      <PlanControlTable
        onChangePlan={canEdit ? (row) => setChangingEnrollmentId(row.id) : undefined}
        rows={filteredControlRows}
        total={controlRows.length}
        search={controlSearch}
        filter={controlFilter}
        onSearch={setControlSearch}
        onFilter={setControlFilter}
        units={units}
        selectedUnitId={selectedUnitId}
        onUnitChange={onUnitChange}
          onEdit={canEdit ? (row) => { setNotice(""); setEditingControlRow(row); } : undefined}
      />
      {editingControlRow && (
        <EditControlledPlanDialog
          row={editingControlRow}
          plans={(data["/plans"] ?? []).filter((plan: Row) => plan.active !== false || plan.id === editingControlRow.planId)}
          saving={savingControlRow}
          notice={notice}
          endsAt={(data["/enrollments"] ?? []).find((row: Row) => row.id === editingControlRow.id)?.ends_at ?? ""}
          onClose={() => setEditingControlRow(null)}
          onSubmit={updateControlledPlan}
        />
      )}
      {(canManagePlans || canEdit) && <div className="dashboard-grid">
        {canEdit && (
        <DrawerForm title="Nova matrícula" onSubmit={enroll} openInitially={openEnrollment || Boolean(agendaContext)} onClose={onClearAgendaContext}>
          <h2>Nova matrícula</h2>
          {notice && <Notice message={notice} onDismiss={() => setNotice("")} />}
          <div className="form-row">
            <PatientPicker key={patientPickerVersion} name="patient_id" label="Paciente" rows={patients} defaultValue={contextPatient?.id} defaultLabel={contextPatient?.name} remoteSearch={canViewPatients} onSelect={setSelectedPatient} />
            <PlanSelect rows={data["/plans"] ?? []} />
          </div>
          {selectedPatient && <div className="agenda-context-summary" role="status"><strong>Paciente selecionado</strong><span>{selectedPatient.name}{selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}{selectedPatient.cpf ? ` · CPF ${selectedPatient.cpf}` : ""}</span></div>}
          {agendaContext ? <div className="agenda-context-summary" role="status"><input type="hidden" name="unit_id" value={agendaContext.unitId} /><input type="hidden" name="group_slot_id" value={agendaContext.groupSlotId} /><strong>{agendaContext.groupName ?? "Turma selecionada"}</strong><span>{agendaContext.unitName ?? "Unidade selecionada"} · turma escolhida na Agenda</span><button type="button" onClick={onClearAgendaContext}>Trocar turma</button></div> : <div className="form-row"><SelectField name="unit_id" label="Unidade" required value={selectedEnrollmentUnit} onChange={(event) => { setSelectedEnrollmentUnit(event.target.value); setSelectedEnrollmentGroup(""); }}><option value="">Selecione</option>{(data["/units"] ?? []).map((unit: Row) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</SelectField><SelectField name="group_slot_id" label="Turma (opcional)" value={selectedEnrollmentGroup} disabled={!selectedEnrollmentUnit} onChange={(event) => setSelectedEnrollmentGroup(event.target.value)}><option value="">{selectedEnrollmentUnit ? "Nenhuma" : "Selecione a unidade primeiro"}</option>{(data["/group-slots"] ?? []).filter((slot: Row) => slot.unit_id === selectedEnrollmentUnit && slot.active !== false).map((slot: Row) => { const professional = (data["/professionals"] ?? []).find((row: Row) => row.id === slot.professional_id); return <option key={slot.id} value={slot.id}>{groupSlotLabel(slot, professional?.name)}</option>; })}</SelectField></div>}
          {!agendaContext && selectedEnrollmentGroup && (() => { const slot = (data["/group-slots"] ?? []).find((row: Row) => row.id === selectedEnrollmentGroup); return slot ? <div className="agenda-context-summary" role="status"><strong>Turma escolhida</strong><span>{groupSlotLabel(slot)}</span></div> : null; })()}
            <div className="form-row">
              <TextField id="enrollment-starts-at" name="starts_at" label="Início" type="date" defaultValue={agendaContext?.startsAt} readOnly={Boolean(agendaContext)} required />
              <TextField id="enrollment-ends-at" name="ends_at" label="Fim do período" type="date" />
            </div>
            <div className="form-row">
              <TextField id="enrollment-due-day" name="due_day" label="Dia do vencimento" type="number" min="1" max="31" required />
          </div>
          <TextField id="enrollment-discount" name="discount" label="Desconto" type="number" min="0" step=".01" defaultValue="0" />
          <button className="btn primary">Criar matrícula</button>
        </DrawerForm>
        )}
      </div>}
      </>}
      {section === "control" && canReceivePayments && <form id="payment-registration" className="card modal-form payment-registration-card" onSubmit={pay}>
        <div className="payment-registration-heading">
          <div>
            <p className="eyebrow">RECEBIMENTO</p>
            <h2>Registrar pagamento</h2>
            <p>Escolha a pessoa para ver somente os planos disponíveis para pagamento.</p>
          </div>
          <span>{payablePatientIds.length} {payablePatientIds.length === 1 ? "pessoa com saldo" : "pessoas com saldo"}</span>
        </div>
        <div className="payment-registration-grid">
          <PatientPicker
            key={paymentPatientPickerVersion}
            id="payment-patient"
            name="payment_patient_id"
            label="Pessoa"
            rows={patients}
            remoteSearch={canViewPatients}
            defaultValue={selectedPaymentPatientId}
            defaultLabel={patients.find((row) => row.id === selectedPaymentPatientId)?.name ?? ""}
            allowedIds={payablePatientIds}
            onSelect={selectPaymentPatient}
            onClear={clearPaymentPatient}
          />
          <SelectField id="payment-charge" name="charge_id" label="Plano disponível" required disabled={!selectedPaymentPatientId} value={selectedPaymentChargeId} hint={!selectedPaymentPatientId ? "Selecione a pessoa primeiro." : selectedPatientPlans.length ? `${selectedPatientPlans.length} ${selectedPatientPlans.length === 1 ? "plano disponível" : "planos disponíveis"}.` : "Nenhum plano com saldo disponível."} onChange={(event) => {
          const chargeId = event.target.value;
          const plan = selectedPatientPlans.find((row) => row.chargeId === chargeId);
          const balance = plan?.balanceCents ?? 0;
          setSelectedPaymentChargeId(chargeId);
          setPaymentAmount(balance > 0 ? (balance / 100).toFixed(2) : "");
        }}>
          <option value="">{selectedPaymentPatientId ? "Selecione o plano" : "Selecione a pessoa primeiro"}</option>
          {selectedPatientPlans.map((row) => (
            <option key={row.chargeId} value={row.chargeId}>{row.planName} · vencimento {row.dueAt} — {brl(row.balanceCents)}</option>
          ))}
        </SelectField>
        </div>
        {selectedPaymentPlan && <div className="payment-plan-summary" role="status" aria-live="polite">
          <div><span>Plano selecionado</span><strong>{selectedPaymentPlan.planName}</strong></div>
          <div><span>Vencimento</span><strong>{dateLabel(selectedPaymentPlan.dueAt)}</strong></div>
          <div><span>Saldo disponível</span><strong>{brl(selectedPaymentPlan.balanceCents)}</strong></div>
        </div>}
        <div className="payment-details-grid">
          <TextField id="payment-amount" name="amount" label="Valor a receber" type="number" inputMode="decimal" min="0.01" max={selectedPaymentBalance ? (selectedPaymentBalance / 100).toFixed(2) : undefined} step=".01" value={paymentAmount} disabled={!selectedPaymentChargeId} onChange={(event) => setPaymentAmount(event.target.value)} hint={selectedPaymentBalance ? `Máximo: ${brl(selectedPaymentBalance)}` : "Escolha um plano para informar o valor."} required />
          <TextField id="payment-paid-at" name="paid_at" label="Data do pagamento" type="date" defaultValue={dateKey(new Date())} required />
          <SelectField id="payment-method" name="method" label="Forma de pagamento">
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="cash">Dinheiro</option>
            <option value="transfer">Transferência</option>
          </SelectField>
        </div>
        <button className="btn primary payment-submit" disabled={!selectedPaymentChargeId || receivingPayment}>{receivingPayment ? "Registrando…" : "Confirmar recebimento"}</button>
      </form>}
      {section === "history" && canViewCharges && <OperationalTable
        title="Cobranças"
        rows={(data["/charges"] ?? []).filter((charge: Row) => !contextPatient || charge.patient_id === contextPatient.id)}
        fields={[
          "description",
          "due_at",
          "status",
          "amount_cents",
          "paid_cents",
        ]}
      />}
    </div>
  );
}

function EnrollmentHistoryPanel({ rows, charges, payments }: { rows: PlanControlRow[]; charges: Row[]; payments: Row[] }) {
  const [search, setSearch] = useModuleState("enrollments.history.search", "");
  const [patientId, setPatientId] = useModuleState("enrollments.history.selection", "");
  const matchingRows = rows.filter((row) => !search.trim() || `${row.patientName} ${row.planName}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));
  const selected = patientId ? matchingRows.find((row) => row.id === patientId) : matchingRows[0];
  const historyCharges = selected ? charges.filter((charge) => charge.enrollment_id === selected.id && !charge.deleted_at) : [];
  const historyPayments = selected ? payments.filter((payment) => historyCharges.some((charge) => charge.id === payment.charge_id) && !payment.deleted_at) : [];
  return <section className="enrollment-history card" aria-labelledby="enrollment-history-title"><div className="table-toolbar"><div><p className="eyebrow">CONSULTA</p><h2 id="enrollment-history-title">Histórico de matrículas</h2><p>Use os eventos já registrados para entender planos, cobranças e recebimentos.</p></div><TextField label="Buscar paciente ou plano" type="search" placeholder="Buscar paciente ou plano..." value={search} onChange={(event) => { setSearch(event.target.value); setPatientId(""); }} /></div><div className="history-layout"><div className="history-patients" aria-label="Pacientes encontrados">{matchingRows.map((row) => <button type="button" key={row.id} className={selected?.id === row.id ? "active" : ""} onClick={() => setPatientId(row.id)}><strong>{row.patientName}</strong><span>{row.planName}</span></button>)}{!matchingRows.length && <p>Nenhuma matrícula encontrada.</p>}</div><div className="history-events">{selected ? <><h3>{selected.patientName}</h3><p className="history-plan">{selected.planName}</p><article><strong>Matrícula</strong><span>Início: {dateLabel(selected.startsAt)} · Renovação: {dateLabel(selected.renewsAt)}</span></article>{historyCharges.map((charge) => <article key={charge.id}><strong>Cobrança</strong><span>{String(charge.description ?? "Cobrança do plano")} · {brl(Number(charge.amount_cents ?? 0))} · {statusLabel(charge.status)}</span></article>)}{historyPayments.map((payment) => <article key={payment.id}><strong>Recebimento</strong><span>{brl(Number(payment.amount_cents ?? 0))} · {dateLabel(String(payment.paid_at ?? ""), true)} · {({ pix: "PIX", card: "Cartão", cash: "Dinheiro", transfer: "Transferência" } as Record<string, string>)[String(payment.method)] ?? statusLabel(payment.method)}</span></article>)}{!historyCharges.length && <p className="history-empty">Não há cobranças registradas para esta matrícula.</p>}</> : <p>Selecione um paciente para consultar o histórico disponível.</p>}</div></div></section>;
}

function dateLabel(value: string, withTime = false) {
  if (!value) return "—";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", withTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" }).format(date);
}

function PlanControlTable({
  rows,
  total,
  search,
  filter,
  onSearch,
  onFilter,
  units,
  selectedUnitId,
  onUnitChange,
  onEdit,
  onChangePlan,
}: {
  rows: PlanControlRow[];
  total: number;
  search: string;
  filter: string;
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  units: Array<{ id: string; name: string }>;
  selectedUnitId: string;
  onUnitChange: (unitId: string) => void;
  onEdit?: (row: PlanControlRow) => void;
  onChangePlan?: (row: PlanControlRow) => void;
}) {
  return (
    <section className="card table-card plan-control-table" aria-labelledby="plan-control-title">
      <div className="table-toolbar plan-control-toolbar">
        <div>
          <p className="eyebrow">GESTÃO DA MATRÍCULA</p>
          <h2 id="plan-control-title">Renovações e dados dos planos</h2>
          <p>Edite o plano, acompanhe sessões e antecipe renovações. O pagamento do período fica no controle acima.</p>
        </div>
        <div className="plan-control-filters">
          <TextField fieldClassName="plan-control-filter-field plan-control-search-field" label="Buscar" type="search" placeholder="Paciente ou plano" value={search} onChange={(event) => onSearch(event.target.value)} />
          <SelectField fieldClassName="plan-control-filter-field" label="Situação" value={filter} onChange={(event) => onFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="due-soon">Renovam em até 7 dias</option>
            <option value="expired">Planos vencidos</option>
            <option value="active">Matrículas ativas</option>
          </SelectField>
          <SelectField fieldClassName="plan-control-filter-field" label="Clínica" value={selectedUnitId} onChange={(event) => onUnitChange(event.target.value)}>
            <option value="">Todas as clínicas</option>
            {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
          </SelectField>
        </div>
      </div>
      <div className="plan-control-result" role="status" aria-live="polite">
        Exibindo {rows.length} de {total} {total === 1 ? "plano" : "planos"}
      </div>
      <div className="plan-control-head" aria-hidden="true">
        <span>Paciente</span><span>Plano</span><span>Histórico</span><span>Último pagamento</span><span>Renovação</span><span>Ações</span>
      </div>
      {rows.map((row) => (
        <div className="plan-control-row" key={row.id}>
          <div className="plan-control-cell plan-control-patient" data-label="Paciente">
            <strong>{row.patientName}</strong>
            <small>{row.patientPhone || "Telefone não informado"}</small>
          </div>
          <div className="plan-control-cell" data-label="Plano">
            <strong>{row.planName}</strong>
            <small>{row.sessionsIncluded == null ? `${row.sessionsUsed} sessões usadas` : `${row.sessionsUsed} de ${row.sessionsIncluded} sessões usadas`} · {enrollmentStatusLabel(row.enrollmentStatus)}</small>
          </div>
          <div className="plan-control-cell" data-label="Histórico">
            <span className={`plan-status plan-status-${row.paymentState}`}>{({ paid: "Quitado", partial: "Parcial", overdue: "Atrasado", pending: "Em aberto", cancelled: "Cancelado", uncharged: "Sem cobrança" } as Record<string, string>)[row.paymentState]}</span>
            <small>{row.amountCents ? `${brl(row.paidCents)} de ${brl(row.amountCents)} no histórico` : "Nenhum valor lançado"}</small>
          </div>
          <div className="plan-control-cell" data-label="Último pagamento">
            <strong>{dateLabel(row.lastPaidAt, true)}</strong>
            <small>{row.lastPaidAt ? "Pagamento confirmado" : "Ainda não registrado"}</small>
          </div>
          <div className="plan-control-cell" data-label="Renovação">
            <span className={`plan-status plan-renewal-${row.renewalState}`}>{renewalCopy(row.daysToRenewal)}</span>
            <small>{row.renewsAt ? `Renovação em ${dateLabel(row.renewsAt)}` : "Defina o fim do período no cadastro"}</small>
          </div>
          <div className="plan-control-cell plan-control-actions" data-label="Ações">
            {onChangePlan && row.enrollmentStatus === "active" && <button type="button" className="btn secondary" onClick={() => onChangePlan(row)}>Trocar plano</button>}{onEdit && <button type="button" className="btn secondary" onClick={() => onEdit(row)} aria-label={`Editar plano de ${row.patientName}`}>Editar</button>}
          </div>
        </div>
      ))}
      {!rows.length && <div className="empty-state">Nenhum plano corresponde à busca ou ao filtro selecionado.</div>}
    </section>
  );
}

function enrollmentStatusLabel(status: string) {
  return ({ active: "Ativo", paused: "Pausado", expired: "Vencido", cancelled: "Cancelado" } as Record<string, string>)[status] ?? status;
}

function EditControlledPlanDialog({
  row,
  plans,
  saving,
  notice,
  endsAt,
  onClose,
  onSubmit,
}: {
  row: PlanControlRow;
  plans: Row[];
  saving: boolean;
  notice: string;
  endsAt: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const titleId = `edit-controlled-plan-${row.id}`;
  const [dirty, setDirty] = useState(false);

  const requestClose = async () => {
    if (saving) return;
    if (dirty && !await confirmAction("Descartar as alterações deste plano?", { title: "Descartar alterações?", confirmLabel: "Descartar alterações", destructive: true })) return;
    onClose();
  };
  const dialogRef = useDialogFocus(true, requestClose, !saving);
  return (
    <div className="edit-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) requestClose();
    }}>
      <section ref={dialogRef} className="edit-dialog controlled-plan-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="edit-dialog-header">
          <div>
            <p className="eyebrow">EDIÇÃO DE MATRÍCULA</p>
            <h2 id={titleId}>Editar matrícula de {row.patientName}</h2>
            <p>{row.planName}</p>
          </div>
          <button type="button" className="dialog-close" aria-label="Fechar edição do plano" onClick={requestClose} disabled={saving} autoFocus>×</button>
        </div>
        <form className="modal-form controlled-plan-form" onSubmit={(event) => void onSubmit(event)} onInput={() => setDirty(true)} aria-busy={saving}>
          {notice && <Notice message={notice} />}
          <SelectField name="plan_id" label="Plano contratado" defaultValue={row.planId} disabled>
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {brl(Number(plan.price_cents ?? 0))}</option>)}
          </SelectField>
          <div className="form-row">
            <TextField name="starts_at" label="Início do plano" type="date" value={row.startsAt} readOnly />
            <TextField name="ends_at" label="Data de renovação" type="date" value={endsAt} readOnly />
          </div>
          <div className="form-row">
            <TextField name="sessions_used" label="Sessões utilizadas" type="number" min="0" defaultValue={row.sessionsUsed} required hint={row.sessionsIncluded == null ? "Quantidade já utilizada pelo paciente." : `O plano inclui ${row.sessionsIncluded} sessões.`} />
            <SelectField name="status" label="Situação do plano" defaultValue={row.enrollmentStatus} required>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="expired">Vencido</option>
            </SelectField>
          </div>
          <p className="form-instructions">Alterações de pagamentos devem ser feitas pelo fluxo financeiro para preservar o histórico.</p>
          <div className="edit-dialog-actions">
            <button type="button" className="btn secondary" onClick={requestClose} disabled={saving}>Cancelar</button>
            <button className="btn primary" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
