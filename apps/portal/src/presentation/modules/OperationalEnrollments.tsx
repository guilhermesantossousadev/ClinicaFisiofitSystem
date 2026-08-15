import { FormEvent, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextField } from "../components/FormPrimitives";
import { type AgendaEnrollmentContext, Row, PLAN_PERIODS, PlanPeriod, WeeklyFrequency, messageOf, value, cents, brl, planTotalCents, useResources, Select, PlanSelect, PatientPicker, DrawerForm, ModuleState, MetricLite, EditableOperationalTable, OperationalTable } from "./OperationalShared";

export function OperationalEnrollments({ agendaContext, onClearAgendaContext, openEnrollment = false }: { agendaContext?: AgendaEnrollmentContext; onClearAgendaContext?: () => void; openEnrollment?: boolean }) {
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
  const [patientPickerVersion, setPatientPickerVersion] = useState(0);
  const [planPeriod, setPlanPeriod] = useState<PlanPeriod>("monthly");
  const [weeklyFrequency, setWeeklyFrequency] = useState<WeeklyFrequency>(2);
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
            body: JSON.stringify({ enrollment_id: response.data.id, patient_id: patientId, starts_at: value(form, "starts_at"), ends_at: value(form, "ends_at") || undefined }),
          });
      (event.target as HTMLFormElement).reset();
      setSelectedPatient(undefined);
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
        <MetricLite label="Planos" value={(data["/plans"] ?? []).length} />
        <MetricLite
          label="Matrículas"
          value={(data["/enrollments"] ?? []).length}
        />
        <MetricLite label="Cobranças" value={(data["/charges"] ?? []).length} />
        <MetricLite
          label="Pagamentos"
          value={(data["/payments"] ?? []).length}
        />
      </div>
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
          {agendaContext ? <div className="agenda-context-summary" role="status"><input type="hidden" name="unit_id" value={agendaContext.unitId} /><input type="hidden" name="group_slot_id" value={agendaContext.groupSlotId} /><strong>{agendaContext.groupName ?? "Turma selecionada"}</strong><span>{agendaContext.unitName ?? "Unidade selecionada"} · horário escolhido na Agenda · {agendaContext.startsAt}</span><button type="button" onClick={onClearAgendaContext}>Trocar horário</button></div> : <div className="form-row"><Select name="unit_id" label="Unidade" rows={data["/units"] ?? []} /><Select name="group_slot_id" label="Turma (opcional)" rows={data["/group-slots"] ?? []} required={false} /></div>}
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
