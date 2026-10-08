import { MonthlyPayments } from "./MonthlyPayments";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { buildPlanControlRows, renewalCopy, type PlanControlRow } from "../../application/portal/planControl";
import { buildAvailablePaymentPlans } from "../../application/portal/paymentPlans";
import { SelectField, TextField } from "../components/FormPrimitives";
import { type AgendaEnrollmentContext, Row, PLAN_PERIODS, PlanPeriod, WeeklyFrequency, messageOf, value, cents, brl, planTotalCents, groupSlotLabel, useDialogFocus, useResources, PlanSelect, PatientPicker, DrawerForm, ModuleState, MetricLite, EditableOperationalTable, OperationalTable, dateKey, localDateAtNoonIso } from "./OperationalShared";

export function OperationalEnrollments({ agendaContext, onClearAgendaContext, openEnrollment = false, units = [], selectedUnitId = "", onUnitChange = () => undefined, canEdit = true, canManagePlans = true, canDeletePlans = true, canViewCharges = true, canViewPayments = true, canReceivePayments = true, canRollback = true }: { agendaContext?: AgendaEnrollmentContext; onClearAgendaContext?: () => void; openEnrollment?: boolean; units?: Array<{ id: string; name: string }>; selectedUnitId?: string; onUnitChange?: (unitId: string) => void; canEdit?: boolean; canManagePlans?: boolean; canDeletePlans?: boolean; canViewCharges?: boolean; canViewPayments?: boolean; canReceivePayments?: boolean; canRollback?: boolean }) {
  const paths = [
    "/plans",
    "/enrollments",
    "/patients?page=1&pageSize=100",
    "/units",
    "/group-slots",
    "/professionals",
    ...(canViewCharges ? ["/charges"] : []),
    ...(canViewPayments ? ["/payments"] : []),
  ];
  const { data, loading, error, reload } = useResources(paths);
  const patients = data["/patients?page=1&pageSize=100"]?.items ?? [];
  const [notice, setNotice] = useState("");
  const sectionFromPath = () => window.location.pathname.includes("/matriculas/historico") ? "history" : window.location.pathname.includes("/matriculas/gestao") ? "management" : "control";
  const [section, setSection] = useState<"control" | "management" | "history">(sectionFromPath);
  const navigateSection = (next: "control" | "management" | "history") => { window.history.pushState({}, "", `/sistema/matriculas/${next === "management" ? "gestao" : next === "history" ? "historico" : "controle"}`); setSection(next); };
  useEffect(() => { const sync = () => setSection(sectionFromPath()); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync); }, []);
  const [paymentMonth, setPaymentMonth] = useState(() => dateKey(new Date()).slice(0, 7));
  const [selectedPatient, setSelectedPatient] = useState<Row>();
  const [selectedEnrollmentGroup, setSelectedEnrollmentGroup] = useState(agendaContext?.groupSlotId ?? "");
  const [selectedEnrollmentUnit, setSelectedEnrollmentUnit] = useState(agendaContext?.unitId ?? selectedUnitId);
  const [patientPickerVersion, setPatientPickerVersion] = useState(0);
  const [planPeriod, setPlanPeriod] = useState<PlanPeriod>("monthly");
  const [weeklyFrequency, setWeeklyFrequency] = useState<WeeklyFrequency>(2);
  const [controlSearch, setControlSearch] = useState("");
  const [controlFilter, setControlFilter] = useState("all");
  const [activeEnrollmentSearch, setActiveEnrollmentSearch] = useState("");
  const [activeEnrollmentFilter, setActiveEnrollmentFilter] = useState("all");
  const [editingControlRow, setEditingControlRow] = useState<PlanControlRow | null>(null);
  const [savingControlRow, setSavingControlRow] = useState(false);
  const paymentPending = useRef(false);
  const paymentAttempt = useRef<{ payload: string; key: string }>();
  const [receivingPayment, setReceivingPayment] = useState(false);
  const [selectedPaymentChargeId, setSelectedPaymentChargeId] = useState("");
  const [selectedPaymentPatientId, setSelectedPaymentPatientId] = useState("");
  const [paymentPatientPickerVersion, setPaymentPatientPickerVersion] = useState(0);
  const [paymentAmount, setPaymentAmount] = useState("");
  const selectedPeriod = PLAN_PERIODS[planPeriod];
  const planSessions = selectedPeriod.months * weeklyFrequency * 4;
  const planName = `${selectedPeriod.label} · ${weeklyFrequency}x por semana`;

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/plans", {
        method: "POST",
        body: JSON.stringify({
          name: planName,
          kind: planPeriod === "monthly" ? "monthly" : "package",
          sessions_included: planSessions,
          duration_days: selectedPeriod.durationDays,
          price_cents: cents(value(form, "price")),
          active: true,
        }),
      });
      formElement.reset();
      setPlanPeriod("monthly");
      setWeeklyFrequency(2);
      await reload();
      setNotice("Plano criado.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
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
  async function rollbackEnrollment(id: string) {
    const reason = window.prompt("Informe o motivo da reversão (mínimo 10 caracteres):");
    if (!reason) return;
    try { await api(`/enrollments/${id}/rollback`, { method: "POST", body: JSON.stringify({ reason }) }); await reload(); setNotice("Matrícula revertida."); }
    catch (e) { setNotice(messageOf(e)); }
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
          plan_id: value(form, "plan_id"),
          starts_at: value(form, "starts_at"),
          ends_at: value(form, "ends_at") || null,
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
  const enrollmentRows: ActiveEnrollmentRow[] = (data["/enrollments"] ?? [])
    .filter((row: Row) => row.status === "active" && !row.deleted_at)
    .map((row: Row) => {
      const patient = row.patient ?? patients.find((item: Row) => item.id === row.patient_id);
      const plan = row.plan ?? (data["/plans"] ?? []).find((item: Row) => item.id === row.plan_id);
      const fullPlan = (data["/plans"] ?? []).find((item: Row) => item.id === row.plan_id) ?? plan;
      const unit = (data["/units"] ?? []).find((item: Row) => item.id === row.unit_id);
      const enrollmentCharges = (data["/charges"] ?? []).filter((charge: Row) => charge.enrollment_id === row.id && !charge.deleted_at && charge.status !== "cancelled");
      const planPrice = fullPlan ? planTotalCents(fullPlan) : 0;
      const discount = Number(row.discount_cents ?? 0);
      const surcharge = Number(row.surcharge_cents ?? 0);
      const currentAmountCents = Math.max(planPrice - discount + surcharge, 0);
      const chargedCents = enrollmentCharges.reduce((sum: number, charge: Row) => sum + Number(charge.amount_cents ?? 0), 0);
      const paidCents = enrollmentCharges.reduce((sum: number, charge: Row) => sum + Number(charge.paid_cents ?? 0), 0);
      return {
        id: String(row.id),
        patientName: String(patient?.name ?? "Paciente não encontrado"),
        patientPhone: String(patient?.phone ?? ""),
        planName: String(fullPlan?.name ?? "Plano não encontrado"),
        unitName: String(unit?.name ?? "Unidade não encontrada"),
        startsAt: String(row.starts_at ?? ""),
        endsAt: String(row.ends_at ?? ""),
        dueDay: Number(row.due_day ?? 0),
        currentAmountCents,
        chargedCents,
        paidCents,
        balanceCents: Math.max(chargedCents - paidCents, 0),
        hasChargeMismatch: canViewCharges && chargedCents !== currentAmountCents,
      };
    });
  const filteredEnrollmentRows = useMemo(() => {
    const search = activeEnrollmentSearch.trim().toLocaleLowerCase("pt-BR");
    return enrollmentRows.filter((row) => {
      const matchesSearch = !search || `${row.patientName} ${row.patientPhone} ${row.planName} ${row.unitName}`.toLocaleLowerCase("pt-BR").includes(search);
      const matchesFilter = activeEnrollmentFilter === "all"
        || (activeEnrollmentFilter === "divergent" && row.hasChargeMismatch)
        || (activeEnrollmentFilter === "correctable" && row.hasChargeMismatch && row.paidCents === 0)
        || (activeEnrollmentFilter === "paid" && row.paidCents > 0);
      return matchesSearch && matchesFilter;
    });
  }, [activeEnrollmentFilter, activeEnrollmentSearch, enrollmentRows]);
  const planRows = (data["/plans"] ?? []).map((row: Row) => ({
    ...row,
    total_plan_cents: planTotalCents(row),
  }));
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
      return matchesSearch && matchesFilter;
    });
  }, [controlFilter, controlRows, controlSearch]);
  const activeControlRows = controlRows.filter((row) => row.enrollmentStatus === "active");
  const paidPlans = activeControlRows.filter((row) => row.paymentState === "paid").length;
  const dueSoonPlans = activeControlRows.filter((row) => row.renewalState === "due-soon").length;
  const attentionPlans = activeControlRows.filter((row) => row.renewalState === "expired" || ["overdue", "partial"].includes(row.paymentState)).length;
  return (
    <div className="content">
      <header className="enrollment-module-header"><div><p className="eyebrow">PACIENTES / MATRÍCULAS</p><h1>Controle de Planos</h1><p>Financeiro mensal e gestão das matrículas dos pacientes.</p></div><nav className="enrollment-module-nav" aria-label="Áreas de matrículas">{([['control', 'Controle de Planos'], ['management', 'Matrículas'], ['history', 'Histórico']] as const).map(([value, label]) => <button type="button" key={value} className={section === value ? "active" : ""} aria-current={section === value ? "page" : undefined} onClick={() => navigateSection(value)}>{label}</button>)}</nav></header>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      {section === "control" && canViewCharges && <MonthlyPayments data={data} month={paymentMonth} onMonth={(month) => { setPaymentMonth(month); clearPaymentPatient(); }} canEdit={canReceivePayments} reload={reload} onNotice={setNotice} onRegisterPayment={(row) => { setSelectedPaymentPatientId(row.patientId); setSelectedPaymentChargeId(row.chargeId); setPaymentAmount((row.balanceCents / 100).toFixed(2)); requestAnimationFrame(() => document.getElementById("payment-registration")?.scrollIntoView({ behavior: "smooth", block: "start" })); }} />}
      {section === "history" && <EnrollmentHistoryPanel rows={controlRows} charges={data["/charges"] ?? []} payments={data["/payments"] ?? []} />}
      {section === "management" && <>
      <div className="metrics">
        <MetricLite label="Pacientes com plano" value={activeControlRows.length} />
        <MetricLite label="Pagamentos em dia" value={paidPlans} />
        <MetricLite label="Renovam em até 7 dias" value={dueSoonPlans} />
        <MetricLite label="Precisam de atenção" value={attentionPlans} />
      </div>
      <PlanControlTable
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
        {canManagePlans && (
        <DrawerForm title="Novo plano" onSubmit={createPlan}>
          <h2>Novo plano</h2>
          {notice && <p role="status">{notice}</p>}
          <div className="form-row">
            <SelectField
                label="Período"
                id="plan-period"
                name="period"
                value={planPeriod}
                onChange={(event) => setPlanPeriod(event.target.value as PlanPeriod)}>
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="semiannual">Semestral</option>
              </SelectField>
            <SelectField
                label="Frequência"
                id="plan-weekly-frequency"
                name="weekly_frequency"
                value={weeklyFrequency}
                onChange={(event) => setWeeklyFrequency(Number(event.target.value) as WeeklyFrequency)}>
                <option value="1">1x por semana</option>
                <option value="2">2x por semana</option>
                <option value="3">3x por semana</option>
              </SelectField>
          </div>
          <div className="plan-summary" aria-live="polite">
            <strong>{planName}</strong>
            <span>{planSessions} sessões durante {selectedPeriod.months} {selectedPeriod.months === 1 ? "mês" : "meses"}</span>
          </div>
          <TextField id="plan-price" name="price" label="Preço do plano" type="number" min="0" step=".01" inputMode="decimal" required />
          <button className="btn primary">Criar plano</button>
        </DrawerForm>
        )}
        {canEdit && (
        <DrawerForm title="Nova matrícula" onSubmit={enroll} openInitially={openEnrollment || Boolean(agendaContext)} onClose={onClearAgendaContext}>
          <h2>Nova matrícula</h2>
          {notice && <p role="status">{notice}</p>}
          <div className="form-row">
            <PatientPicker key={patientPickerVersion} name="patient_id" label="Paciente" rows={patients} onSelect={setSelectedPatient} />
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
          <button className="btn primary">Matricular</button>
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
      {section === "management" && canManagePlans && (
      <EditableOperationalTable
        title="Planos"
        resource="plans"
        rows={planRows}
        fields={["name", "kind", "sessions_included", "duration_days", "price_cents", "total_plan_cents", "active"]}
        editFields={[
          { name: "name", label: "Nome", required: true },
          { name: "sessions_included", label: "Sessões incluídas", type: "number", min: 1 },
          { name: "duration_days", label: "Duração (dias)", type: "number", min: 1 },
          { name: "price", label: "Preço", type: "number", min: 0, step: ".01", required: true, value: (row) => Number(row.price_cents ?? 0) / 100 },
        ]}
        buildBody={(form) => ({
          name: value(form, "name"),
          sessions_included: Number(value(form, "sessions_included")) || null,
          duration_days: Number(value(form, "duration_days")) || null,
          price_cents: cents(value(form, "price")),
        })}
        allowDelete={canDeletePlans}
        onChanged={reload}
        onNotice={setNotice}
      />
      )}
      {section === "management" && <ActiveEnrollmentsTable
        rows={filteredEnrollmentRows}
        total={enrollmentRows.length}
        search={activeEnrollmentSearch}
        filter={activeEnrollmentFilter}
        onSearch={setActiveEnrollmentSearch}
        onFilter={setActiveEnrollmentFilter}
        canRollback={canRollback}
        canViewFinancials={canViewCharges}
        onRollback={rollbackEnrollment}
      />}
      {section === "history" && canViewCharges && <OperationalTable
        title="Cobranças"
        rows={data["/charges"] ?? []}
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
  const [search, setSearch] = useState("");
  const [patientId, setPatientId] = useState("");
  const matchingRows = rows.filter((row) => !search.trim() || `${row.patientName} ${row.planName}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));
  const selected = patientId ? matchingRows.find((row) => row.id === patientId) : matchingRows[0];
  const historyCharges = selected ? charges.filter((charge) => charge.enrollment_id === selected.id && !charge.deleted_at) : [];
  const historyPayments = selected ? payments.filter((payment) => historyCharges.some((charge) => charge.id === payment.charge_id) && !payment.deleted_at) : [];
  return <section className="enrollment-history card" aria-labelledby="enrollment-history-title"><div className="table-toolbar"><div><p className="eyebrow">CONSULTA</p><h2 id="enrollment-history-title">Histórico de matrículas</h2><p>Use os eventos já registrados para entender planos, cobranças e recebimentos.</p></div><TextField label="Buscar paciente ou plano" type="search" placeholder="Buscar paciente ou plano..." value={search} onChange={(event) => { setSearch(event.target.value); setPatientId(""); }} /></div><div className="history-layout"><div className="history-patients" aria-label="Pacientes encontrados">{matchingRows.map((row) => <button type="button" key={row.id} className={selected?.id === row.id ? "active" : ""} onClick={() => setPatientId(row.id)}><strong>{row.patientName}</strong><span>{row.planName}</span></button>)}{!matchingRows.length && <p>Nenhuma matrícula encontrada.</p>}</div><div className="history-events">{selected ? <><h3>{selected.patientName}</h3><p className="history-plan">{selected.planName}</p><article><strong>Matrícula</strong><span>Início: {dateLabel(selected.startsAt)} · Renovação: {dateLabel(selected.renewsAt)}</span></article>{historyCharges.map((charge) => <article key={charge.id}><strong>Cobrança</strong><span>{String(charge.description ?? "Cobrança do plano")} · {brl(Number(charge.amount_cents ?? 0))} · {String(charge.status ?? "")}</span></article>)}{historyPayments.map((payment) => <article key={payment.id}><strong>Recebimento</strong><span>{brl(Number(payment.amount_cents ?? 0))} · {dateLabel(String(payment.paid_at ?? ""), true)} · {String(payment.method ?? "")}</span></article>)}{!historyCharges.length && <p className="history-empty">Não há cobranças registradas para esta matrícula.</p>}</> : <p>Selecione um paciente para consultar o histórico disponível.</p>}</div></div></section>;
}

type ActiveEnrollmentRow = {
  id: string;
  patientName: string;
  patientPhone: string;
  planName: string;
  unitName: string;
  startsAt: string;
  endsAt: string;
  dueDay: number;
  currentAmountCents: number;
  chargedCents: number;
  paidCents: number;
  balanceCents: number;
  hasChargeMismatch: boolean;
};

function ActiveEnrollmentsTable({
  rows,
  total,
  search,
  filter,
  onSearch,
  onFilter,
  canRollback,
  canViewFinancials,
  onRollback,
}: {
  rows: ActiveEnrollmentRow[];
  total: number;
  search: string;
  filter: string;
  onSearch: (value: string) => void;
  onFilter: (value: string) => void;
  canRollback: boolean;
  canViewFinancials: boolean;
  onRollback: (id: string) => void | Promise<void>;
}) {
  const divergentCount = rows.filter((row) => row.hasChargeMismatch).length;
  return (
    <section className="card table-card active-enrollments-table" aria-labelledby="active-enrollments-title">
      <div className="table-toolbar active-enrollments-toolbar">
        <div>
          <p className="eyebrow">CONFERÊNCIA E CORREÇÃO</p>
          <h2 id="active-enrollments-title">Matrículas ativas</h2>
          <p>Compare o valor atual do plano com a cobrança criada para cada paciente.</p>
        </div>
        <div className="active-enrollments-filters">
          <TextField
            id="active-enrollment-search"
            fieldClassName="active-enrollments-search"
            label="Buscar matrícula"
            type="search"
            placeholder="Paciente, telefone, plano ou unidade"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
          />
          {canViewFinancials && <SelectField
            id="active-enrollment-filter"
            fieldClassName="active-enrollments-filter"
            label="Mostrar"
            value={filter}
            onChange={(event) => onFilter(event.target.value)}
          >
            <option value="all">Todas</option>
            <option value="divergent">Valores divergentes</option>
            <option value="correctable">Prontas para reverter</option>
            <option value="paid">Com pagamento registrado</option>
          </SelectField>}
        </div>
      </div>
      {canRollback && <div className="active-enrollments-guidance" role="note">
        <span aria-hidden="true">i</span>
        <p><strong>Para corrigir uma cobrança sem pagamento:</strong> reverta a matrícula e depois faça uma nova matrícula com o plano atualizado. Matrículas com algum valor pago exigem ajuste pelo financeiro.</p>
      </div>}
      <div className="active-enrollments-result" role="status" aria-live="polite">
        Exibindo {rows.length} de {total} {total === 1 ? "matrícula" : "matrículas"}{divergentCount ? ` · ${divergentCount} ${divergentCount === 1 ? "valor divergente" : "valores divergentes"}` : ""}
      </div>
      <div className="active-enrollments-head" aria-hidden="true">
        <span>Paciente</span><span>Plano e período</span><span>Valores</span><span>Situação da cobrança</span><span>Ação</span>
      </div>
      {rows.map((row) => {
        const hasPayment = row.paidCents > 0;
        const canCorrect = canRollback && !hasPayment;
        return (
          <div className={`active-enrollment-row${row.hasChargeMismatch ? " active-enrollment-row-warning" : ""}`} key={row.id}>
            <div className="active-enrollment-cell" data-label="Paciente">
              <strong>{row.patientName}</strong>
              <small>{row.patientPhone || "Telefone não informado"}</small>
            </div>
            <div className="active-enrollment-cell" data-label="Plano e período">
              <strong>{row.planName}</strong>
              <small>{row.unitName} · Início em {dateLabel(row.startsAt)}{row.endsAt ? ` · Fim em ${dateLabel(row.endsAt)}` : ""}</small>
            </div>
            <div className="active-enrollment-cell active-enrollment-values" data-label="Valores">
              {canViewFinancials ? <>
                <strong>Cobrado: {brl(row.chargedCents)}</strong>
                <small>Plano atual: {brl(row.currentAmountCents)} · Saldo: {brl(row.balanceCents)}</small>
              </> : <small>Acesso financeiro restrito</small>}
            </div>
            <div className="active-enrollment-cell" data-label="Situação da cobrança">
              <span className={`plan-status ${canViewFinancials && hasPayment ? "plan-status-partial" : canViewFinancials && row.hasChargeMismatch ? "plan-status-overdue" : "plan-status-paid"}`}>
                {canViewFinancials ? hasPayment ? `${brl(row.paidCents)} já pago` : row.hasChargeMismatch ? "Valor divergente" : "Valor conferido" : "Matrícula ativa"}
              </span>
              <small>{canViewFinancials && hasPayment ? "Procure o financeiro para corrigir" : row.dueDay ? `Vencimento no dia ${row.dueDay}` : "Dia de vencimento não informado"}</small>
            </div>
            <div className="active-enrollment-cell active-enrollment-actions" data-label="Ação">
              {canRollback ? (
                <button
                  type="button"
                  className="btn secondary active-enrollment-rollback"
                  disabled={!canCorrect}
                  title={hasPayment ? "Esta matrícula já possui pagamento e precisa ser corrigida pelo financeiro." : "Reverter esta matrícula para cadastrá-la novamente com o valor atualizado."}
                  onClick={() => void onRollback(row.id)}
                  aria-label={`Reverter matrícula de ${row.patientName}`}
                >
                  Reverter matrícula
                </button>
              ) : <small>Sem permissão para reverter</small>}
            </div>
          </div>
        );
      })}
      {!rows.length && <div className="empty-state">Nenhuma matrícula corresponde à busca.</div>}
    </section>
  );
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
            {onEdit && <button type="button" className="btn secondary" onClick={() => onEdit(row)} aria-label={`Editar plano de ${row.patientName}`}>Editar</button>}
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
  const [startsAt, setStartsAt] = useState(row.startsAt);
  const requestClose = () => {
    if (saving) return;
    if (dirty && !window.confirm("Descartar as alterações deste plano?")) return;
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
          {notice && <p role="status">{notice}</p>}
          <SelectField name="plan_id" label="Plano" defaultValue={row.planId} required hint="Escolha um plano ativo ou mantenha o plano atual.">
            {plans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {brl(Number(plan.price_cents ?? 0))}</option>)}
          </SelectField>
          <div className="form-row">
            <TextField name="starts_at" label="Início do plano" type="date" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
            <TextField name="ends_at" label="Data de renovação" type="date" min={startsAt} defaultValue={endsAt} />
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
