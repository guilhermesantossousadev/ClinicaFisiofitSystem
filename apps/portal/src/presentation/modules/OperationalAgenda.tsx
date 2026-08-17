import { FormEvent, type FormEventHandler, useEffect, useMemo, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { FormSection, SelectField, TextareaField, TextField } from "../components/FormPrimitives";
import { type AgendaEnrollmentContext, Row, Unit, messageOf, value, isoLocal, localDateTime, dateKey, useResources, Select, PatientPicker, DrawerForm, ModuleState, EditableOperationalTable } from "./OperationalShared";

function GroupMemberForm({
  slotName,
  availablePatients,
  allowedPatientIds,
  selectedDate,
  selectedWeekday,
  full,
  onSubmit,
}: {
  slotName: string;
  availablePatients: Row[];
  allowedPatientIds: string[];
  selectedDate: string;
  selectedWeekday: number;
  full: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const helperText = full
    ? "A capacidade máxima foi atingida."
    : allowedPatientIds.length
      ? "Apenas matrículas ainda não vinculadas aparecem aqui."
      : "Não há matrículas disponíveis. Cadastre e matricule o paciente primeiro.";
  return (
    <form className="group-member-form" onSubmit={onSubmit} aria-label={`Adicionar paciente ao horário ${slotName}`}>
      <FormSection legend="Adicionar paciente ao horário">
        <div className="form-row">
          <PatientPicker
            name="patient_id"
            label="Paciente matriculado"
            rows={availablePatients}
            required={!full}
            id="group-member-enrollment"
            allowedIds={allowedPatientIds}
          />
          <TextField
            name="starts_at"
            label="Início do vínculo"
            type="date"
            defaultValue={selectedDate}
            required={!full}
            hint="A partir de qual data o paciente participa deste horário."
          />
        </div>
        <SelectField
          id="group-member-weekdays"
          name="weekdays"
          label="Dias em que o paciente vem"
          defaultValue={[String(selectedWeekday)]}
          multiple
          size={5}
          required={!full}
          hint="Selecione um ou mais dias. No computador, use Ctrl ou Cmd para marcar vários."
        >
          <option value="1">Segunda-feira</option>
          <option value="2">Terça-feira</option>
          <option value="3">Quarta-feira</option>
          <option value="4">Quinta-feira</option>
          <option value="5">Sexta-feira</option>
        </SelectField>
        <div className="group-member-form-actions">
          <button className="btn primary group-members-add" disabled={full || !allowedPatientIds.length}>{full ? "Horário lotado" : "Adicionar paciente"}</button>
          <p className="form-instructions" role="status">{helperText}</p>
        </div>
      </FormSection>
    </form>
  );
}

export function OperationalAgenda({ onOpenPatients, onOpenEnrollment: _onOpenEnrollment, canEdit = true }: { onOpenPatients?: () => void; onOpenEnrollment?: (context: AgendaEnrollmentContext) => void; canEdit?: boolean }) {
  const [fromDate, setFromDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const range = useMemo(() => {
    const selected = new Date(`${fromDate}T00:00:00`);
    const start = new Date(selected);
    start.setDate(selected.getDate() - selected.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [fromDate]);
  const paths = [
    `/appointments?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`,
    "/units",
    "/professionals",
    "/services",
    "/rooms",
    "/patients?page=1&pageSize=100",
    "/group-slots",
    "/enrollments",
  ];
  const { data, loading, error, reload } = useResources(paths);
  const appointments: Row[] = data[paths[0]] ?? [];
  const patients: Row[] = data["/patients?page=1&pageSize=100"]?.items ?? [];
  const [groupMembers, setGroupMembers] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  const [calendarAppointment, setCalendarAppointment] = useState<Row | null | undefined>(undefined);
  const [selectedUnitId, setSelectedUnitId] = useState(() => window.localStorage.getItem("fisiofit:selected-unit") ?? "");
  const [selectedGroupCell, setSelectedGroupCell] = useState<{ slot: Row; day: Date; unitName: string } | null>(null);
  useEffect(() => {
    void api<Row[]>("/group-slot-memberships")
      .then((response) => setGroupMembers(response.data ?? []))
      .catch(() => setGroupMembers([]));
  }, [data["/group-slots"]]);
  useEffect(() => {
    const onUnitChanged = (event: Event) => setSelectedUnitId((event as CustomEvent<string>).detail ?? window.localStorage.getItem("fisiofit:selected-unit") ?? "");
    window.addEventListener("fisiofit:unit-changed", onUnitChanged);
    return () => window.removeEventListener("fisiofit:unit-changed", onUnitChanged);
  }, []);

  const calendarDays = useMemo(() => {
    const selected = new Date(`${fromDate}T00:00:00`);
    const start = new Date(selected);
    start.setDate(selected.getDate() - selected.getDay());
    return Array.from({ length: 7 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [fromDate]);
  const weekLabel = (() => {
    const start = calendarDays[0];
    const end = calendarDays[6];
    return `${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(start)} – ${new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(end)}`.replaceAll(".", "");
  })();
  const fixedSlots: Row[] = data["/group-slots"] ?? [];
  const units: Unit[] = data["/units"] ?? [];
  const visibleUnits = selectedUnitId ? units.filter((unit) => unit.id === selectedUnitId) : [];
  const membersForSlot = (slotId: string, date: Date) => groupMembers.filter((member) => {
    if (member.group_slot_id !== slotId || member.status !== "active") return false;
    if (!(member.weekdays ?? []).includes(date.getDay())) return false;
    const start = String(member.starts_at ?? "").slice(0, 10);
    const end = member.ends_at ? String(member.ends_at).slice(0, 10) : "9999-12-31";
    const current = dateKey(date);
    return current >= start && current <= end;
  });
  const slotsForDay = (unitId: string, day: Date) => fixedSlots.filter((slot) => {
    const currentDate = dateKey(day);
    const startsOn = slot.starts_on ? String(slot.starts_on).slice(0, 10) : "0000-01-01";
    const endsOn = slot.ends_on ? String(slot.ends_on).slice(0, 10) : "9999-12-31";
    return slot.unit_id === unitId && currentDate >= startsOn && currentDate <= endsOn && (slot.weekdays ?? []).includes(day.getDay()) && slot.active !== false;
  }).reduce<Row[]>((unique, slot) => {
    const time = String(slot.starts_at);
    const existingIndex = unique.findIndex((candidate) => String(candidate.starts_at) === time);
    if (existingIndex < 0) return [...unique, slot];
    const existing = unique[existingIndex];
    const membersCount = (candidate: Row) => membersForSlot(candidate.id, day).length;
    const isGeneric = (candidate: Row) => /^horário fixo/i.test(String(candidate.name ?? ""));
    const shouldReplace = membersCount(slot) > membersCount(existing)
      || (membersCount(slot) === membersCount(existing) && isGeneric(existing) && !isGeneric(slot));
    if (shouldReplace) unique[existingIndex] = slot;
    return unique;
  }, []).sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)));

  async function createAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          unit_id: value(form, "unit_id"),
          patient_id: value(form, "patient_id") || undefined,
          professional_id: value(form, "professional_id"),
          service_id: value(form, "service_id") || undefined,
          room_id: value(form, "room_id") || undefined,
          starts_at: isoLocal(value(form, "starts_at")),
          ends_at: isoLocal(value(form, "ends_at")),
          notes: value(form, "notes") || undefined,
        }),
      });
      (event.target as HTMLFormElement).reset();
      setNotice("Agendamento criado.");
      await reload();
    } catch (actionError) {
      setNotice(messageOf(actionError));
    }
  }

  async function saveCalendarAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const body = {
      unit_id: value(form, "unit_id"),
      patient_id: value(form, "patient_id") || undefined,
      professional_id: value(form, "professional_id"),
      service_id: value(form, "service_id") || undefined,
      room_id: value(form, "room_id") || undefined,
      starts_at: isoLocal(value(form, "starts_at")),
      ends_at: isoLocal(value(form, "ends_at")),
      status: value(form, "status") || "scheduled",
      notes: value(form, "notes") || undefined,
    };
    try {
      await api(calendarAppointment?.id ? `/appointments/${calendarAppointment.id}` : "/appointments", {
        method: calendarAppointment?.id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setCalendarAppointment(undefined);
      setNotice(calendarAppointment?.id ? "Agendamento atualizado." : "Agendamento criado.");
      await reload();
    } catch (actionError) { setNotice(messageOf(actionError)); }
  }

  async function addGroupMember(event: FormEvent<HTMLFormElement>, groupId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const patientId = value(form, "patient_id");
    const group = fixedSlots.find((row) => row.id === groupId);
    const enrollment = (data["/enrollments"] ?? []).find((row: Row) => row.patient_id === patientId && row.unit_id === group?.unit_id && row.status === "active");
    if (!enrollment) return;
    try {
      await api(`/group-slots/${groupId}/members`, { method: "POST", body: JSON.stringify({ enrollment_id: enrollment.id, patient_id: enrollment.patient_id, weekdays: form.getAll("weekdays").map(Number), starts_at: value(form, "starts_at"), ends_at: value(form, "ends_at") || undefined }) });
      event.currentTarget.reset();
      setNotice("Paciente alocado na turma.");
      await reload();
      const memberships = await api<Row[]>("/group-slot-memberships");
      setGroupMembers(memberships.data ?? []);
    } catch (actionError) { setNotice(messageOf(actionError)); }
  }

  async function updateGroupMember(event: FormEvent<HTMLFormElement>, member: Row) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(`/group-slot-memberships/${member.id}`, {
        method: "PATCH",
        body: JSON.stringify({ weekdays: form.getAll("weekdays").map(Number), starts_at: member.starts_at, ends_at: member.ends_at || undefined }),
      });
      setNotice("Dias do paciente atualizados.");
      const memberships = await api<Row[]>("/group-slot-memberships");
      setGroupMembers(memberships.data ?? []);
    } catch (actionError) { setNotice(messageOf(actionError)); }
  }

  async function removeGroupMember(id: string) {
    if (!window.confirm("Retirar este aluno da turma? A matrícula será preservada.")) return;
    try { await api(`/group-slot-memberships/${id}`, { method: "DELETE" }); setNotice("Paciente removido da turma."); await reload(); const memberships = await api<Row[]>("/group-slot-memberships"); setGroupMembers(memberships.data ?? []); }
    catch (actionError) { setNotice(messageOf(actionError)); }
  }

  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">AGENDA OPERACIONAL</p>
          <h1>Agenda e turmas</h1>
          <p>
            Conflitos de profissional, sala e capacidade são validados pela API.
          </p>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <section className="card fixed-calendar month-calendar" aria-label="Calendário semanal de horários fixos">
        <div className="table-toolbar fixed-calendar-toolbar">
          <div><p className="eyebrow">CALENDÁRIO SEMANAL</p><h2>Horários por unidade</h2></div>
          <div className="fixed-calendar-toolbar-actions">
            <span>{visibleUnits[0]?.name ?? "Selecione uma unidade"}</span>
            <div className="calendar-month-controls" aria-label="Navegação do calendário">
              <button type="button" className="btn secondary" aria-label="Semana anterior" onClick={() => { const date = new Date(`${fromDate}T00:00:00`); date.setDate(date.getDate() - 7); setFromDate(date.toISOString().slice(0, 10)); }}>‹</button>
              <strong>{weekLabel}</strong>
              <button type="button" className="btn secondary" aria-label="Próxima semana" onClick={() => { const date = new Date(`${fromDate}T00:00:00`); date.setDate(date.getDate() + 7); setFromDate(date.toISOString().slice(0, 10)); }}>›</button>
              <button type="button" className="btn secondary" onClick={() => setFromDate(new Date().toISOString().slice(0, 10))}>Hoje</button>
            </div>
          </div>
        </div>
        {visibleUnits.map((unit) => (
          <div className="fixed-calendar-unit" key={unit.id}>
            <div className="fixed-calendar-scroll">
              <div className="month-calendar-grid">
                {(["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"] as const).map((day, index) => <div className="month-calendar-weekday" key={day}><span>{day}</span><small>{calendarDays[index].getDate()}</small></div>)}
                {calendarDays.map((day) => {
                  const dayAppointments = appointments.filter((row) => row.unit_id === unit.id && dateKey(new Date(row.starts_at)) === dateKey(day));
                  const slots = slotsForDay(unit.id, day);
                  const dayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(day);
                  return <div className={`month-calendar-day${dateKey(day) === dateKey(new Date()) ? " is-today" : ""}`} key={dateKey(day)} aria-label={dayLabel}>
                    <div className="month-calendar-items">
                      {dayAppointments.map((appointment) => <button type="button" className="month-calendar-item appointment-item" key={appointment.id} disabled={!canEdit} onClick={() => setCalendarAppointment(appointment)} aria-label={`${appointment.patients?.name ?? "Bloqueio"}, ${appointment.professionals?.name ? `fisioterapeuta responsável ${appointment.professionals.name}` : "sem fisioterapeuta responsável"}${canEdit ? ", editar agendamento" : ""}`}><strong>{String(new Date(appointment.starts_at).getHours()).padStart(2, "0")}:{String(new Date(appointment.starts_at).getMinutes()).padStart(2, "0")} · {appointment.patients?.name ?? "Bloqueio"}</strong><small><span>Fisioterapeuta: {appointment.professionals?.name ?? "Não informado"}</span><span>{appointment.services?.name ?? "Atendimento"}</span></small></button>)}
                      {slots.map((slot) => { const members = membersForSlot(slot.id, day); const professional = (data["/professionals"] ?? []).find((row: Row) => row.id === slot.professional_id); const time = String(slot.starts_at).slice(0, 5); return <button type="button" className="month-calendar-item group-item" key={slot.id} onClick={() => setSelectedGroupCell({ slot, day, unitName: unit.name })} aria-label={`Horário ${time}, fisioterapeuta responsável ${professional?.name ?? "não informado"}, ${members.length} de ${slot.capacity ?? 7} vagas, abrir lista de pacientes`}><strong>Horário {time}</strong><small><span>Fisioterapeuta: {professional?.name ?? "Não informado"}</span><span>{members.length}/{slot.capacity ?? 7} vagas</span></small></button>; })}
                    </div>
                  </div>;
                })}
              </div>
            </div>
          </div>
        ))}
        {!units.length && <p className="empty-state">Cadastre uma unidade para visualizar a agenda.</p>}
        {units.length > 0 && !selectedUnitId && <p className="empty-state">Selecione uma unidade no filtro superior para visualizar a agenda.</p>}
        {selectedUnitId && !visibleUnits.length && <p className="empty-state">A unidade selecionada não está disponível para este usuário.</p>}
      </section>
      {selectedGroupCell && (() => {
        const selectedMembers = membersForSlot(selectedGroupCell.slot.id, selectedGroupCell.day);
        const capacity = Number(selectedGroupCell.slot.capacity ?? 7);
        const slotMembers = groupMembers.filter((member) => member.group_slot_id === selectedGroupCell.slot.id && member.status === "active");
        const availableEnrollments = (data["/enrollments"] ?? []).filter((enrollment: Row) => enrollment.unit_id === selectedGroupCell.slot.unit_id && enrollment.status === "active" && !slotMembers.some((member) => member.enrollment_id === enrollment.id));
        const availablePatientIds = availableEnrollments.map((enrollment: Row) => String(enrollment.patient_id));
        const availablePatientIdSet = new Set(availablePatientIds);
        const availablePatients = patients.filter((patient) => availablePatientIdSet.has(patient.id));
        const full = selectedMembers.length >= capacity;
        const selectedDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(selectedGroupCell.day);
        const selectedProfessional = (data["/professionals"] ?? []).find((row: Row) => row.id === selectedGroupCell.slot.professional_id);
        return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedGroupCell(null); }}>
          <section className="modal group-members-drawer" role="dialog" aria-modal="true" aria-labelledby="group-members-title">
            <div className="modal-head">
              <div><p className="eyebrow">HORÁRIO · {selectedGroupCell.unitName}</p><h2 id="group-members-title">Horário {String(selectedGroupCell.slot.starts_at).slice(0, 5)}</h2><span className="group-members-drawer-meta">{selectedDate} · {selectedMembers.length}/{capacity} vagas</span><span className="group-members-drawer-professional">Fisioterapeuta responsável: <strong>{selectedProfessional?.name ?? "Não informado"}</strong></span></div>
              <button type="button" onClick={() => setSelectedGroupCell(null)} aria-label="Fechar lista de pacientes">×</button>
            </div>
            <div className="group-members-drawer-body">
              {full && <div className="capacity-alert" role="status"><strong>Horário lotado</strong><span>Não há vagas disponíveis para adicionar mais pacientes.</span></div>}
              <h3>Pacientes inscritos</h3>
              {selectedMembers.length ? <ul className="group-members-drawer-list">{selectedMembers.map((member) => <li key={member.id}><div><span>{member.patients?.name ?? "Paciente"}</span><small>{member.patients?.phone ?? ""}</small></div>{canEdit && <div className="group-member-actions"><form className="group-member-days-form" onSubmit={(event) => void updateGroupMember(event, member)}><SelectField name="weekdays" label={`Dias de ${member.patients?.name ?? "paciente"}`} defaultValue={(member.weekdays ?? []).map(String)} multiple size={5} required><option value="1">Segunda</option><option value="2">Terça</option><option value="3">Quarta</option><option value="4">Quinta</option><option value="5">Sexta</option></SelectField><button type="submit" className="btn secondary">Salvar dias</button></form><button type="button" className="action-delete" onClick={() => void removeGroupMember(member.id)}>Retirar da turma</button></div>}</li>)}</ul> : <p className="empty-state">Nenhum paciente está inscrito neste horário neste dia.</p>}
              {canEdit && <GroupMemberForm slotName={`Horário ${String(selectedGroupCell.slot.starts_at).slice(0, 5)}`} availablePatients={availablePatients} allowedPatientIds={availablePatientIds} selectedDate={dateKey(selectedGroupCell.day)} selectedWeekday={selectedGroupCell.day.getDay()} full={full} onSubmit={(event) => void addGroupMember(event, selectedGroupCell.slot.id)} />}
            </div>
          </section>
        </div>;
      })()}
      {calendarAppointment !== undefined && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCalendarAppointment(undefined); }}>
          <section className="modal calendar-edit-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-edit-title">
            <div className="modal-head"><div><p className="eyebrow">AGENDA</p><h2 id="calendar-edit-title">{calendarAppointment?.id ? "Editar agendamento" : "Novo agendamento"}</h2></div><button type="button" onClick={() => setCalendarAppointment(undefined)} aria-label="Fechar">×</button></div>
            <form className="modal-form" onSubmit={saveCalendarAppointment}>
              <div className="form-row"><Select name="unit_id" label="Unidade" rows={units} defaultValue={calendarAppointment?.unit_id} /><PatientPicker label="Paciente" rows={patients} required={false} defaultValue={calendarAppointment?.patient_id} defaultLabel={calendarAppointment?.patients?.name} /></div>
              <div className="form-row"><Select name="professional_id" label="Profissional" rows={data["/professionals"] ?? []} defaultValue={calendarAppointment?.professional_id} /><Select name="service_id" label="Serviço" rows={data["/services"] ?? []} required={false} defaultValue={calendarAppointment?.service_id} /></div>
              <div className="form-row"><TextField name="starts_at" label="Início" type="datetime-local" defaultValue={calendarAppointment?.starts_at ? localDateTime(calendarAppointment.starts_at) : ""} required /><TextField name="ends_at" label="Término" type="datetime-local" defaultValue={calendarAppointment?.ends_at ? localDateTime(calendarAppointment.ends_at) : ""} required /></div>
              <div className="form-row"><SelectField name="status" label="Status" defaultValue={calendarAppointment?.status ?? "scheduled"}><option value="scheduled">Agendado</option><option value="confirmed">Confirmado</option><option value="attending">Em atendimento</option><option value="missed">Falta</option><option value="cancelled">Cancelado</option></SelectField><TextareaField name="notes" label="Observações" defaultValue={calendarAppointment?.notes ?? ""} rows={2} /></div>
              <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setCalendarAppointment(undefined)}>Cancelar</button><button className="btn primary">Salvar alterações</button></div>
            </form>
          </section>
        </div>
      )}
      {canEdit && <div className="dashboard-grid">
        <DrawerForm title="Novo agendamento" onSubmit={createAppointment}>
          <h2>Novo agendamento</h2>
          <p className="form-instructions"><span aria-hidden="true">*</span> indica campo obrigatório.</p>
          <fieldset>
            <legend>Informações gerais</legend>
            <div className="form-row">
              <Select
                name="unit_id"
                label="Unidade *"
                rows={data["/units"] ?? []}
              />
              <Select
                name="professional_id"
                label="Profissional *"
                rows={data["/professionals"] ?? []}
              />
            </div>
            <div className="form-row">
              <PatientPicker label="Paciente *" rows={patients} />
              <Select
                name="service_id"
                label="Serviço"
                rows={data["/services"] ?? []}
                required={false}
              />
            </div>
          </fieldset>
          <fieldset>
            <legend>Data, horário e local</legend>
            <div className="form-row">
              <Select
                name="room_id"
                label="Sala"
                rows={data["/rooms"] ?? []}
                required={false}
              />
              <TextField id="appointment-starts-at" name="starts_at" label="Início" type="datetime-local" required />
            </div>
            <div className="form-row">
              <TextField id="appointment-ends-at" name="ends_at" label="Término" type="datetime-local" required />
              <TextField id="appointment-notes" name="notes" label="Observações" />
            </div>
          </fieldset>
          <button className="btn primary">Agendar</button>
        </DrawerForm>
      </div>}
      <EditableOperationalTable
        title="Atendimentos da semana"
        resource="appointments"
        rows={appointments.map((row: Row) => ({ ...row, patient_name: row.patients?.name ?? "Bloqueio", professional_name: row.professionals?.name ?? "Sem profissional", service_name: row.services?.name ?? "—", room_name: row.rooms?.name ?? "—" }))}
        fields={["starts_at", "patient_name", "professional_name", "status"]}
        editFields={[
          { name: "unit_id", label: "Unidade", type: "select", required: true, options: data["/units"] ?? [] },
          { name: "patient_id", label: "Paciente", type: "select", options: patients },
          { name: "professional_id", label: "Profissional", type: "select", required: true, options: data["/professionals"] ?? [] },
          { name: "service_id", label: "Serviço", type: "select", options: data["/services"] ?? [] },
          { name: "room_id", label: "Sala", type: "select", options: data["/rooms"] ?? [] },
          { name: "starts_at", label: "Início", type: "datetime-local", required: true, value: (row) => localDateTime(row.starts_at) },
          { name: "ends_at", label: "Término", type: "datetime-local", required: true, value: (row) => localDateTime(row.ends_at) },
          { name: "status", label: "Status", type: "select", required: true, options: [{ id: "scheduled", name: "Agendado" }, { id: "confirmed", name: "Confirmado" }, { id: "attending", name: "Em atendimento" }, { id: "missed", name: "Falta" }, { id: "cancelled", name: "Cancelado" }] },
          { name: "notes", label: "Observações", type: "textarea" },
        ]}
        buildBody={(form) => ({ unit_id: value(form, "unit_id"), patient_id: value(form, "patient_id") || undefined, professional_id: value(form, "professional_id"), service_id: value(form, "service_id") || undefined, room_id: value(form, "room_id") || undefined, starts_at: isoLocal(value(form, "starts_at")), ends_at: isoLocal(value(form, "ends_at")), status: value(form, "status"), notes: value(form, "notes") || undefined })}
        onChanged={reload}
        onNotice={setNotice}
        allowDelete
        showToggle={false}
        canEdit={canEdit}
      />
      <section className="card group-allocation-panel" aria-labelledby="group-allocation-title">
          <div className="table-toolbar"><div><p className="eyebrow">ALOCAÇÃO</p><h2 id="group-allocation-title">Alunos nos horários fixos</h2><p className="form-instructions">Os horários são permanentes. Aqui você apenas adiciona ou retira alunos.</p></div>{canEdit && <button type="button" className="btn secondary" onClick={onOpenPatients}>Cadastrar paciente</button>}</div>
        <div className="group-allocation-grid">
          {(data["/group-slots"] ?? []).map((group: Row) => {
            const members = groupMembers.filter((member) => member.group_slot_id === group.id);
            return <article className="group-allocation-card" key={group.id}>
              <div><strong>{group.name}</strong><span>{members.length}/{group.capacity ?? 7} vagas ocupadas · {String(group.starts_at).slice(0, 5)}</span></div>
              <div className="group-members-heading"><h3>Pacientes inscritos</h3><span>{members.length === 0 ? "Nenhum paciente nesta turma" : `${members.length} inscrito(s)`}</span></div>
              <ul aria-label={`Pacientes inscritos na turma ${group.name}`}>{members.map((member) => <li key={member.id}><span>{member.patients?.name ?? "Paciente"}</span>{canEdit && <button type="button" onClick={() => void removeGroupMember(member.id)} aria-label={`Remover ${member.patients?.name ?? "paciente"} da turma`}>Remover</button>}</li>)}</ul>
            </article>;
          })}
        </div>
      </section>
      <EditableOperationalTable
        title="Horários fixos"
        resource="group-slots"
        rows={(data["/group-slots"] ?? []).map((row: Row) => {
          const members = groupMembers.filter((member: Row) => member.group_slot_id === row.id);
          return {
            ...row,
            allocation: `${members.length}/${row.capacity ?? 7} · ${members.map((member: Row) => member.patients?.name).filter(Boolean).join(", ") || "Sem alunos"}`,
          };
        })}
        fields={["name", "weekdays", "starts_at", "duration_minutes", "capacity", "allocation"]}
        editFields={[
          { name: "unit_id", label: "Unidade", type: "select", required: true, options: data["/units"] ?? [] },
          { name: "room_id", label: "Sala", type: "select", required: true, options: data["/rooms"] ?? [] },
          { name: "professional_id", label: "Profissional", type: "select", required: true, options: data["/professionals"] ?? [] },
          { name: "service_id", label: "Serviço", type: "select", required: true, options: data["/services"] ?? [] },
          { name: "name", label: "Nome", required: true },
          { name: "starts_on", label: "Início do período", type: "date" },
          { name: "ends_on", label: "Fim do período", type: "date" },
          { name: "weekdays", label: "Dias da semana (0 domingo; 1 segunda...6 sábado)", required: true, value: (row) => (row.weekdays ?? []).join(",") },
          { name: "starts_at", label: "Horário", required: true },
          { name: "duration_minutes", label: "Duração (min)", type: "number", min: 15, max: 240, required: true },
          { name: "capacity", label: "Capacidade", type: "number", min: 1, max: 7, required: true },
          { name: "active", label: "Situação", type: "select", required: true, options: [{ id: "true", name: "Ativa" }, { id: "false", name: "Inativa" }] },
        ]}
        buildBody={(form) => ({
          name: value(form, "name"),
          starts_on: value(form, "starts_on") || null,
          ends_on: value(form, "ends_on") || null,
          unit_id: value(form, "unit_id"),
          room_id: value(form, "room_id"),
          professional_id: value(form, "professional_id"),
          service_id: value(form, "service_id"),
          weekdays: value(form, "weekdays").split(",").map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6),
          starts_at: value(form, "starts_at"),
          duration_minutes: Number(value(form, "duration_minutes")),
          capacity: Number(value(form, "capacity")),
          active: value(form, "active") === "true",
        })}
        onChanged={reload}
        onNotice={setNotice}
        canEdit={false}
      />
    </div>
  );
}
