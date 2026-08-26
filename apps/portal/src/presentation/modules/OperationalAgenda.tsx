import { FormEvent, type FormEventHandler, type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../infrastructure/http/api";
import type { Role } from "../../domain/portal";
import { agendaCapabilities, agendaResourcePaths, professionalsForUnit, resourcesForUnit } from "../../application/portal/agendaResources";
import { CheckboxField, FormSection, SelectField, TextareaField, TextField, WeekdayCheckboxGroup } from "../components/FormPrimitives";
import { type AgendaEnrollmentContext, Row, Unit, messageOf, value, isoLocal, localDateTime, dateKey, weekdaysLabel, useResources, Select, PatientPicker, DrawerForm, ModuleState, EditableOperationalTable } from "./OperationalShared";

const FIXED_GROUP_TIMES = Array.from({ length: 15 }, (_, index) => `${String(index + 6).padStart(2, "0")}:00`);

type Notice = { type: "success" | "error" | "warning" | "info"; message: string };
type GroupConflict = { message: string; group?: { name?: string; weekdays?: number[]; startsAt?: string; startsOn?: string | null; endsOn?: string | null } };

const APPOINTMENT_STATUS: Record<string, string> = {
  scheduled: "Agendado",
  confirmed: "Confirmado",
  attending: "Em atendimento",
  completed: "Concluído",
  missed: "Falta",
  cancelled: "Cancelado",
  blocked: "Horário bloqueado",
};

function clinicToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());
}

function appointmentTime(raw: unknown) {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(String(raw)));
}

function clinicDateKey(raw: unknown) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date(String(raw)));
}

function errorDetails(error: unknown) {
  return (error as { apiError?: { code?: string; details?: { conflictingGroup?: GroupConflict["group"] } } })?.apiError;
}

function conflictFrom(error: unknown): GroupConflict | null {
  const apiError = errorDetails(error);
  if (apiError?.code !== "GROUP_SLOT_CONFLICT") return null;
  return {
    message: "Já existe outra turma nesta unidade para o mesmo dia e horário. Escolha outro dia, horário ou ajuste o período de vigência.",
    group: apiError.details?.conflictingGroup,
  };
}

function shiftDate(raw: string, days: number) {
  const date = new Date(`${raw}T12:00:00`);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function addMinutesToLocalDateTime(raw: string, minutes: number) {
  if (!raw || !Number.isFinite(minutes) || minutes <= 0) return "";
  const date = new Date(raw);
  date.setMinutes(date.getMinutes() + minutes);
  return localDateTime(date.toISOString());
}

function GroupConflictAlert({ conflict }: { conflict: GroupConflict }) {
  const group = conflict.group;
  return <div className="group-conflict-alert" role="alert" id="group-slot-conflict">
    <span aria-hidden="true">!</span>
    <div>
      <strong>Horário indisponível</strong>
      <p>{conflict.message}</p>
      {group && <small>Conflito com: {group.name ?? "turma existente"}{group.weekdays?.length ? ` · ${weekdaysLabel(group.weekdays)}` : ""}{group.startsAt ? ` · ${group.startsAt}` : ""}{group.startsOn ? ` · de ${group.startsOn}` : ""}{group.endsOn ? ` até ${group.endsOn}` : ""}</small>}
    </div>
  </div>;
}

function AgendaDialog({ children, labelId, onClose, className = "" }: { children: ReactNode; labelId: string; onClose: () => void; className?: string }) {
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => { onCloseRef.current = onClose; }, [onClose]);
  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusables = () => dialogRef.current
      ? [...dialogRef.current.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true")
      : [];
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); return; }
      if (event.key !== "Tab") return;
      const elements = focusables();
      const first = elements[0];
      const last = elements.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    requestAnimationFrame(() => dialogRef.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={dialogRef} className={`modal ${className}`.trim()} role="dialog" aria-modal="true" aria-labelledby={labelId} tabIndex={-1}>
      {children}
    </section>
  </div>;
}

function GroupMemberForm({
  slotName,
  availablePatients,
  allowedPatientIds,
  selectedDate,
  slotWeekdays,
  full,
  onSubmit,
}: {
  slotName: string;
  availablePatients: Row[];
  allowedPatientIds: string[];
  selectedDate: string;
  slotWeekdays: number[];
  full: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
}) {
  const helperText = full
    ? "A capacidade máxima foi atingida."
    : allowedPatientIds.length
      ? "Apenas matrículas ainda não vinculadas aparecem aqui."
      : "Não há matrículas disponíveis. Cadastre e matricule o paciente primeiro.";
  return (
    <form className="group-member-form" onSubmit={onSubmit} aria-label={`Adicionar paciente à turma ${slotName}`}>
      <FormSection legend="Adicionar paciente à turma">
        <p className="form-instructions"><strong>Dias da turma:</strong> {weekdaysLabel(slotWeekdays)}. O paciente participará somente nesses dias.</p>
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
            hint="A partir de qual data o paciente participa desta turma."
          />
        </div>
        <div className="group-member-form-actions">
          <button className="btn primary group-members-add" disabled={full || !allowedPatientIds.length}>{full ? "Turma lotada" : "Adicionar paciente"}</button>
          <p className="form-instructions" role="status">{helperText}</p>
        </div>
      </FormSection>
    </form>
  );
}

