import { FormEvent, useMemo, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { buildPlanControlRows, renewalCopy, type PlanControlRow } from "../../application/portal/planControl";
import { SelectField, TextField } from "../components/FormPrimitives";
import { type AgendaEnrollmentContext, Row, PLAN_PERIODS, PlanPeriod, WeeklyFrequency, messageOf, value, cents, brl, planTotalCents, useResources, Select, PlanSelect, PatientPicker, DrawerForm, ModuleState, MetricLite, EditableOperationalTable, OperationalTable } from "./OperationalShared";

export function OperationalEnrollments({ agendaContext, onClearAgendaContext, openEnrollment = false, units = [], selectedUnitId = "", onUnitChange = () => undefined }: { agendaContext?: AgendaEnrollmentContext; onClearAgendaContext?: () => void; openEnrollment?: boolean; units?: Array<{ id: string; name: string }>; selectedUnitId?: string; onUnitChange?: (unitId: string) => void }) {
  const paths = [
    "/plans",
    "/enrollments",
    "/charges",
    "/payments",
    "/patients?page=1&pageSize=100",
    "/units",
    "/group-slots",
  ];
  const { data, loading, error, reload } = useResources(paths);
  const patients = data["/patients?page=1&pageSize=100"]?.items ?? [];
  const [notice, setNotice] = useState("");
  const [selectedPatient, setSelectedPatient] = useState<Row>();
  const [selectedEnrollmentGroup, setSelectedEnrollmentGroup] = useState(agendaContext?.groupSlotId ?? "");
  const [patientPickerVersion, setPatientPickerVersion] = useState(0);
  const [planPeriod, setPlanPeriod] = useState<PlanPeriod>("monthly");
  const [weeklyFrequency, setWeeklyFrequency] = useState<WeeklyFrequency>(2);
  const [controlSearch, setControlSearch] = useState("");
  const [controlFilter, setControlFilter] = useState("all");
  const [editingControlRow, setEditingControlRow] = useState<PlanControlRow | null>(null);
  const [savingControlRow, setSavingControlRow] = useState(false);
  const [savingPaymentId, setSavingPaymentId] = useState("");
  const selectedPeriod = PLAN_PERIODS[planPeriod];
  const planSessions = selectedPeriod.months * weeklyFrequency * 4;
  const planName = `${selectedPeriod.label} · ${weeklyFrequency}x por semana`;

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      (event.target as HTMLFormElement).reset();
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
    const form = new FormData(event.currentTarget);
    const patientId = value(form, "patient_id");
    const planId = value(form, "plan_id");
    try {
      const existing = (data["/enrollments"] ?? []).find((row: Row) => row.patient_id === patientId && row.plan_id === planId && row.status !== "cancelled" && row.status !== "reversed" && !row.deleted_at);
      const response = existing ? { data: existing } : await api<Row>("/enrollments", {
        method: "POST",
        body: JSON.stringify({ patient_id: patientId, plan_id: planId, unit_id: value(form, "unit_id"), starts_at: value(form, "starts_at"), ends_at: value(form, "ends_at") || undefined, due_day: Number(value(form, "due_day")), discount_cents: cents(value(form, "discount") || "0"), surcharge_cents: 0 }),
      });
      const group = value(form, "group_slot_id");
      if (group && response.data)
          await api(`/group-slots/${group}/members`, {
            method: "POST",
            body: JSON.stringify({ enrollment_id: response.data.id, patient_id: patientId, weekdays: form.getAll("weekdays").map(Number), starts_at: value(form, "starts_at"), ends_at: value(form, "ends_at") || undefined }),
          });
      (event.target as HTMLFormElement).reset();
      setSelectedPatient(undefined);
      setSelectedEnrollmentGroup("");
      setPatientPickerVersion((version) => version + 1);
      await reload();
      setNotice(existing ? "Paciente já matriculado; vínculo recorrente atualizado." : "Matrícula criada e paciente vinculado à turma recorrente.");
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
    const form = new FormData(event.currentTarget);
    try {
      await api("/payments", {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
        body: JSON.stringify({
          charge_id: value(form, "charge_id"),
          amount_cents: cents(value(form, "amount")),
          method: value(form, "method"),
          paid_at: new Date().toISOString(),
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Pagamento registrado.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function updateControlledPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingControlRow || savingControlRow) return;
    const form = new FormData(event.currentTarget);
    setSavingControlRow(true);
    try {
      await api(`/enrollments/${editingControlRow.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          starts_at: value(form, "starts_at"),
          ends_at: value(form, "ends_at"),
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
  async function updatePaymentStatus(row: PlanControlRow, status: string) {
    if (!row.chargeId || savingPaymentId) return;
    setSavingPaymentId(row.chargeId);
    try {
      await api(`/charges/${row.chargeId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await reload();
      setNotice("Situação do pagamento atualizada.");
    } catch (error) {
      setNotice(messageOf(error));
    } finally {
      setSavingPaymentId("");
    }
  }
  const enrollmentRows = (data["/enrollments"] ?? []).map((row: Row) => {
    const plan = (data["/plans"] ?? []).find((item: Row) => item.id === row.plan_id);
    const planPrice = plan ? planTotalCents(plan) : 0;
    const discount = Number(row.discount_cents ?? 0);
    const surcharge = Number(row.surcharge_cents ?? 0);
    return {
      ...row,
      total_plan_cents: Math.max(planPrice - discount + surcharge, 0),
    };
  });
  const planRows = (data["/plans"] ?? []).map((row: Row) => ({
    ...row,
    total_plan_cents: planTotalCents(row),
  }));
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
        || (controlFilter === "paid" && row.paymentState === "paid")
        || (controlFilter === "cancelled" && row.paymentState === "cancelled")
        || (controlFilter === "overdue" && row.paymentState === "overdue")
        || (controlFilter === "pending" && ["pending", "partial", "uncharged"].includes(row.paymentState));
      return matchesSearch && matchesFilter;
    });
  }, [controlFilter, controlRows, controlSearch]);
  const activeControlRows = controlRows.filter((row) => row.enrollmentStatus === "active");
  const paidPlans = activeControlRows.filter((row) => row.paymentState === "paid").length;
  const dueSoonPlans = activeControlRows.filter((row) => row.renewalState === "due-soon").length;
  const attentionPlans = activeControlRows.filter((row) => row.renewalState === "expired" || ["overdue", "partial"].includes(row.paymentState)).length;
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">PLANOS E COBRANÇAS</p>
          <h1>Matrículas</h1>
          <p>Planos mensais, pacotes, avulsos e vínculo com turma semanal.</p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
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
        savingPaymentId={savingPaymentId}
        onPaymentStatusChange={updatePaymentStatus}
        onEdit={setEditingControlRow}
      />
      {editingControlRow && (
        <EditControlledPlanDialog
          row={editingControlRow}
          saving={savingControlRow}
          onClose={() => setEditingControlRow(null)}
          onSubmit={updateControlledPlan}
        />
      )}
      <div className="dashboard-grid">
        <DrawerForm title="Novo plano" onSubmit={createPlan}>
          <h2>Novo plano</h2>
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
        <DrawerForm title="Nova matrícula" onSubmit={enroll} openInitially={openEnrollment || Boolean(agendaContext)} onClose={onClearAgendaContext}>
          <h2>Nova matrícula</h2>
          <div className="form-row">
            <PatientPicker key={patientPickerVersion} name="patient_id" label="Paciente" rows={patients} onSelect={setSelectedPatient} />
            <PlanSelect rows={data["/plans"] ?? []} />
          </div>
          {selectedPatient && <div className="agenda-context-summary" role="status"><strong>Paciente selecionado</strong><span>{selectedPatient.name}{selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}{selectedPatient.cpf ? ` · CPF ${selectedPatient.cpf}` : ""}</span></div>}
          {agendaContext ? <div className="agenda-context-summary" role="status"><input type="hidden" name="unit_id" value={agendaContext.unitId} /><input type="hidden" name="group_slot_id" value={agendaContext.groupSlotId} /><strong>{agendaContext.groupName ?? "Horário selecionado"}</strong><span>{agendaContext.unitName ?? "Unidade selecionada"} · horário escolhido na Agenda · {agendaContext.startsAt}</span><button type="button" onClick={onClearAgendaContext}>Trocar horário</button></div> : <div className="form-row"><Select name="unit_id" label="Unidade" rows={data["/units"] ?? []} /><SelectField name="group_slot_id" label="Horário fixo (opcional)" value={selectedEnrollmentGroup} onChange={(event) => setSelectedEnrollmentGroup(event.target.value)}><option value="">Nenhum</option>{(data["/group-slots"] ?? []).map((slot: Row) => <option key={slot.id} value={slot.id}>{String(slot.starts_at).slice(0, 5)}</option>)}</SelectField></div>}
          {(agendaContext || selectedEnrollmentGroup) && <SelectField name="weekdays" label="Dias em que o paciente vem" defaultValue={agendaContext ? [String(new Date(`${agendaContext.startsAt}T12:00:00`).getDay())] : undefined} multiple size={5} required hint="Selecione um ou mais dias. No computador, use Ctrl ou Cmd para marcar vários."><option value="1">Segunda-feira</option><option value="2">Terça-feira</option><option value="3">Quarta-feira</option><option value="4">Quinta-feira</option><option value="5">Sexta-feira</option></SelectField>}
            <div className="form-row">
              <TextField id="enrollment-starts-at" name="starts_at" label="Início" type="date" defaultValue={agendaContext?.startsAt} readOnly={Boolean(agendaContext)} required />
              <TextField id="enrollment-ends-at" name="ends_at" label="Fim do período" type="date" />
            </div>
            <div className="form-row">
              <TextField id="enrollment-due-day" name="due_day" label="Dia do vencimento" type="number" min="1" max="31" required />
          </div>
          <TextField id="enrollment-discount" name="discount" label="Desconto" type="number" step=".01" defaultValue="0" />
          <button className="btn primary">Matricular</button>
        </DrawerForm>
      </div>
      <form className="card modal-form inline-form" onSubmit={pay}>
        <h2>Registrar pagamento</h2>
        <Select
          name="charge_id"
          label="Cobrança"
          rows={(data["/charges"] ?? []).map((row: Row) => ({
            ...row,
            name: `${row.description} — ${brl(row.amount_cents - row.paid_cents)}`,
          }))}
        />
        <TextField id="payment-amount" name="amount" label="Valor" type="number" step=".01" required />
        <SelectField id="payment-method" name="method" label="Forma">
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="cash">Dinheiro</option>
            <option value="transfer">Transferência</option>
        </SelectField>
        <button className="btn primary">Receber</button>
      </form>
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
        allowDelete
        onChanged={reload}
        onNotice={setNotice}
      />
      <OperationalTable
        title="Matrículas ativas"
        rows={enrollmentRows}
        fields={["status", "starts_at", "ends_at", "due_day", "sessions_used", "total_plan_cents"]}
        actions={(row) => row.deleted_at ? null : <button type="button" onClick={() => void rollbackEnrollment(row.id)}>Reverter</button>}
      />
      <OperationalTable
        title="Cobranças"
        rows={data["/charges"] ?? []}
        fields={[
          "description",
          "due_at",
          "status",
          "amount_cents",
          "paid_cents",
        ]}
      />
    </div>
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
  savingPaymentId,
  onPaymentStatusChange,
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
  savingPaymentId: string;
  onPaymentStatusChange: (row: PlanControlRow, status: string) => void | Promise<void>;
  onEdit: (row: PlanControlRow) => void;
}) {
  return (
    <section className="card table-card plan-control-table" aria-labelledby="plan-control-title">
      <div className="table-toolbar plan-control-toolbar">
        <div>
          <p className="eyebrow">ACOMPANHAMENTO</p>
          <h2 id="plan-control-title">Controle de planos dos pacientes</h2>
          <p>Veja rapidamente quem contratou, quem pagou e quanto falta para renovar.</p>
        </div>
        <div className="plan-control-filters">
          <TextField fieldClassName="plan-control-filter-field plan-control-search-field" label="Buscar" type="search" placeholder="Paciente ou plano" value={search} onChange={(event) => onSearch(event.target.value)} />
          <SelectField fieldClassName="plan-control-filter-field" label="Situação" value={filter} onChange={(event) => onFilter(event.target.value)}>
            <option value="all">Todos</option>
            <option value="due-soon">Renovam em até 7 dias</option>
            <option value="expired">Planos vencidos</option>
            <option value="paid">Pagamentos em dia</option>
            <option value="cancelled">Pagamentos cancelados</option>
            <option value="overdue">Pagamentos atrasados</option>
            <option value="pending">Aguardando pagamento</option>
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
        <span>Paciente</span><span>Plano</span><span>Pagamento</span><span>Último pagamento</span><span>Renovação</span><span>Ações</span>
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
          <div className="plan-control-cell" data-label="Pagamento">
            <SelectField
              fieldClassName={`payment-status-field payment-status-${row.paymentState}`}
              label={`Pagamento de ${row.patientName}`}
              labelHidden
              value={row.paymentState}
              disabled={!row.chargeId || savingPaymentId === row.chargeId}
              onChange={(event) => void onPaymentStatusChange(row, event.target.value)}
            >
              {row.paymentState === "uncharged" && <option value="uncharged" disabled>Sem cobrança</option>}
              {row.paymentState === "partial" && <option value="partial" disabled>Pago parcialmente</option>}
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
              <option value="overdue">Atrasado</option>
              <option value="pending">Aguardando pagamento</option>
            </SelectField>
            <small>{row.paymentState === "paid" && row.paidCents < row.amountCents
              ? "Marcado como pago; recebimento financeiro ainda não lançado"
              : row.amountCents ? `${brl(row.paidCents)} de ${brl(row.amountCents)}` : "Nenhum valor lançado"}</small>
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
            <button type="button" className="btn secondary" onClick={() => onEdit(row)} aria-label={`Editar plano de ${row.patientName}`}>Editar</button>
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
  saving,
  onClose,
  onSubmit,
}: {
  row: PlanControlRow;
  saving: boolean;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
}) {
  const titleId = `edit-controlled-plan-${row.id}`;
  return (
    <div className="edit-dialog-backdrop" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget && !saving) onClose();
    }}>
      <section className="edit-dialog controlled-plan-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={(event) => {
        if (event.key === "Escape" && !saving) onClose();
      }}>
        <div className="edit-dialog-header">
          <div>
            <p className="eyebrow">ATUALIZAÇÃO DO PLANO</p>
            <h2 id={titleId}>Editar plano de {row.patientName}</h2>
            <p>{row.planName}</p>
          </div>
          <button type="button" className="dialog-close" aria-label="Fechar edição do plano" onClick={onClose} disabled={saving} autoFocus>×</button>
        </div>
        <form className="modal-form controlled-plan-form" onSubmit={(event) => void onSubmit(event)} aria-busy={saving}>
          <div className="form-row">
            <TextField name="starts_at" label="Início do plano" type="date" defaultValue={row.startsAt} required />
            <TextField name="ends_at" label="Data de renovação" type="date" min={row.startsAt} defaultValue={row.renewsAt} required />
          </div>
          <div className="form-row">
            <TextField name="sessions_used" label="Sessões utilizadas" type="number" min="0" max={row.sessionsIncluded ?? undefined} defaultValue={row.sessionsUsed} required hint={row.sessionsIncluded == null ? "Quantidade já utilizada pelo paciente." : `O plano inclui ${row.sessionsIncluded} sessões.`} />
            <SelectField name="status" label="Situação do plano" defaultValue={row.enrollmentStatus} required>
              <option value="active">Ativo</option>
              <option value="paused">Pausado</option>
              <option value="expired">Vencido</option>
            </SelectField>
          </div>
          <p className="form-instructions">Alterações de pagamentos devem ser feitas pelo fluxo financeiro para preservar o histórico.</p>
          <div className="edit-dialog-actions">
            <button type="button" className="btn secondary" onClick={onClose} disabled={saving}>Cancelar</button>
            <button className="btn primary" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