export function OperationalAgenda({ onOpenPatients, onOpenEnrollment: _onOpenEnrollment, canEdit = true, role = "admin" }: { onOpenPatients?: () => void; onOpenEnrollment?: (context: AgendaEnrollmentContext) => void; canEdit?: boolean; role?: Role }) {
  const { canManageAppointments, canManageGroups } = agendaCapabilities(role, canEdit);
  const [fromDate, setFromDate] = useState(() =>
    clinicToday(),
  );
  const range = useMemo(() => {
    const selected = new Date(`${fromDate}T12:00:00`);
    const start = new Date(selected);
    start.setDate(selected.getDate() - selected.getDay());
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { from: new Date(`${dateKey(start)}T00:00:00-03:00`).toISOString(), to: new Date(`${dateKey(end)}T00:00:00-03:00`).toISOString() };
  }, [fromDate]);
  const paths = agendaResourcePaths(`/appointments?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`, role);
  const { data, loading, error, reload } = useResources(paths);
  const appointments: Row[] = data[paths[0]] ?? [];
  const patients: Row[] = data["/patients?page=1&pageSize=100"]?.items ?? [];
  const groupMembers: Row[] = data["/group-slot-memberships"] ?? [];
  const [notice, setNotice] = useState<Notice | null>(null);
  const [createGroupConflict, setCreateGroupConflict] = useState<GroupConflict | null>(null);
  const [editGroupConflict, setEditGroupConflict] = useState<GroupConflict | null>(null);
  const [creatingBlock, setCreatingBlock] = useState(false);
  const [newAppointmentServiceId, setNewAppointmentServiceId] = useState("");
  const [newAppointmentStart, setNewAppointmentStart] = useState("");
  const [newAppointmentEnd, setNewAppointmentEnd] = useState("");
  const [calendarAppointment, setCalendarAppointment] = useState<Row | null | undefined>(undefined);
  const [savingGroup, setSavingGroup] = useState(false);
  const [selectedUnitId, setSelectedUnitId] = useState(() => window.localStorage.getItem("fisiofit:selected-unit") ?? "");
  const [newGroupUnitId, setNewGroupUnitId] = useState(() => window.localStorage.getItem("fisiofit:selected-unit") ?? "");
  const [newAppointmentUnitId, setNewAppointmentUnitId] = useState(() => window.localStorage.getItem("fisiofit:selected-unit") ?? "");
  const [appointmentPickerVersion, setAppointmentPickerVersion] = useState(0);
  const [calendarAppointmentUnitId, setCalendarAppointmentUnitId] = useState("");
  const [selectedGroupCell, setSelectedGroupCell] = useState<{ slot: Row; day: Date; unitName: string } | null>(null);
  const success = (message: string) => setNotice({ type: "success", message });
  const failure = (error: unknown) => setNotice({ type: "error", message: messageOf(error).replace(/^Erro:\s*/, "") });
  const suggestedEnd = (startsAt: string, serviceId = newAppointmentServiceId) => {
    const service = (data["/services"] ?? []).find((row: Row) => row.id === serviceId);
    return addMinutesToLocalDateTime(startsAt, Number(service?.duration_minutes ?? 0));
  };
  useEffect(() => {
    if (notice?.type !== "success") return;
    const timer = window.setTimeout(() => setNotice(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    const onUnitChanged = (event: Event) => {
      const nextUnitId = (event as CustomEvent<string>).detail ?? window.localStorage.getItem("fisiofit:selected-unit") ?? "";
      setSelectedUnitId(nextUnitId);
      setNewGroupUnitId(nextUnitId);
      setNewAppointmentUnitId(nextUnitId);
    };
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
  const professionals: Row[] = data["/professionals"] ?? [];
  const rooms: Row[] = data["/rooms"] ?? [];
  const visibleUnits = selectedUnitId ? units.filter((unit) => unit.id === selectedUnitId) : [];
  const membersForSlot = (slotId: string, date: Date) => groupMembers.filter((member) => {
    if (member.group_slot_id !== slotId || member.status !== "active") return false;
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
  }).sort((a, b) => String(a.starts_at).localeCompare(String(b.starts_at)) || String(a.name).localeCompare(String(b.name), "pt-BR"));

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreateGroupConflict(null);
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/group-slots", {
        method: "POST",
        body: JSON.stringify({
          unit_id: value(form, "unit_id"),
          room_id: value(form, "room_id") || undefined,
          professional_id: value(form, "professional_id"),
          service_id: value(form, "service_id") || undefined,
          name: value(form, "name"),
          weekdays: form.getAll("weekdays").map(Number),
          starts_at: value(form, "starts_at"),
          starts_on: value(form, "starts_on") || undefined,
          ends_on: value(form, "ends_on") || undefined,
          duration_minutes: Number(value(form, "duration_minutes")),
          capacity: Number(value(form, "capacity")),
        }),
      });
      formElement.reset();
      success("Turma criada no horário fixo.");
      await reload();
    } catch (actionError) {
      const conflict = conflictFrom(actionError);
      if (conflict) {
        setCreateGroupConflict(conflict);
        requestAnimationFrame(() => formElement.querySelector<HTMLElement>('[name="starts_at"]')?.focus());
      }
      failure(actionError);
    }
  }

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
      setAppointmentPickerVersion((version) => version + 1);
      setCreatingBlock(false);
      setNewAppointmentServiceId("");
      setNewAppointmentStart("");
      setNewAppointmentEnd("");
      success(creatingBlock ? "Horário bloqueado." : "Agendamento criado.");
      await reload();
    } catch (actionError) {
      failure(actionError);
    }
  }

  async function saveCalendarAppointment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const editableStatus = calendarAppointment && !["completed", "blocked"].includes(String(calendarAppointment.status));
    const body = {
      unit_id: value(form, "unit_id"),
      patient_id: value(form, "patient_id") || undefined,
      professional_id: value(form, "professional_id"),
      service_id: value(form, "service_id") || undefined,
      room_id: value(form, "room_id") || undefined,
      starts_at: isoLocal(value(form, "starts_at")),
      ends_at: isoLocal(value(form, "ends_at")),
      ...(editableStatus ? { status: value(form, "status") || "scheduled" } : {}),
      notes: value(form, "notes") || undefined,
    };
    try {
      await api(calendarAppointment?.id ? `/appointments/${calendarAppointment.id}` : "/appointments", {
        method: calendarAppointment?.id ? "PATCH" : "POST",
        body: JSON.stringify(body),
      });
      setCalendarAppointment(undefined);
      success(calendarAppointment?.id ? "Agendamento atualizado." : "Agendamento criado.");
      await reload();
    } catch (actionError) { failure(actionError); }
  }

  async function cancelAppointment(appointment: Row) {
    if (!window.confirm("Cancelar este agendamento? O registro será preservado no histórico.")) return;
    try {
      await api(`/appointments/${appointment.id}/status`, { method: "PATCH", body: JSON.stringify({ status: "cancelled" }) });
      setCalendarAppointment(undefined);
      success("Agendamento cancelado e preservado no histórico.");
      await reload();
    } catch (actionError) {
      failure(actionError);
    }
  }

  async function completeAppointment(appointment: Row) {
    if (!window.confirm("Concluir este atendimento? A sessão será contabilizada na matrícula vinculada.")) return;
    try {
      await api(`/appointments/${appointment.id}/complete`, { method: "POST" });
      setCalendarAppointment(undefined);
      success("Atendimento concluído.");
      await reload();
    } catch (actionError) { failure(actionError); }
  }

  async function updateAppointmentStatus(appointment: Row, status: "confirmed" | "attending" | "missed") {
    try {
      await api(`/appointments/${appointment.id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      setCalendarAppointment((current) => current ? { ...current, status } : current);
      success(`Status atualizado para ${APPOINTMENT_STATUS[status].toLocaleLowerCase("pt-BR")}.`);
      await reload();
    } catch (actionError) { failure(actionError); }
  }

  async function addGroupMember(event: FormEvent<HTMLFormElement>, groupId: string) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const patientId = value(form, "patient_id");
    const group = fixedSlots.find((row) => row.id === groupId);
    const enrollment = (data["/enrollments"] ?? []).find((row: Row) => row.patient_id === patientId && row.unit_id === group?.unit_id && row.status === "active");
    if (!enrollment) {
      setNotice({ type: "error", message: "O paciente precisa ter uma matrícula ativa nesta unidade antes de entrar na turma." });
      return;
    }
    try {
      await api(`/group-slots/${groupId}/members`, { method: "POST", body: JSON.stringify({ enrollment_id: enrollment.id, patient_id: enrollment.patient_id, starts_at: value(form, "starts_at"), ends_at: value(form, "ends_at") || undefined }) });
      formElement.reset();
      success("Paciente alocado na turma.");
      await reload();
    } catch (actionError) { failure(actionError); }
  }

  async function removeGroupMember(id: string) {
    if (!window.confirm("Retirar este aluno da turma? A matrícula será preservada.")) return;
    try { await api(`/group-slot-memberships/${id}`, { method: "DELETE" }); success("Paciente removido da turma."); await reload(); }
    catch (actionError) { failure(actionError); }
  }

  async function updateGroup(event: FormEvent<HTMLFormElement>, slot: Row) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    setEditGroupConflict(null);
    setSavingGroup(true);
    try {
      const response = await api<Row>(`/group-slots/${slot.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: value(form, "name"),
          professional_id: value(form, "professional_id"),
          room_id: value(form, "room_id") || null,
          service_id: value(form, "service_id") || null,
          weekdays: form.getAll("weekdays").map(Number),
          starts_at: value(form, "starts_at"),
          starts_on: value(form, "starts_on") || null,
          ends_on: value(form, "ends_on") || null,
          duration_minutes: Number(value(form, "duration_minutes")),
          capacity: Number(value(form, "capacity")),
          active: value(form, "active") === "true",
        }),
      });
      const updatedSlot = response.data ?? slot;
      setSelectedGroupCell((current) => current
        ? { ...current, slot: { ...current.slot, ...updatedSlot } }
        : current);
      success("Turma atualizada.");
      await reload();
    } catch (actionError) {
      const conflict = conflictFrom(actionError);
      if (conflict) {
        setEditGroupConflict(conflict);
        requestAnimationFrame(() => formElement.querySelector<HTMLElement>('[name="starts_at"]')?.focus());
      }
      failure(actionError);
    } finally {
      setSavingGroup(false);
    }
  }

  function openCalendarAppointment(appointment: Row) {
    setCalendarAppointmentUnitId(String(appointment.unit_id ?? selectedUnitId));
    setCalendarAppointment(appointment);
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
        <div className={`toast toast-${notice.type}`} role={notice.type === "error" ? "alert" : "status"} aria-live={notice.type === "error" ? "assertive" : "polite"}>
          <span aria-hidden="true">{notice.type === "success" ? "✓" : notice.type === "error" ? "!" : "i"}</span>
          <div><strong>{notice.type === "success" ? "Concluído" : notice.type === "error" ? "Não foi possível concluir" : "Atenção"}</strong><p>{notice.message}</p></div>
          <button type="button" onClick={() => setNotice(null)} aria-label="Fechar mensagem">×</button>
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <section className="card fixed-calendar month-calendar" aria-label="Calendário semanal de horários fixos">
        <div className="table-toolbar fixed-calendar-toolbar">
          <div><p className="eyebrow">CALENDÁRIO SEMANAL</p><h2>Horários por unidade</h2></div>
          <div className="fixed-calendar-toolbar-actions">
            <span>{visibleUnits[0]?.name ?? "Selecione uma unidade"}</span>
            <div className="calendar-month-controls" aria-label="Navegação do calendário">
              <button type="button" className="btn secondary" aria-label="Semana anterior" onClick={() => setFromDate(shiftDate(fromDate, -7))}>‹</button>
              <strong>{weekLabel}</strong>
              <button type="button" className="btn secondary" aria-label="Próxima semana" onClick={() => setFromDate(shiftDate(fromDate, 7))}>›</button>
              <button type="button" className="btn secondary" onClick={() => setFromDate(clinicToday())}>Hoje</button>
            </div>
          </div>
        </div>
        {visibleUnits.map((unit) => (
          <div className="fixed-calendar-unit" key={unit.id}>
            <div className="fixed-calendar-scroll">
              <div className="month-calendar-grid">
                {(["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"] as const).map((day, index) => <div className="month-calendar-weekday" key={day}><span>{day}</span><small>{calendarDays[index].getDate()}</small></div>)}
                {calendarDays.map((day) => {
                  const dayAppointments = appointments.filter((row) => row.unit_id === unit.id && clinicDateKey(row.starts_at) === dateKey(day));
                  const slots = slotsForDay(unit.id, day);
                  const dayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(day);
                  return <div className={`month-calendar-day${dateKey(day) === clinicToday() ? " is-today" : ""}`} key={dateKey(day)} aria-label={dayLabel}>
                    <div className="month-calendar-items">
                      {dayAppointments.map((appointment) => <button type="button" className={`month-calendar-item appointment-item status-${appointment.status ?? "scheduled"}`} key={appointment.id} onClick={() => openCalendarAppointment(appointment)} aria-label={`${appointment.patients?.name ?? "Horário bloqueado"}, ${APPOINTMENT_STATUS[appointment.status] ?? appointment.status}, ${appointment.professionals?.name ? `fisioterapeuta responsável ${appointment.professionals.name}` : "sem fisioterapeuta responsável"}, abrir detalhes`}><strong>{appointmentTime(appointment.starts_at)} · {appointment.patients?.name ?? "Horário bloqueado"}</strong><small><span className="appointment-status-label">{APPOINTMENT_STATUS[appointment.status] ?? appointment.status}</span><span>Fisioterapeuta: {appointment.professionals?.name ?? "Não informado"}</span><span>{appointment.services?.name ?? "Atendimento"}{appointment.rooms?.name ? ` · ${appointment.rooms.name}` : ""}</span></small></button>)}
                      {slots.map((slot) => { const members = membersForSlot(slot.id, day); const professional = (data["/professionals"] ?? []).find((row: Row) => row.id === slot.professional_id); const time = String(slot.starts_at).slice(0, 5); return <button type="button" className="month-calendar-item group-item" key={slot.id} onClick={() => setSelectedGroupCell({ slot, day, unitName: unit.name })} aria-label={`${slot.name}, ${time}, fisioterapeuta responsável ${professional?.name ?? "não informado"}, ${members.length} de ${slot.capacity ?? 7} vagas, abrir turma`}><strong>{time} · {slot.name}</strong><small><span>Fisioterapeuta: {professional?.name ?? "Não informado"}</span><span>{members.length}/{slot.capacity ?? 7} vagas</span></small></button>; })}
                    </div>
                  </div>;
                })}
              </div>
            </div>
            <div className="agenda-mobile-list" aria-label={`Agenda semanal de ${unit.name}`}>
              {calendarDays.map((day) => {
                const dayAppointments = appointments.filter((row) => row.unit_id === unit.id && clinicDateKey(row.starts_at) === dateKey(day));
                const slots = slotsForDay(unit.id, day);
                const dayLabel = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "short" }).format(day).replaceAll(".", "");
                return <section className={`agenda-mobile-day${dateKey(day) === clinicToday() ? " is-today" : ""}`} key={`mobile-${dateKey(day)}`} aria-labelledby={`mobile-day-${dateKey(day)}`}>
                  <h3 id={`mobile-day-${dateKey(day)}`}>{dayLabel}{dateKey(day) === clinicToday() ? " · Hoje" : ""}</h3>
                  <div className="month-calendar-items">
                    {dayAppointments.map((appointment) => <button type="button" className={`month-calendar-item appointment-item status-${appointment.status ?? "scheduled"}`} key={appointment.id} onClick={() => openCalendarAppointment(appointment)}><strong>{appointmentTime(appointment.starts_at)} · {appointment.patients?.name ?? "Horário bloqueado"}</strong><small><span className="appointment-status-label">{APPOINTMENT_STATUS[appointment.status] ?? appointment.status}</span><span>{appointment.professionals?.name ?? "Profissional não informado"}</span><span>{appointment.services?.name ?? "Atendimento"}{appointment.rooms?.name ? ` · ${appointment.rooms.name}` : ""}</span></small></button>)}
                    {slots.map((slot) => { const members = membersForSlot(slot.id, day); const professional = professionals.find((row: Row) => row.id === slot.professional_id); return <button type="button" className="month-calendar-item group-item" key={slot.id} onClick={() => setSelectedGroupCell({ slot, day, unitName: unit.name })}><strong>{String(slot.starts_at).slice(0, 5)} · {slot.name}</strong><small><span>{professional?.name ?? "Profissional não informado"}</span><span>{members.length}/{slot.capacity ?? 7} vagas</span></small></button>; })}
                    {!dayAppointments.length && !slots.length && <p className="agenda-mobile-empty">Nenhum horário.</p>}
                  </div>
                </section>;
              })}
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
        const selectedProfessional = professionals.find((row: Row) => row.id === selectedGroupCell.slot.professional_id);
        const availableProfessionals = professionalsForUnit(professionals, selectedGroupCell.slot.unit_id, selectedGroupCell.slot.professional_id);
        const availableRooms = rooms.filter((room) => room.unit_id === selectedGroupCell.slot.unit_id && (room.active !== false || room.id === selectedGroupCell.slot.room_id));
        return <AgendaDialog labelId="group-members-title" className="group-members-drawer" onClose={() => { setSelectedGroupCell(null); setEditGroupConflict(null); }}>
            <div className="modal-head">
              <div><p className="eyebrow">TURMA · {selectedGroupCell.unitName}</p><h2 id="group-members-title">{selectedGroupCell.slot.name}</h2><span className="group-members-drawer-meta">{weekdaysLabel(selectedGroupCell.slot.weekdays)} · {String(selectedGroupCell.slot.starts_at).slice(0, 5)} · {selectedMembers.length}/{capacity} vagas</span>{!canManageGroups && <span className="group-members-drawer-professional">Fisioterapeuta responsável: <strong>{selectedProfessional?.name ?? "Não informado"}</strong></span>}</div>
              <button type="button" onClick={() => { setSelectedGroupCell(null); setEditGroupConflict(null); }} aria-label="Fechar lista de pacientes">×</button>
            </div>
            <div className="group-members-drawer-body">
              {canManageGroups && <form key={`${selectedGroupCell.slot.id}-${selectedGroupCell.slot.updated_at ?? "current"}`} className="modal-form group-edit-form" onSubmit={(event) => void updateGroup(event, selectedGroupCell.slot)} aria-busy={savingGroup}>
                <div className="group-edit-heading"><div><h3>Editar turma</h3><p>Altere os dias, horário e responsável desta turma.</p></div><span>{selectedGroupCell.unitName}</span></div>
                <TextField name="name" label="Nome da turma" defaultValue={selectedGroupCell.slot.name} required disabled={savingGroup} />
                <div className="form-row">
                  <SelectField name="professional_id" label="Fisioterapeuta responsável" defaultValue={selectedGroupCell.slot.professional_id ?? ""} required disabled={savingGroup}>
                    <option value="">Selecione</option>
                    {availableProfessionals.map((professional) => <option key={professional.id} value={professional.id}>{professional.name}</option>)}
                  </SelectField>
                  <SelectField name="room_id" label="Sala (opcional)" defaultValue={selectedGroupCell.slot.room_id ?? ""} disabled={savingGroup}>
                    <option value="">Nenhuma</option>
                    {availableRooms.map((room) => <option key={room.id} value={room.id}>{room.name}</option>)}
                  </SelectField>
                </div>
                <SelectField name="service_id" label="Serviço (opcional)" defaultValue={selectedGroupCell.slot.service_id ?? ""} disabled={savingGroup}>
                  <option value="">Nenhum</option>
                  {(data["/services"] ?? []).filter((service: Row) => service.active !== false || service.id === selectedGroupCell.slot.service_id).map((service: Row) => <option key={service.id} value={service.id}>{service.name}</option>)}
                </SelectField>
                <WeekdayCheckboxGroup label="Dias da turma" defaultValue={(selectedGroupCell.slot.weekdays ?? []).map(String)} maxSelections={5} required disabled={savingGroup} error={editGroupConflict?.message} onSelectionChange={() => setEditGroupConflict(null)} />
                <div className="form-row">
                  <SelectField name="starts_at" label="Horário fixo" defaultValue={String(selectedGroupCell.slot.starts_at ?? "").slice(0, 5)} required disabled={savingGroup} error={editGroupConflict?.message} onChange={() => setEditGroupConflict(null)}>
                    <option value="">Selecione</option>
                    {FIXED_GROUP_TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
                  </SelectField>
                  <TextField name="duration_minutes" label="Duração (minutos)" type="number" min="15" max="240" defaultValue={selectedGroupCell.slot.duration_minutes ?? 60} required disabled={savingGroup} />
                </div>
                {editGroupConflict && <GroupConflictAlert conflict={editGroupConflict} />}
                <div className="form-row">
                  <TextField name="starts_on" label="Início do período (opcional)" type="date" defaultValue={selectedGroupCell.slot.starts_on ?? ""} disabled={savingGroup} onChange={() => setEditGroupConflict(null)} />
                  <TextField name="ends_on" label="Fim do período (opcional)" type="date" defaultValue={selectedGroupCell.slot.ends_on ?? ""} disabled={savingGroup} onChange={() => setEditGroupConflict(null)} />
                </div>
                <div className="form-row">
                  <TextField name="capacity" label="Capacidade" type="number" min="3" max="7" defaultValue={capacity} required disabled={savingGroup} />
                  <SelectField name="active" label="Situação" defaultValue={selectedGroupCell.slot.active === false ? "false" : "true"} required disabled={savingGroup}>
                    <option value="true">Ativa</option><option value="false">Inativa</option>
                  </SelectField>
                </div>
                {!availableProfessionals.length && <p className="form-field-error" role="alert">Nenhum fisioterapeuta ativo está vinculado a esta unidade. Atualize o cadastro em Configurações.</p>}
                <button type="submit" className="btn primary" disabled={savingGroup || !availableProfessionals.length || Boolean(editGroupConflict)}>{savingGroup ? "Salvando…" : editGroupConflict ? "Ajuste o horário para continuar" : "Salvar alterações da turma"}</button>
              </form>}
              {full && <div className="capacity-alert" role="status"><strong>Turma lotada</strong><span>Não há vagas disponíveis para adicionar mais pacientes.</span></div>}
              <h3>Pacientes inscritos</h3>
              {selectedMembers.length ? <ul className="group-members-drawer-list">{selectedMembers.map((member) => <li key={member.id}><div><span>{member.patients?.name ?? "Paciente"}</span><small>{member.patients?.phone ?? ""}</small></div>{canManageGroups && <button type="button" className="action-delete" onClick={() => void removeGroupMember(member.id)}>Retirar da turma</button>}</li>)}</ul> : <p className="empty-state">Nenhum paciente está inscrito nesta turma.</p>}
              {canManageGroups && <GroupMemberForm slotName={selectedGroupCell.slot.name} availablePatients={availablePatients} allowedPatientIds={availablePatientIds} selectedDate={dateKey(selectedGroupCell.day)} slotWeekdays={selectedGroupCell.slot.weekdays ?? []} full={full} onSubmit={(event) => void addGroupMember(event, selectedGroupCell.slot.id)} />}
            </div>
        </AgendaDialog>;
      })()}
      {calendarAppointment !== undefined && calendarAppointment && (
        <AgendaDialog labelId="calendar-edit-title" className="calendar-edit-modal" onClose={() => setCalendarAppointment(undefined)}>
            <div className="modal-head"><div><p className="eyebrow">AGENDA · {APPOINTMENT_STATUS[calendarAppointment.status] ?? calendarAppointment.status}</p><h2 id="calendar-edit-title">{canManageAppointments ? "Editar agendamento" : "Detalhes do agendamento"}</h2></div><button type="button" onClick={() => setCalendarAppointment(undefined)} aria-label="Fechar">×</button></div>
            {canManageAppointments ? <form className="modal-form" onSubmit={saveCalendarAppointment}>
              {!['completed', 'cancelled', 'blocked'].includes(String(calendarAppointment.status)) && <div className="appointment-quick-status" aria-label="Atualização rápida de status"><span>Atualização rápida</span><button type="button" className={calendarAppointment.status === "confirmed" ? "active" : ""} onClick={() => void updateAppointmentStatus(calendarAppointment, "confirmed")}>Confirmar</button><button type="button" className={calendarAppointment.status === "attending" ? "active" : ""} onClick={() => void updateAppointmentStatus(calendarAppointment, "attending")}>Em atendimento</button><button type="button" className={calendarAppointment.status === "missed" ? "active" : ""} onClick={() => void updateAppointmentStatus(calendarAppointment, "missed")}>Registrar falta</button></div>}
              <div className="form-row"><SelectField name="unit_id" label="Unidade" value={calendarAppointmentUnitId} onChange={(event) => setCalendarAppointmentUnitId(event.target.value)} required><option value="">Selecione</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</SelectField><PatientPicker key={`calendar-patient-${calendarAppointmentUnitId}`} label="Paciente" rows={resourcesForUnit(patients, calendarAppointmentUnitId, "primary_unit_id")} unitId={calendarAppointmentUnitId} required={false} defaultValue={calendarAppointmentUnitId === calendarAppointment?.unit_id ? calendarAppointment?.patient_id : ""} defaultLabel={calendarAppointmentUnitId === calendarAppointment?.unit_id ? calendarAppointment?.patients?.name : ""} /></div>
              <div className="form-row"><Select key={`calendar-professional-${calendarAppointmentUnitId}`} name="professional_id" label="Profissional" rows={professionalsForUnit(professionals, calendarAppointmentUnitId, calendarAppointmentUnitId === calendarAppointment?.unit_id ? calendarAppointment?.professional_id : "")} defaultValue={calendarAppointmentUnitId === calendarAppointment?.unit_id ? calendarAppointment?.professional_id : ""} /><Select name="service_id" label="Serviço" rows={(data["/services"] ?? []).filter((service: Row) => service.active !== false || service.id === calendarAppointment.service_id)} required={false} defaultValue={calendarAppointment?.service_id} /></div>
              <Select key={`calendar-room-${calendarAppointmentUnitId}`} name="room_id" label="Sala (opcional)" rows={resourcesForUnit(rooms, calendarAppointmentUnitId)} required={false} defaultValue={calendarAppointmentUnitId === calendarAppointment?.unit_id ? calendarAppointment?.room_id : ""} />
              <div className="form-row"><TextField name="starts_at" label="Início" type="datetime-local" defaultValue={calendarAppointment?.starts_at ? localDateTime(calendarAppointment.starts_at) : ""} required /><TextField name="ends_at" label="Término" type="datetime-local" defaultValue={calendarAppointment?.ends_at ? localDateTime(calendarAppointment.ends_at) : ""} required /></div>
              <div className="form-row"><SelectField name="status" label="Status" defaultValue={calendarAppointment?.status ?? "scheduled"} disabled={["completed", "blocked"].includes(String(calendarAppointment.status))}><option value="scheduled">Agendado</option><option value="confirmed">Confirmado</option><option value="attending">Em atendimento</option><option value="missed">Falta</option><option value="cancelled">Cancelado</option>{calendarAppointment.status === "completed" && <option value="completed">Concluído</option>}{calendarAppointment.status === "blocked" && <option value="blocked">Horário bloqueado</option>}</SelectField><TextareaField name="notes" label="Observações" defaultValue={calendarAppointment?.notes ?? ""} rows={2} /></div>
              <div className="modal-actions">{!["cancelled", "completed"].includes(String(calendarAppointment.status)) && <button type="button" className="btn secondary action-delete" onClick={() => void cancelAppointment(calendarAppointment)}>Cancelar agendamento</button>}{!["cancelled", "completed", "blocked"].includes(String(calendarAppointment.status)) && <button type="button" className="btn secondary action-complete" onClick={() => void completeAppointment(calendarAppointment)}>Concluir atendimento</button>}<button type="button" className="btn secondary" onClick={() => setCalendarAppointment(undefined)}>Fechar</button><button className="btn primary">Salvar alterações</button></div>
            </form> : <div className="appointment-readonly-details"><dl><div><dt>Status</dt><dd>{APPOINTMENT_STATUS[calendarAppointment.status] ?? calendarAppointment.status}</dd></div><div><dt>Paciente</dt><dd>{calendarAppointment.patients?.name ?? "Horário bloqueado"}</dd></div><div><dt>Profissional</dt><dd>{calendarAppointment.professionals?.name ?? "Não informado"}</dd></div><div><dt>Início</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(calendarAppointment.starts_at))}</dd></div><div><dt>Término</dt><dd>{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(calendarAppointment.ends_at))}</dd></div><div><dt>Serviço</dt><dd>{calendarAppointment.services?.name ?? "Não informado"}</dd></div><div><dt>Sala</dt><dd>{calendarAppointment.rooms?.name ?? "Não informada"}</dd></div>{calendarAppointment.notes && <div><dt>Observações</dt><dd>{calendarAppointment.notes}</dd></div>}</dl><button type="button" className="btn secondary" onClick={() => setCalendarAppointment(undefined)}>Fechar</button></div>}
        </AgendaDialog>
      )}
      {(canManageGroups || canManageAppointments) && <div className="dashboard-grid">
        {canManageGroups && <DrawerForm title="Nova turma em horário fixo" onSubmit={createGroup}>
          <p className="form-instructions">O horário permanece fixo. Turmas diferentes podem usar o mesmo horário quando seus dias não se sobrepõem.</p>
          <fieldset>
            <legend>Identificação e responsável</legend>
            <TextField name="name" label="Nome da turma" placeholder="Ex.: Lagoa · Seg/Qua 07h" required />
            <div className="form-row">
              <SelectField name="unit_id" label="Unidade" value={newGroupUnitId} onChange={(event) => { setNewGroupUnitId(event.target.value); setCreateGroupConflict(null); }} required><option value="">Selecione</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</SelectField>
              <Select key={`group-professional-${newGroupUnitId}`} name="professional_id" label="Fisioterapeuta responsável" rows={professionalsForUnit(professionals, newGroupUnitId)} />
            </div>
            <div className="form-row">
              <Select key={`group-room-${newGroupUnitId}`} name="room_id" label="Sala (opcional)" rows={resourcesForUnit(rooms, newGroupUnitId)} required={false} />
              <Select name="service_id" label="Serviço (opcional)" rows={(data["/services"] ?? []).filter((service: Row) => service.active !== false)} required={false} />
            </div>
            {newGroupUnitId && !professionalsForUnit(professionals, newGroupUnitId).length && <p className="form-field-error" role="alert">Esta unidade não possui fisioterapeuta ativo vinculado. Atualize o profissional em Configurações.</p>}
          </fieldset>
          <fieldset>
            <legend>Dias e horário fixo</legend>
            <WeekdayCheckboxGroup label="Dias da turma" required maxSelections={5} error={createGroupConflict?.message} onSelectionChange={() => setCreateGroupConflict(null)} />
            <div className="form-row">
              <SelectField name="starts_at" label="Horário fixo" required defaultValue="" error={createGroupConflict?.message} onChange={() => setCreateGroupConflict(null)}>
                <option value="">Selecione</option>
                {FIXED_GROUP_TIMES.map((time) => <option key={time} value={time}>{time}</option>)}
              </SelectField>
              <TextField name="duration_minutes" label="Duração (minutos)" type="number" min="15" max="240" defaultValue="60" required />
            </div>
            <div className="form-row">
              <TextField name="starts_on" label="Início da turma (opcional)" type="date" onChange={() => setCreateGroupConflict(null)} />
              <TextField name="ends_on" label="Fim da turma (opcional)" type="date" onChange={() => setCreateGroupConflict(null)} />
            </div>
            <TextField name="capacity" label="Capacidade" type="number" min="3" max="7" defaultValue="7" required />
          </fieldset>
          {createGroupConflict && <GroupConflictAlert conflict={createGroupConflict} />}
          <button className="btn primary" disabled={!newGroupUnitId || !professionalsForUnit(professionals, newGroupUnitId).length || Boolean(createGroupConflict)}>{createGroupConflict ? "Ajuste o horário para continuar" : "Criar turma"}</button>
        </DrawerForm>}
        {canManageAppointments && <DrawerForm title="Novo agendamento" onSubmit={createAppointment}>
          <p className="form-instructions"><span aria-hidden="true">*</span> indica campo obrigatório.</p>
          <fieldset>
            <legend>Informações gerais</legend>
            <div className="form-row">
              <SelectField name="unit_id" label="Unidade *" value={newAppointmentUnitId} onChange={(event) => setNewAppointmentUnitId(event.target.value)} required><option value="">Selecione</option>{units.map((unit) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</SelectField>
              <Select
                key={`appointment-professional-${newAppointmentUnitId}`}
                name="professional_id"
                label="Profissional *"
                rows={professionalsForUnit(professionals, newAppointmentUnitId)}
              />
            </div>
            <div className="form-row">
              {creatingBlock ? <div className="blocked-slot-explanation" role="status"><strong>Horário bloqueado</strong><span>Nenhum paciente será vinculado a este compromisso.</span></div> : <PatientPicker key={`${appointmentPickerVersion}-${newAppointmentUnitId}`} label="Paciente *" rows={resourcesForUnit(patients, newAppointmentUnitId, "primary_unit_id")} unitId={newAppointmentUnitId} />}
              <SelectField name="service_id" label="Serviço" value={newAppointmentServiceId} onChange={(event) => { const serviceId = event.target.value; setNewAppointmentServiceId(serviceId); const nextEnd = suggestedEnd(newAppointmentStart, serviceId); if (nextEnd) setNewAppointmentEnd(nextEnd); }}><option value="">Nenhum</option>{(data["/services"] ?? []).filter((service: Row) => service.active !== false).map((service: Row) => <option key={service.id} value={service.id}>{service.name}</option>)}</SelectField>
            </div>
            <CheckboxField name="blocked_slot" label="Bloquear este horário sem paciente" checked={creatingBlock} onChange={(event) => setCreatingBlock(event.target.checked)} />
          </fieldset>
          <fieldset>
            <legend>Data, horário e local</legend>
            <div className="form-row">
              <Select
                key={`appointment-room-${newAppointmentUnitId}`}
                name="room_id"
                label="Sala"
                rows={resourcesForUnit(rooms, newAppointmentUnitId)}
                required={false}
              />
              <TextField id="appointment-starts-at" name="starts_at" label="Início" type="datetime-local" value={newAppointmentStart} onChange={(event) => { setNewAppointmentStart(event.target.value); const nextEnd = suggestedEnd(event.target.value); if (nextEnd) setNewAppointmentEnd(nextEnd); }} required />
            </div>
            <div className="form-row">
              <TextField id="appointment-ends-at" name="ends_at" label="Término" type="datetime-local" value={newAppointmentEnd} onChange={(event) => setNewAppointmentEnd(event.target.value)} hint={newAppointmentServiceId ? "Sugerido pela duração do serviço; ajuste se necessário." : undefined} required />
              <TextField id="appointment-notes" name="notes" label="Observações" />
            </div>
          </fieldset>
          {newAppointmentUnitId && !professionalsForUnit(professionals, newAppointmentUnitId).length && <p className="form-field-error" role="alert">Esta unidade não possui profissional ativo vinculado.</p>}
          <button className="btn primary" disabled={!newAppointmentUnitId || !professionalsForUnit(professionals, newAppointmentUnitId).length}>{creatingBlock ? "Bloquear horário" : "Agendar"}</button>
        </DrawerForm>}
      </div>}
      <EditableOperationalTable
        title="Atendimentos da semana"
        resource="appointments"
        rows={appointments.map((row: Row) => ({ ...row, patient_name: row.patients?.name ?? "Horário bloqueado", professional_name: row.professionals?.name ?? "Sem profissional", service_name: row.services?.name ?? "—", room_name: row.rooms?.name ?? "—", status_label: APPOINTMENT_STATUS[row.status] ?? row.status }))}
        fields={["starts_at", "patient_name", "professional_name", "service_name", "room_name", "status_label"]}
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
        onNotice={(message) => setNotice({ type: message.startsWith("Erro:") ? "error" : "success", message: message.replace(/^Erro:\s*/, "") })}
        onOpen={openCalendarAppointment}
        showToggle={false}
        canEdit={false}
      />
      <section className="card group-allocation-panel" aria-labelledby="group-allocation-title">
          <div className="table-toolbar"><div><p className="eyebrow">ALOCAÇÃO</p><h2 id="group-allocation-title">Alunos por turma</h2><p className="form-instructions">Cada turma possui dias, horário fixo e fisioterapeuta próprios.</p></div>{canManageGroups && <button type="button" className="btn secondary" onClick={onOpenPatients}>Cadastrar paciente</button>}</div>
        <div className="group-allocation-grid">
          {(data["/group-slots"] ?? []).filter((group: Row) => group.active !== false).map((group: Row) => {
            const members = groupMembers.filter((member) => member.group_slot_id === group.id);
            return <article className="group-allocation-card" key={group.id}>
              <div><strong>{group.name}</strong><span>{weekdaysLabel(group.weekdays)} · {String(group.starts_at).slice(0, 5)} · {members.length}/{group.capacity ?? 7} vagas ocupadas</span></div>
              <div className="group-members-heading"><h3>Pacientes inscritos</h3><span>{members.length === 0 ? "Nenhum paciente nesta turma" : `${members.length} inscrito(s)`}</span></div>
              <ul aria-label={`Pacientes inscritos na turma ${group.name}`}>{members.map((member) => <li key={member.id}><span>{member.patients?.name ?? "Paciente"}</span>{canManageGroups && <button type="button" onClick={() => void removeGroupMember(member.id)} aria-label={`Remover ${member.patients?.name ?? "paciente"} da turma`}>Remover</button>}</li>)}</ul>
            </article>;
          })}
        </div>
      </section>
      <EditableOperationalTable
        title="Turmas em horários fixos"
        resource="group-slots"
        rows={(data["/group-slots"] ?? []).map((row: Row) => {
          const members = groupMembers.filter((member: Row) => member.group_slot_id === row.id);
          return {
            ...row,
            weekdays_label: weekdaysLabel(row.weekdays),
            allocation: `${members.length}/${row.capacity ?? 7} · ${members.map((member: Row) => member.patients?.name).filter(Boolean).join(", ") || "Sem alunos"}`,
          };
        })}
        fields={["name", "weekdays_label", "starts_at", "duration_minutes", "capacity", "allocation", "active"]}
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
        onNotice={(message) => setNotice({ type: message.startsWith("Erro:") ? "error" : "success", message: message.replace(/^Erro:\s*/, "") })}
        onOpen={(row) => setSelectedGroupCell({ slot: row, day: new Date(), unitName: units.find((unit) => unit.id === row.unit_id)?.name ?? "Unidade" })}
        canEdit={false}
      />
    </div>
  );
}
