import { FormEvent, type CSSProperties, type FormEventHandler, type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { api } from "./api";
import { supabase } from "./supabase";

type Row = Record<string, any>;
type Unit = { id: string; name: string };
type WorkbookSheet = { name: string; entity: string; rows: Row[] };
const workbookEntityOptions = [
  ["units", "Unidades"], ["rooms", "Salas"], ["professionals", "Profissionais"], ["services", "Serviços"],
  ["plans", "Planos"], ["patients", "Pacientes"], ["enrollments", "Matrículas"], ["appointments", "Agendamentos"],
  ["group_slots", "Turmas"], ["charges", "Cobranças"], ["payments", "Pagamentos"],
  ["financial_entries", "Lançamentos financeiros"], ["commissions", "Comissões"], ["clinical_records", "Prontuários"], ["record_templates", "Modelos clínicos"],
] as const;

const PLAN_PERIODS = {
  monthly: { label: "Mensal", months: 1, durationDays: 30 },
  quarterly: { label: "Trimestral", months: 3, durationDays: 90 },
  semiannual: { label: "Semestral", months: 6, durationDays: 180 },
} as const;

type PlanPeriod = keyof typeof PLAN_PERIODS;
type WeeklyFrequency = 1 | 2 | 3;
const WEEKDAYS = [
  { value: 1, label: "Segunda-feira", short: "Segunda" },
  { value: 2, label: "Terça-feira", short: "Terça" },
  { value: 3, label: "Quarta-feira", short: "Quarta" },
  { value: 4, label: "Quinta-feira", short: "Quinta" },
  { value: 5, label: "Sexta-feira", short: "Sexta" },
  { value: 6, label: "Sábado", short: "Sábado" },
  { value: 0, label: "Domingo", short: "Domingo" },
] as const;

function messageOf(error: unknown) {
  const message = error instanceof Error
    ? error.message
    : "Não foi possível concluir a operação.";
  return `Erro: ${message}`;
}

function value(form: FormData, name: string) {
  return String(form.get(name) ?? "").trim();
}

function cents(raw: string) {
  return Math.round(Number(raw.replace(",", ".")) * 100);
}

function brl(amountCents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amountCents / 100);
}

function isoLocal(raw: string) {
  return new Date(raw).toISOString();
}

function localDateTime(raw: string) {
  const date = new Date(raw);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function dateKey(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })
    .format(date)
    .replace(".", "");
}

const resourceCache = new Map<string, Record<string, any>>();

function useResources(paths: string[]) {
  const key = paths.join("|");
  const selectedUnit = typeof window === "undefined" ? "" : window.localStorage.getItem("fisiofit:selected-unit") ?? "";
  const cacheKey = `${selectedUnit}:${key}`;
  const [data, setData] = useState<Record<string, any>>(() => resourceCache.get(cacheKey) ?? {});
  const [loading, setLoading] = useState(() => !resourceCache.has(cacheKey));
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all(paths.map((path) => api<any>(path)));
      const nextData = Object.fromEntries(
          paths.map((path, index) => [path, responses[index].data]),
        );
      resourceCache.set(cacheKey, nextData);
      setData(nextData);
    } catch (loadError) {
      setError(messageOf(loadError));
    } finally {
      setLoading(false);
    }
  }, [cacheKey, key]);
  useEffect(() => {
    void reload();
    const onUnitChanged = () => void reload();
    window.addEventListener("fisiofit:unit-changed", onUnitChanged);
    return () => window.removeEventListener("fisiofit:unit-changed", onUnitChanged);
  }, [reload]);
  return { data, loading, error, reload };
}

function Select({
  name,
  rows,
  label,
  required = true,
  defaultValue,
}: {
  name: string;
  rows: Row[];
  label: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label>
      {label}
      <select name={name} required={required} defaultValue={defaultValue ?? ""}>
        <option value="">Selecione</option>
        {rows.map((row) => (
          <option key={row.id} value={row.id}>
            {row.name ?? row.description}
          </option>
        ))}
      </select>
    </label>
  );
}

function PatientPicker({
  name = "patient_id",
  rows,
  label,
  required = true,
  defaultValue = "",
  defaultLabel = "",
  onSelect,
}: {
  name?: string;
  rows: Row[];
  label: string;
  required?: boolean;
  defaultValue?: string;
  defaultLabel?: string;
  onSelect?: (patient: Row) => void;
}) {
  const [query, setQuery] = useState(defaultLabel);
  const [selectedId, setSelectedId] = useState(defaultValue);
  const [options, setOptions] = useState<Row[]>(rows);
  const [open, setOpen] = useState(false);
  useEffect(() => setOptions(rows), [rows]);
  useEffect(() => {
    const search = query.trim();
    if (search.length < 2) return;
    const timer = window.setTimeout(() => {
      void api<{ items: Row[] }>(`/patients?page=1&pageSize=100&search=${encodeURIComponent(search)}`)
        .then((response) => setOptions(response.data?.items ?? []))
        .catch(() => setOptions(rows.filter((row) => String(row.name ?? "").toLocaleLowerCase("pt-BR").includes(search.toLocaleLowerCase("pt-BR")))));
    }, 220);
    return () => window.clearTimeout(timer);
  }, [query, rows]);
  const choose = (patient: Row) => {
    setSelectedId(patient.id);
    setQuery(patient.name ?? "Paciente");
    setOpen(false);
    onSelect?.(patient);
  };
  return <label className="patient-picker">{label}<input type="hidden" name={name} value={selectedId} /><input type="text" value={query} required={required} autoComplete="off" placeholder="Digite nome, telefone ou CPF" role="combobox" aria-expanded={open} aria-controls={`${name}-options`} onFocus={() => setOpen(true)} onChange={(event) => { setQuery(event.target.value); setSelectedId(""); setOpen(true); }} />{open && query.trim().length >= 2 && <div className="patient-picker-options" id={`${name}-options`} role="listbox">{options.length ? options.slice(0, 8).map((patient) => <button type="button" role="option" key={patient.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(patient)}><strong>{patient.name}</strong><small>{patient.phone ?? patient.cpf ?? ""}</small></button>) : <span className="patient-picker-empty">Nenhum paciente encontrado.</span>}</div>}</label>;
}

function DrawerForm({
  title,
  children,
  onSubmit,
  className = "",
  openInitially = false,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onSubmit: FormEventHandler<HTMLFormElement>;
  className?: string;
  openInitially?: boolean;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(openInitially);
  const close = () => {
    setOpen(false);
    onClose?.();
  };
  return (
    <>
      <button className={`card drawer-create-trigger ${className}`} type="button" onClick={() => setOpen(true)}>
        <span aria-hidden="true">＋</span>
        <span><strong>{title}</strong><small>Abrir formulário de cadastro</small></span>
        <span aria-hidden="true">→</span>
      </button>
      {open && (
        <div className="modal-backdrop creation-drawer-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) close();
        }}>
          <section className={`modal creation-drawer ${title.includes("turma") ? "agenda-group-drawer" : title.includes("agendamento") ? "agenda-appointment-drawer" : ""}`} role="dialog" aria-modal="true" aria-label={title}>
            <div className="modal-head">
              <h2>{title}</h2>
              <button type="button" onClick={close} aria-label={`Fechar ${title}`}>×</button>
            </div>
            <form className="modal-form creation-drawer-form" onSubmit={onSubmit}>
              {children}
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function ModuleState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: string;
  retry?: () => void | Promise<void>;
}) {
  if (loading)
    return (
      <div className="card module-skeleton" role="status" aria-live="polite">
        <span className="sr-only">Carregando dados do módulo…</span>
        <div className="skeleton-line skeleton-title" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-short" />
      </div>
    );
  if (error)
    return (
      <div className="system-message error-message" role="alert">
        <span className="message-icon" aria-hidden="true">!</span>
        <div>
          <strong>Não foi possível carregar os dados</strong>
          <p>{error}</p>
        </div>
        {retry && <button className="btn secondary" type="button" onClick={() => void retry()}>Tentar novamente</button>}
      </div>
    );
  return null;
}

export type AgendaEnrollmentContext = { unitId: string; groupSlotId: string; startsAt: string; unitName?: string; groupName?: string };

export function OperationalAgenda({ onOpenPatients, onOpenEnrollment }: { onOpenPatients?: () => void; onOpenEnrollment?: (context: AgendaEnrollmentContext) => void }) {
  const [fromDate, setFromDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [rangeDays, setRangeDays] = useState(7);
  const range = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    const end = new Date(start);
    end.setDate(end.getDate() + rangeDays);
    return { from: start.toISOString(), to: end.toISOString() };
  }, [fromDate, rangeDays]);
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
  const [selectedGroupWeekdays, setSelectedGroupWeekdays] = useState<number[]>([1, 3]);
  const [groupTime, setGroupTime] = useState("09:00");
  useEffect(() => {
    void api<Row[]>("/group-slot-memberships")
      .then((response) => setGroupMembers(response.data ?? []))
      .catch(() => setGroupMembers([]));
  }, [data["/group-slots"]]);

  const selectedDayNames = selectedGroupWeekdays.map(
    (day) => WEEKDAYS.find((option) => option.value === day)?.short ?? "",
  );
  const groupName = `${selectedDayNames.join(" e ")} às ${groupTime}`;
  const calendarDays = useMemo(() => {
    const start = new Date(`${fromDate}T00:00:00`);
    return Array.from({ length: rangeDays }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [fromDate, rangeDays]);
  const fixedSlots: Row[] = data["/group-slots"] ?? [];
  const units: Unit[] = data["/units"] ?? [];
  const calendarHours = Array.from({ length: 15 }, (_, index) => index + 6);
  const membersForSlot = (slotId: string, date: Date) => groupMembers.filter((member) => {
    if (member.group_slot_id !== slotId || member.status !== "active") return false;
    const start = String(member.starts_at ?? "").slice(0, 10);
    const end = member.ends_at ? String(member.ends_at).slice(0, 10) : "9999-12-31";
    const current = dateKey(date);
    return current >= start && current <= end;
  });
  const slotFor = (unitId: string, day: Date, hour: number) => fixedSlots.find((slot) =>
    slot.unit_id === unitId
      && Number(String(slot.starts_at).slice(0, 2)) === hour
      && (slot.weekdays ?? []).includes(day.getDay())
      && slot.active !== false,
  );

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

  const openCalendarSlot = (day: Date, hour: number, unitId: string) => {
    const appointment = appointments.find((row) => {
      const starts = new Date(row.starts_at);
      return row.unit_id === unitId && dateKey(starts) === dateKey(day) && starts.getHours() === hour;
    });
    if (appointment) setCalendarAppointment(appointment);
    else {
      const start = new Date(day);
      start.setHours(hour, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 50);
      setCalendarAppointment({ unit_id: unitId, starts_at: start.toISOString(), ends_at: end.toISOString(), status: "scheduled" });
    }
  };

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!selectedGroupWeekdays.length) {
      setNotice("Escolha pelo menos um dia da semana para a turma.");
      return;
    }
    try {
      await api("/group-slots", {
        method: "POST",
        body: JSON.stringify({
          unit_id: value(form, "unit_id"),
          room_id: value(form, "room_id"),
          professional_id: value(form, "professional_id"),
          service_id: value(form, "service_id"),
          name: groupName,
          weekdays: selectedGroupWeekdays,
          starts_at: groupTime,
          duration_minutes: Number(value(form, "duration_minutes")),
          capacity: 7,
        }),
      });
      (event.target as HTMLFormElement).reset();
      setSelectedGroupWeekdays([1, 3]);
      setGroupTime("09:00");
      setNotice(`${groupName} criada com capacidade para 7 alunos.`);
      await reload();
    } catch (actionError) {
      setNotice(messageOf(actionError));
    }
  }

  async function generateGroup(groupId: string) {
    try {
      const start = new Date(`${fromDate}T00:00:00`);
      const end = new Date(start);
      end.setDate(end.getDate() + rangeDays - 1);
      await api(`/group-slots/${groupId}/generate`, { method: "POST", body: JSON.stringify({ from: fromDate, to: end.toISOString().slice(0, 10) }) });
      setNotice("Horários recorrentes gerados para o período selecionado.");
      await reload();
    } catch (actionError) { setNotice(messageOf(actionError)); }
  }

  async function addGroupMember(event: FormEvent<HTMLFormElement>, groupId: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const enrollmentId = value(form, "enrollment_id");
    const enrollment = (data["/enrollments"] ?? []).find((row: Row) => row.id === enrollmentId);
    if (!enrollment) return;
    try {
      await api(`/group-slots/${groupId}/members`, { method: "POST", body: JSON.stringify({ enrollment_id: enrollment.id, patient_id: enrollment.patient_id, starts_at: value(form, "starts_at") }) });
      event.currentTarget.reset();
      setNotice("Paciente alocado na turma.");
      await reload();
    } catch (actionError) { setNotice(messageOf(actionError)); }
  }

  async function removeGroupMember(id: string) {
    try { await api(`/group-slot-memberships/${id}`, { method: "DELETE" }); setNotice("Paciente removido da turma."); await reload(); }
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
        <label>
          Período da agenda
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
          <select value={rangeDays} onChange={(event) => setRangeDays(Number(event.target.value))} aria-label="Quantidade de dias exibidos">
            <option value={7}>7 dias</option><option value={14}>14 dias</option><option value={30}>30 dias</option>
          </select>
          <div className="agenda-range-actions">
            <button type="button" className="btn secondary" onClick={() => { const date = new Date(`${fromDate}T00:00:00`); date.setDate(date.getDate() - rangeDays); setFromDate(date.toISOString().slice(0, 10)); }}>← Anterior</button>
            <button type="button" className="btn secondary" onClick={() => setFromDate(new Date().toISOString().slice(0, 10))}>Hoje</button>
            <button type="button" className="btn secondary" onClick={() => { const date = new Date(`${fromDate}T00:00:00`); date.setDate(date.getDate() + rangeDays); setFromDate(date.toISOString().slice(0, 10)); }}>Próximo →</button>
          </div>
        </label>
      </div>
      {notice && (
        <div className="toast" role="status" aria-live="polite">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <section className="card fixed-calendar" aria-label="Calendário semanal de horários fixos">
        <div className="table-toolbar fixed-calendar-toolbar">
          <div><p className="eyebrow">CALENDÁRIO FIXO</p><h2>Horários por unidade</h2></div>
          <span>{rangeDays} dias · 06:00–20:00 · segunda a sexta</span>
        </div>
        {units.map((unit) => (
          <div className="fixed-calendar-unit" key={unit.id}>
            <div className="fixed-calendar-unit-head"><h3>{unit.name}</h3><span>{fixedSlots.filter((slot) => slot.unit_id === unit.id).length} horários fixos</span></div>
            <div className="fixed-calendar-scroll">
              <div className="fixed-calendar-grid" style={{ "--calendar-days": Math.max(calendarDays.length, 1) } as CSSProperties}>
                <div className="fixed-calendar-corner">Hora</div>
                {calendarDays.map((day) => <div className="fixed-calendar-day-head" key={dateKey(day)}>{dateLabel(day)}</div>)}
                {calendarHours.flatMap((hour) => [
                  <div className="fixed-calendar-hour" key={`hour-${hour}`}>{String(hour).padStart(2, "0")}:00</div>,
                  ...calendarDays.map((day) => {
                    const slot = slotFor(unit.id, day, hour);
                    const members = slot ? membersForSlot(slot.id, day) : [];
                    const isWeekday = day.getDay() >= 1 && day.getDay() <= 5;
                    const appointment = appointments.find((row) => {
                      const starts = new Date(row.starts_at);
                      return row.unit_id === unit.id && dateKey(starts) === dateKey(day) && starts.getHours() === hour;
                    });
                    return <button type="button" className={`fixed-calendar-cell calendar-slot-button${!isWeekday ? " is-weekend" : ""}`} key={`${dateLabel(day)}-${hour}`} onClick={() => { if (slot && !appointment && onOpenEnrollment) onOpenEnrollment({ unitId: unit.id, groupSlotId: slot.id, startsAt: dateKey(day), unitName: unit.name, groupName: slot.name }); else openCalendarSlot(day, hour, unit.id); }} aria-label={`${dateLabel(day)} às ${String(hour).padStart(2, "0")}:00${slot && !appointment ? ", adicionar paciente e criar matrícula" : appointment ? `, ${appointment.patients?.name ?? "agendamento"}` : ", horário livre"}`}>
                      {appointment ? <><strong className="calendar-appointment-name">{appointment.patients?.name ?? "Bloqueio"}</strong><span>{appointment.services?.name ?? "Atendimento"}</span><small>{appointment.status ?? "Agendado"} · editar</small></> : <>
                      {slot ? <>
                        <strong>{members.length}/{slot.capacity ?? 7} vagas</strong>
                        {members.slice(0, 3).map((member) => <span key={member.id}>{member.patients?.name ?? "Paciente"}</span>)}
                        {members.length > 3 && <small>+{members.length - 3} pacientes</small>}
                        {!members.length && <small>Horário livre</small>}
                      </> : isWeekday ? <small className="fixed-calendar-missing">Não configurado</small> : null}</>}
                    </button>;
                  }),
                ])}
              </div>
            </div>
          </div>
        ))}
        {!units.length && <p className="empty-state">Cadastre uma unidade para visualizar a agenda.</p>}
      </section>
      {calendarAppointment !== undefined && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCalendarAppointment(undefined); }}>
          <section className="modal calendar-edit-modal" role="dialog" aria-modal="true" aria-labelledby="calendar-edit-title">
            <div className="modal-head"><div><p className="eyebrow">AGENDA</p><h2 id="calendar-edit-title">{calendarAppointment?.id ? "Editar agendamento" : "Novo agendamento"}</h2></div><button type="button" onClick={() => setCalendarAppointment(undefined)} aria-label="Fechar">×</button></div>
            <form className="modal-form" onSubmit={saveCalendarAppointment}>
              <div className="form-row"><Select name="unit_id" label="Unidade" rows={units} defaultValue={calendarAppointment?.unit_id} /><PatientPicker label="Paciente" rows={patients} required={false} defaultValue={calendarAppointment?.patient_id} defaultLabel={calendarAppointment?.patients?.name} /></div>
              <div className="form-row"><Select name="professional_id" label="Profissional" rows={data["/professionals"] ?? []} /><Select name="service_id" label="Serviço" rows={data["/services"] ?? []} required={false} /></div>
              <div className="form-row"><label>Início<input name="starts_at" type="datetime-local" defaultValue={calendarAppointment?.starts_at ? localDateTime(calendarAppointment.starts_at) : ""} required /></label><label>Término<input name="ends_at" type="datetime-local" defaultValue={calendarAppointment?.ends_at ? localDateTime(calendarAppointment.ends_at) : ""} required /></label></div>
              <div className="form-row"><label>Status<select name="status" defaultValue={calendarAppointment?.status ?? "scheduled"}><option value="scheduled">Agendado</option><option value="confirmed">Confirmado</option><option value="attending">Em atendimento</option><option value="missed">Falta</option><option value="cancelled">Cancelado</option></select></label><label>Observações<textarea name="notes" defaultValue={calendarAppointment?.notes ?? ""} rows={2} /></label></div>
              <div className="modal-actions"><button type="button" className="btn secondary" onClick={() => setCalendarAppointment(undefined)}>Cancelar</button><button className="btn primary">Salvar alterações</button></div>
            </form>
          </section>
        </div>
      )}
      <div className="dashboard-grid">
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
              <label>
                Início *
                <input name="starts_at" type="datetime-local" required />
              </label>
            </div>
            <div className="form-row">
              <label>
                Término *
                <input name="ends_at" type="datetime-local" required />
              </label>
              <label>
                Observações
                <input name="notes" />
              </label>
            </div>
          </fieldset>
          <button className="btn primary">Agendar</button>
        </DrawerForm>
        <DrawerForm title="Nova turma com horário fixo" onSubmit={createGroup}>
          <h2>Nova turma com horário fixo</h2>
          <p className="form-instructions"><span aria-hidden="true">*</span> indica campo obrigatório.</p>
          <fieldset>
            <legend>Local e atendimento</legend>
            <div className="form-row">
              <Select
                name="unit_id"
                label="Unidade *"
                rows={data["/units"] ?? []}
              />
              <Select name="room_id" label="Sala *" rows={data["/rooms"] ?? []} />
            </div>
            <div className="form-row">
              <Select
                name="professional_id"
                label="Profissional *"
                rows={data["/professionals"] ?? []}
              />
              <Select
                name="service_id"
                label="Serviço *"
                rows={data["/services"] ?? []}
              />
            </div>
          </fieldset>
          <fieldset>
            <legend>Frequência e horário</legend>
            <div className="form-row">
              <label>
                Dias por semana
                <strong className="field-hint">{selectedGroupWeekdays.length} selecionado(s)</strong>
              </label>
              <label>
                Horário fixo *
                <input name="starts_at" type="time" value={groupTime} onChange={(event) => setGroupTime(event.target.value)} required />
              </label>
            </div>
            <div className="weekday-picker" aria-label="Dias da semana da turma">
              {WEEKDAYS.map((day) => (
                <label className="weekday-option" key={day.value}>
                  <input
                    type="checkbox"
                    checked={selectedGroupWeekdays.includes(day.value)}
                    onChange={() => setSelectedGroupWeekdays((current) => current.includes(day.value)
                      ? current.filter((value) => value !== day.value)
                      : [...current, day.value])}
                  />
                  <span>{day.short}</span>
                </label>
              ))}
            </div>
            <label>
              Duração de cada aula (minutos) *
              <input name="duration_minutes" type="number" min="15" max="240" defaultValue="50" required />
            </label>
          </fieldset>
          <div className="plan-summary" aria-live="polite">
            <strong>{groupName}</strong>
            <span>Horário fixo recorrente · até 7 alunos · de 1 a 7 dias por semana</span>
          </div>
          <button className="btn primary">Criar turma (7 vagas)</button>
        </DrawerForm>
      </div>
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
      />
      <section className="card group-allocation-panel" aria-labelledby="group-allocation-title">
        <div className="table-toolbar"><div><p className="eyebrow">ALOCAÇÃO</p><h2 id="group-allocation-title">Alunos nas turmas</h2><p className="form-instructions">Cadastre o paciente e faça a matrícula antes de adicionar uma vaga na turma.</p></div><button type="button" className="btn secondary" onClick={onOpenPatients}>Cadastrar paciente</button></div>
        <div className="group-allocation-grid">
          {(data["/group-slots"] ?? []).map((group: Row) => {
            const members = groupMembers.filter((member) => member.group_slot_id === group.id);
            const available = (data["/enrollments"] ?? []).filter((enrollment: Row) => !members.some((member) => member.enrollment_id === enrollment.id));
            return <article className="group-allocation-card" key={group.id}>
              <div><strong>{group.name}</strong><span>{members.length}/{group.capacity ?? 7} vagas ocupadas · {String(group.starts_at).slice(0, 5)}</span></div>
              <button type="button" className="btn secondary" onClick={() => void generateGroup(group.id)}>Gerar horários</button>
              <div className="group-members-heading"><h3>Pacientes inscritos</h3><span>{members.length === 0 ? "Nenhum paciente nesta turma" : `${members.length} inscrito(s)`}</span></div>
              <ul aria-label={`Pacientes inscritos na turma ${group.name}`}>{members.map((member) => <li key={member.id}><span>{member.patients?.name ?? "Paciente"}</span><button type="button" onClick={() => void removeGroupMember(member.id)} aria-label={`Remover ${member.patients?.name ?? "paciente"} da turma`}>Remover</button></li>)}</ul>
              <form className="group-member-form" onSubmit={(event) => void addGroupMember(event, group.id)} aria-label={`Adicionar paciente à turma ${group.name}`}><fieldset><legend>Adicionar paciente</legend><label>Matrícula<select name="enrollment_id" required aria-describedby={`group-help-${group.id}`}><option value="">Selecione uma matrícula</option>{available.map((enrollment: Row) => <option key={enrollment.id} value={enrollment.id}>{enrollment.patients?.name ?? enrollment.patient_id}</option>)}</select></label><label>Início<input name="starts_at" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></label><button className="btn primary">Adicionar à turma</button><small id={`group-help-${group.id}`}>{available.length ? "Apenas matrículas ainda não vinculadas aparecem aqui." : "Não há matrículas disponíveis. Cadastre e matricule o paciente primeiro."}</small></fieldset></form>
            </article>;
          })}
        </div>
      </section>
      <EditableOperationalTable
        title="Turmas fixas"
        resource="group-slots"
        rows={(data["/group-slots"] ?? []).map((row: Row) => {
          const members = groupMembers.filter((member: Row) => member.group_slot_id === row.id);
          return {
            ...row,
            allocation: `${members.length}/${row.capacity ?? 7} · ${members.map((member: Row) => member.patients?.name).filter(Boolean).join(", ") || "Sem alunos"}`,
          };
        })}
        fields={["name", "starts_at", "duration_minutes", "capacity", "allocation", "active"]}
        editFields={[
          { name: "unit_id", label: "Unidade", type: "select", required: true, options: data["/units"] ?? [] },
          { name: "room_id", label: "Sala", type: "select", required: true, options: data["/rooms"] ?? [] },
          { name: "professional_id", label: "Profissional", type: "select", required: true, options: data["/professionals"] ?? [] },
          { name: "service_id", label: "Serviço", type: "select", required: true, options: data["/services"] ?? [] },
          { name: "name", label: "Nome", required: true },
          { name: "weekdays", label: "Dias da semana (0 domingo; 1 segunda...6 sábado)", required: true, value: (row) => (row.weekdays ?? []).join(",") },
          { name: "starts_at", label: "Horário", required: true },
          { name: "duration_minutes", label: "Duração (min)", type: "number", min: 15, max: 240, required: true },
          { name: "capacity", label: "Capacidade", type: "number", min: 1, max: 7, required: true },
          { name: "active", label: "Situação", type: "select", required: true, options: [{ id: "true", name: "Ativa" }, { id: "false", name: "Inativa" }] },
        ]}
        buildBody={(form) => ({
          name: value(form, "name"),
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
      />
    </div>
  );
}

export function OperationalPatients() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const pageSize = 20;
  const patientPath = `/patients?page=${page}&pageSize=${pageSize}${appliedSearch ? `&search=${encodeURIComponent(appliedSearch)}` : ""}`;
  const paths = [patientPath, "/units"];
  const { data, loading, error, reload } = useResources(paths);
  const patients: Row[] = data[patientPath]?.items ?? [];
  const total = Number(data[patientPath]?.total ?? 0);
  const [selected, setSelected] = useState<Row | null>(null);
  const [detail, setDetail] = useState<{
    responsibles: Row[];
    consents: Row[];
    timeline?: Row;
  }>({ responsibles: [], consents: [] });
  const [notice, setNotice] = useState("");
  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setAppliedSearch(search.trim());
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const address = {
      street: value(f, "street"),
      number: value(f, "number"),
      city: value(f, "city"),
      state: value(f, "state"),
      zip: value(f, "zip"),
    };
    try {
      await api("/patients", {
        method: "POST",
        body: JSON.stringify({
          primary_unit_id: value(f, "primary_unit_id"),
          name: value(f, "name"),
          cpf: value(f, "cpf") || undefined,
          birth_date: value(f, "birth_date") || undefined,
          phone: value(f, "phone") || undefined,
          email: value(f, "email") || undefined,
          address,
          tax_data: {
            fiscal_name: value(f, "fiscal_name"),
            document: value(f, "fiscal_document"),
          },
          notes: value(f, "notes") || undefined,
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Paciente cadastrado.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function open(row: Row) {
    setSelected(row);
    try {
      const [responsibles, consents, timeline] = await Promise.all([
        api<Row[]>(`/patients/${row.id}/responsibles`),
        api<Row[]>(`/patients/${row.id}/consents`),
        api<Row>(`/patients/${row.id}/timeline`),
      ]);
      setDetail({
        responsibles: responsibles.data ?? [],
        consents: consents.data ?? [],
        timeline: timeline.data ?? undefined,
      });
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function responsible(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selected) return;
    const f = new FormData(event.currentTarget);
    try {
      await api(`/patients/${selected.id}/responsibles`, {
        method: "POST",
        body: JSON.stringify({
          name: value(f, "name"),
          relationship: value(f, "relationship"),
          cpf: value(f, "cpf") || undefined,
          phone: value(f, "phone") || undefined,
          email: value(f, "email") || undefined,
        }),
      });
      (event.target as HTMLFormElement).reset();
      await open(selected);
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function consent(kind: string, granted: boolean) {
    if (!selected) return;
    const purposes: Record<string, string> = {
      whatsapp: "Contato operacional pelo WhatsApp",
      data_processing: "Registro de ciência sobre o tratamento de dados",
    };
    try {
      await api(`/patients/${selected.id}/consents`, {
        method: "POST",
        body: JSON.stringify({
          kind,
          granted,
          purpose: purposes[kind] ?? kind,
          legal_basis:
            kind === "whatsapp" ? "consent" : "healthcare_and_legal_obligation",
          notice_version: "1.0",
          source: "portal",
        }),
      });
      await open(selected);
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">CADASTRO COMPLETO</p>
          <h1>Pacientes</h1>
          <p>
            Dados pessoais, fiscais, responsável, consentimentos e linha do
            tempo.
          </p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <form className="card patient-search" role="search" onSubmit={submitSearch}>
        <label htmlFor="patient-search-input">Buscar pacientes</label>
        <div>
          <input id="patient-search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome, telefone ou CPF" />
          <button className="btn primary">Buscar</button>
          {appliedSearch && <button type="button" className="btn secondary" onClick={() => { setSearch(""); setAppliedSearch(""); setPage(1); }}>Limpar</button>}
        </div>
      </form>
      <DrawerForm title="Novo paciente" onSubmit={create}>
        <h2>Novo paciente</h2>
        <p className="form-instructions"><span aria-hidden="true">*</span> indica campo obrigatório.</p>
        <fieldset>
          <legend>Identificação e contato</legend>
          <div className="form-row">
            <label>Nome completo<input name="name" autoComplete="name" required /></label>
            <Select name="primary_unit_id" label="Unidade principal" rows={data["/units"] ?? []} />
          </div>
          <div className="form-row">
            <label>CPF<input name="cpf" /></label>
            <label>Nascimento<input name="birth_date" type="date" autoComplete="bday" /></label>
          </div>
          <div className="form-row">
            <label>Telefone<input name="phone" type="tel" /></label>
            <label>E-mail<input name="email" type="email" /></label>
          </div>
        </fieldset>
        <fieldset>
          <legend>Endereço</legend>
          <div className="form-row">
            <label>Rua<input name="street" /></label>
            <label>Número<input name="number" /></label>
          </div>
          <div className="form-row">
            <label>Cidade<input name="city" /></label>
            <label>Estado<input name="state" maxLength={2} /></label>
          </div>
          <label>CEP<input name="zip" /></label>
        </fieldset>
        <fieldset>
          <legend>Dados fiscais</legend>
          <div className="form-row">
            <label>Nome fiscal<input name="fiscal_name" /></label>
            <label>Documento fiscal<input name="fiscal_document" /></label>
          </div>
        </fieldset>
        <label>
          Observações
          <textarea name="notes" rows={3} />
        </label>
        <button className="btn primary">Cadastrar paciente</button>
      </DrawerForm>
      <EditableOperationalTable
        title="Pacientes cadastrados"
        resource="patients"
        rows={patients}
        fields={["name", "phone", "email", "active"]}
        editFields={[
          { name: "name", label: "Nome completo", required: true },
          { name: "primary_unit_id", label: "Unidade principal", type: "select", required: true, options: data["/units"] ?? [] },
          { name: "cpf", label: "CPF" },
          { name: "birth_date", label: "Nascimento", type: "date" },
          { name: "phone", label: "Telefone", type: "tel" },
          { name: "email", label: "E-mail", type: "email" },
          { name: "street", label: "Rua", value: (row) => row.address?.street },
          { name: "number", label: "Número", value: (row) => row.address?.number },
          { name: "city", label: "Cidade", value: (row) => row.address?.city },
          { name: "state", label: "Estado", value: (row) => row.address?.state, maxLength: 2 },
          { name: "zip", label: "CEP", value: (row) => row.address?.zip },
          { name: "fiscal_name", label: "Nome fiscal", value: (row) => row.tax_data?.fiscal_name },
          { name: "fiscal_document", label: "Documento fiscal", value: (row) => row.tax_data?.document },
          { name: "notes", label: "Observações", type: "textarea" },
        ]}
        buildBody={(form) => ({
          primary_unit_id: value(form, "primary_unit_id"),
          name: value(form, "name"),
          cpf: value(form, "cpf") || undefined,
          birth_date: value(form, "birth_date") || undefined,
          phone: value(form, "phone") || undefined,
          email: value(form, "email") || undefined,
          address: {
            street: value(form, "street"), number: value(form, "number"),
            city: value(form, "city"), state: value(form, "state"), zip: value(form, "zip"),
          },
          tax_data: { fiscal_name: value(form, "fiscal_name"), document: value(form, "fiscal_document") },
          notes: value(form, "notes") || undefined,
        })}
        onChanged={reload}
        onNotice={setNotice}
        onOpen={open}
        allowDelete
        total={total}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
      />
      {selected && (
        <div className="modal-backdrop" onClick={() => setSelected(null)}>
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="patient-dialog-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <div>
                <p className="eyebrow">PACIENTE</p>
                <h2 id="patient-dialog-title">{selected.name}</h2>
                <p>{selected.cpf ?? "CPF não informado"}</p>
              </div>
              <button type="button" aria-label="Fechar detalhes do paciente" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="modal-form">
              <h3>Consentimentos</h3>
              <div className="row-actions">
                <button onClick={() => consent("whatsapp", true)}>
                  Autorizar contato
                </button>
                <button onClick={() => consent("whatsapp", false)}>
                  Revogar contato
                </button>
                <button onClick={() => consent("data_processing", true)}>
                  Autorizar tratamento de dados
                </button>
              </div>
              <p>{detail.consents.length} registros de consentimento.</p>
              <form onSubmit={responsible}>
                <h3>Adicionar responsável</h3>
                <div className="form-row">
                  <label>
                    Nome
                    <input name="name" required />
                  </label>
                  <label>
                    Relação
                    <input name="relationship" />
                  </label>
                </div>
                <div className="form-row">
                  <label>
                    CPF
                    <input name="cpf" />
                  </label>
                  <label>
                    Telefone
                    <input name="phone" />
                  </label>
                </div>
                <label>
                  E-mail
                  <input name="email" type="email" />
                </label>
                <button className="btn primary">Salvar responsável</button>
              </form>
              <h3>Linha do tempo</h3>
              <p>
                {detail.timeline?.appointments?.length ?? 0} atendimentos ·{" "}
                {detail.timeline?.records?.length ?? 0} registros clínicos ·{" "}
                {detail.timeline?.charges?.length ?? 0} cobranças
              </p>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

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
        body: JSON.stringify({ patient_id: patientId, plan_id: planId, unit_id: value(form, "unit_id"), starts_at: value(form, "starts_at"), due_day: Number(value(form, "due_day")), discount_cents: cents(value(form, "discount") || "0"), surcharge_cents: 0 }),
      });
      const group = value(form, "group_slot_id");
      if (group && response.data)
        await api(`/group-slots/${group}/members`, {
          method: "POST",
          body: JSON.stringify({ enrollment_id: response.data.id, patient_id: patientId, starts_at: value(form, "starts_at") }),
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
    const planPrice = Number(plan?.price_cents ?? 0);
    const discount = Number(row.discount_cents ?? 0);
    const surcharge = Number(row.surcharge_cents ?? 0);
    return {
      ...row,
      total_plan_cents: Math.max(planPrice - discount + surcharge, 0),
    };
  });
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
            <label>
              Período
              <select
                name="period"
                value={planPeriod}
                onChange={(event) => setPlanPeriod(event.target.value as PlanPeriod)}
              >
                <option value="monthly">Mensal</option>
                <option value="quarterly">Trimestral</option>
                <option value="semiannual">Semestral</option>
              </select>
            </label>
            <label>
              Frequência
              <select
                name="weekly_frequency"
                value={weeklyFrequency}
                onChange={(event) => setWeeklyFrequency(Number(event.target.value) as WeeklyFrequency)}
              >
                <option value="1">1x por semana</option>
                <option value="2">2x por semana</option>
                <option value="3">3x por semana</option>
              </select>
            </label>
          </div>
          <div className="plan-summary" aria-live="polite">
            <strong>{planName}</strong>
            <span>{planSessions} sessões durante {selectedPeriod.months} {selectedPeriod.months === 1 ? "mês" : "meses"}</span>
          </div>
          <label>
            Preço do plano
            <input name="price" type="number" min="0" step=".01" inputMode="decimal" required />
          </label>
          <button className="btn primary">Criar plano</button>
        </DrawerForm>
        <DrawerForm title="Nova matrícula" onSubmit={enroll} openInitially={openEnrollment || Boolean(agendaContext)} onClose={onClearAgendaContext}>
          <h2>Nova matrícula</h2>
          <div className="form-row">
            <PatientPicker key={patientPickerVersion} name="patient_id" label="Paciente" rows={patients} onSelect={setSelectedPatient} />
            <Select name="plan_id" label="Plano" rows={data["/plans"] ?? []} />
          </div>
          {selectedPatient && <div className="agenda-context-summary" role="status"><strong>Paciente selecionado</strong><span>{selectedPatient.name}{selectedPatient.phone ? ` · ${selectedPatient.phone}` : ""}{selectedPatient.cpf ? ` · CPF ${selectedPatient.cpf}` : ""}</span></div>}
          {agendaContext ? <div className="agenda-context-summary" role="status"><input type="hidden" name="unit_id" value={agendaContext.unitId} /><input type="hidden" name="group_slot_id" value={agendaContext.groupSlotId} /><strong>{agendaContext.groupName ?? "Turma selecionada"}</strong><span>{agendaContext.unitName ?? "Unidade selecionada"} · horário escolhido na Agenda · {agendaContext.startsAt}</span><button type="button" onClick={onClearAgendaContext}>Trocar horário</button></div> : <div className="form-row"><Select name="unit_id" label="Unidade" rows={data["/units"] ?? []} /><Select name="group_slot_id" label="Turma (opcional)" rows={data["/group-slots"] ?? []} required={false} /></div>}
          <div className="form-row">
            <label>
              Início
              <input name="starts_at" type="date" defaultValue={agendaContext?.startsAt} readOnly={Boolean(agendaContext)} required />
            </label>
            <label>
              Dia do vencimento
              <input name="due_day" type="number" min="1" max="31" required />
            </label>
          </div>
          <label>
            Desconto
            <input name="discount" type="number" step=".01" defaultValue="0" />
          </label>
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
        <label>
          Valor
          <input name="amount" type="number" step=".01" required />
        </label>
        <label>
          Forma
          <select name="method">
            <option value="pix">PIX</option>
            <option value="card">Cartão</option>
            <option value="cash">Dinheiro</option>
            <option value="transfer">Transferência</option>
          </select>
        </label>
        <button className="btn primary">Receber</button>
      </form>
      <EditableOperationalTable
        title="Planos"
        resource="plans"
        rows={data["/plans"] ?? []}
        fields={["name", "kind", "sessions_included", "duration_days", "price_cents", "active"]}
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
        onChanged={reload}
        onNotice={setNotice}
      />
      <OperationalTable
        title="Matrículas ativas"
        rows={enrollmentRows}
        fields={["status", "starts_at", "due_day", "sessions_used", "total_plan_cents"]}
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

export function OperationalRecords() {
  const basePaths = [
    "/patients?page=1&pageSize=100",
    "/professionals",
    "/units",
    "/record-templates",
  ];
  const { data, loading, error, reload } = useResources(basePaths);
  const patients = data[basePaths[0]]?.items ?? [];
  const [patientId, setPatientId] = useState("");
  const [records, setRecords] = useState<Row[]>([]);
  const [attachments, setAttachments] = useState<Row[]>([]);
  const [notice, setNotice] = useState("");
  const loadRecords = useCallback(async (id: string) => {
    setPatientId(id);
    if (!id) return setRecords([]);
    try {
      const [recordResponse, attachmentResponse] = await Promise.all([
        api<Row[]>(`/clinical-records?patientId=${id}`),
        api<Row[]>(`/attachments?patientId=${id}`),
      ]);
      setRecords(recordResponse.data ?? []);
      setAttachments(attachmentResponse.data ?? []);
    } catch (e) {
      setNotice(messageOf(e));
    }
  }, []);
  async function uploadAttachment(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !patientId) return;
    try {
      const response = await api<Row>("/attachments/upload-url", { method: "POST", body: JSON.stringify({
        patient_id: patientId, entity_type: "patient", entity_id: patientId, filename: file.name,
        content_type: file.type, size_bytes: file.size,
      }) });
      if (!response.data) throw new Error("Não foi possível preparar o upload.");
      const upload = await supabase.storage.from("clinical-files").uploadToSignedUrl(response.data.path, response.data.token, file);
      if (upload.error) throw upload.error;
      await loadRecords(patientId);
      setNotice("Anexo enviado.");
    } catch (e) { setNotice(messageOf(e)); }
    event.target.value = "";
  }
  async function createRecord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/clinical-records", {
        method: "POST",
        body: JSON.stringify({
          patient_id: patientId,
          professional_id: value(form, "professional_id"),
          unit_id: value(form, "unit_id"),
          kind: value(form, "kind"),
          template_id: value(form, "template_id") || undefined,
          payload: {
            text: value(form, "text"),
            measures: value(form, "measures"),
          },
        }),
      });
      (event.target as HTMLFormElement).reset();
      await loadRecords(patientId);
      setNotice("Registro clínico salvo como rascunho.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function sign(id: string) {
    try {
      await api(`/clinical-records/${id}/sign`, {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
      });
      await loadRecords(patientId);
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function rectify(id: string) {
    const reason = window.prompt(
      "Justificativa da retificação (mínimo 10 caracteres):",
    );
    const text = window.prompt("Texto corrigido:");
    if (!reason || !text) return;
    try {
      await api(`/clinical-records/${id}/rectify`, {
        method: "POST",
        body: JSON.stringify({ reason, payload: { text } }),
      });
      await loadRecords(patientId);
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">PRONTUÁRIO ELETRÔNICO</p>
          <h1>Avaliações e evoluções</h1>
          <p>
            Registros assinados são imutáveis; correções geram retificações.
          </p>
        </div>
        <Select name="patient" label="Paciente" rows={patients} />
      </div>
      <label className="card record-selector">
        Paciente
        <select value={patientId} onChange={(e) => loadRecords(e.target.value)}>
          <option value="">Selecione</option>
          {patients.map((row: Row) => (
            <option key={row.id} value={row.id}>
              {row.name}
            </option>
          ))}
        </select>
      </label>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      {patientId && (
        <DrawerForm title="Novo registro" onSubmit={createRecord}>
          <h2>Novo registro</h2>
          <div className="form-row">
            <label>
              Tipo
              <select name="kind">
                <option value="assessment">Avaliação</option>
                <option value="evolution">Evolução</option>
              </select>
            </label>
            <Select
              name="template_id"
              label="Modelo (opcional)"
              rows={data["/record-templates"] ?? []}
              required={false}
            />
          </div>
          <div className="form-row">
            <Select
              name="professional_id"
              label="Profissional"
              rows={data["/professionals"] ?? []}
            />
            <Select
              name="unit_id"
              label="Unidade"
              rows={data["/units"] ?? []}
            />
          </div>
          <label>
            Descrição
            <textarea name="text" rows={6} required />
          </label>
          <label>
            Medidas/escalas
            <textarea name="measures" rows={2} />
          </label>
          <button className="btn primary">Salvar rascunho</button>
        </DrawerForm>
      )}
      {patientId && <section className="card table-card">
        <div className="table-toolbar"><h2>Anexos do paciente</h2><label className="btn secondary">Adicionar arquivo<input className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={uploadAttachment} /></label></div>
        {attachments.map((file) => <div className="operational-row" key={file.id}><div><strong>{file.filename}</strong><small>{file.content_type} · {Math.round(file.size_bytes / 1024)} KB</small></div></div>)}
        {!attachments.length && <div className="empty-state">Nenhum anexo.</div>}
      </section>}
      <section className="card table-card bespoke-table records-list-table">
        <div className="table-toolbar"><h2>Registros clínicos</h2><span>{records.length} registros</span></div>
        <div className="bespoke-table-head" aria-hidden="true"><span>Tipo e status</span><span>Data e conteúdo</span><span>Ações</span></div>
        {records.map((row) => (
          <div className="operational-row" key={row.id}>
            <div>
              <strong>
                {row.kind} · {row.status}
              </strong>
              <small>
                {new Date(row.created_at).toLocaleString("pt-BR")} ·{" "}
                {JSON.stringify(row.payload)}
              </small>
            </div>
            <div className="row-actions">
              {row.status === "draft" && (
                <button onClick={() => sign(row.id)}>Assinar</button>
              )}
              {row.status === "signed" && (
                <button onClick={() => rectify(row.id)}>Retificar</button>
              )}
            </div>
          </div>
        ))}
        {patientId && !records.length && (
          <div className="empty-state">Paciente sem registros clínicos.</div>
        )}
      </section>
    </div>
  );
}

export function OperationalFinance() {
  const today = new Date();
  const first = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(today.getFullYear(), today.getMonth() + 1, 0)
    .toISOString()
    .slice(0, 10);
  const paths = [
    `/financial-entries?from=${first}&to=${last}`,
    "/charges",
    "/payments",
    "/commissions",
    "/professionals",
    "/units",
  ];
  const { data, loading, error, reload } = useResources(paths);
  const [notice, setNotice] = useState("");
  async function entry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api("/financial-entries", {
        method: "POST",
        body: JSON.stringify({
          unit_id: value(f, "unit_id"),
          kind: value(f, "kind"),
          description: value(f, "description"),
          category: value(f, "category"),
          cost_center: value(f, "cost_center") || undefined,
          amount_cents: cents(value(f, "amount")),
          competence_date: value(f, "date"),
          settled_at: f.get("settled") ? new Date().toISOString() : undefined,
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Movimento salvo.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function commission(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api("/commissions", {
        method: "POST",
        body: JSON.stringify({
          unit_id: value(f, "unit_id"),
          professional_id: value(f, "professional_id"),
          amount_cents: cents(value(f, "amount")),
          basis: value(f, "basis"),
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Comissão calculada.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function removeEntry(id: string) {
    if (!window.confirm("Excluir este lançamento? Ele ficará oculto, mas será mantido no histórico.")) return;
    try {
      await api(`/financial-entries/${id}`, { method: "DELETE" });
      await reload();
      setNotice("Lançamento excluído.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function approve(id: string) {
    try {
      await api(`/commissions/${id}/approve`, { method: "POST" });
      await reload();
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  const entries: Row[] = data[paths[0]] ?? [];
  const income = entries
    .filter((x) => x.kind === "income")
    .reduce((s, x) => s + x.amount_cents, 0);
  const expense = entries
    .filter((x) => x.kind === "expense")
    .reduce((s, x) => s + x.amount_cents, 0);
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">FINANCEIRO REAL</p>
          <h1>Entradas, saídas e comissões</h1>
          <p>Regime de competência e realizado por unidade.</p>
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
        <MetricLite label="Receitas do mês" value={brl(income)} />
        <MetricLite label="Despesas do mês" value={brl(expense)} />
        <MetricLite label="Resultado" value={brl(income - expense)} />
        <MetricLite
          label="Comissões"
          value={(data["/commissions"] ?? []).length}
        />
      </div>
      <div className="dashboard-grid">
        <DrawerForm title="Novo movimento" onSubmit={entry}>
          <h2>Novo movimento</h2>
          <div className="form-row">
            <Select
              name="unit_id"
              label="Unidade"
              rows={data["/units"] ?? []}
            />
            <label>
              Tipo
              <select name="kind">
                <option value="income">Entrada</option>
                <option value="expense">Saída</option>
              </select>
            </label>
          </div>
          <label>
            Descrição
            <input name="description" required />
          </label>
          <div className="form-row">
            <label>
              Categoria
              <input name="category" required />
            </label>
            <label>
              Centro de custo
              <input name="cost_center" />
            </label>
          </div>
          <div className="form-row">
            <label>
              Valor
              <input name="amount" type="number" step=".01" required />
            </label>
            <label>
              Competência
              <input
                name="date"
                type="date"
                required
                defaultValue={today.toISOString().slice(0, 10)}
              />
            </label>
          </div>
          <label className="check">
            <input type="checkbox" name="settled" />
            Já realizado
          </label>
          <button className="btn primary">Lançar</button>
        </DrawerForm>
        <DrawerForm title="Nova comissão" onSubmit={commission}>
          <h2>Nova comissão</h2>
          <Select name="unit_id" label="Unidade" rows={data["/units"] ?? []} />
          <Select
            name="professional_id"
            label="Profissional"
            rows={data["/professionals"] ?? []}
          />
          <div className="form-row">
            <label>
              Base
              <select name="basis">
                <option value="appointment">Atendimento</option>
                <option value="payment">Recebimento</option>
              </select>
            </label>
            <label>
              Valor
              <input name="amount" type="number" step=".01" required />
            </label>
          </div>
          <button className="btn primary">Calcular comissão</button>
        </DrawerForm>
      </div>
      <OperationalTable
        title="Movimentos do mês"
        rows={entries}
        fields={[
          "competence_date",
          "description",
          "category",
          "kind",
          "amount_cents",
        ]}
        actions={(row) => <button type="button" onClick={() => void removeEntry(row.id)}>Excluir</button>}
      />
      <section className="card table-card bespoke-table commissions-list-table">
        <div className="table-toolbar">
          <h2>Comissões</h2>
        </div>
        <div className="bespoke-table-head" aria-hidden="true"><span>Valor</span><span>Base e status</span><span>Ações</span></div>
        {(data["/commissions"] ?? []).map((row: Row) => (
          <div className="operational-row" key={row.id}>
            <div>
              <strong>{brl(row.amount_cents)}</strong>
              <small>
                {row.basis} · {row.status}
              </small>
            </div>
            {row.status === "pending" && (
              <button onClick={() => approve(row.id)}>
                Aprovar e lançar despesa
              </button>
            )}
          </div>
        ))}
      </section>
    </div>
  );
}

export function OperationalReports() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState<Row | null>(null);
  const [error, setError] = useState("");
  async function load() {
    try {
      setReport((await api<Row>(`/reports/annual?year=${year}`)).data);
    } catch (e) {
      setError(messageOf(e));
    }
  }
  useEffect(() => void load(), [year]);
  function exportCsv() {
    if (!report) return;
    const csv = [
      "Mês;Receitas;Despesas;Previsto receitas;Previsto despesas",
      ...(report.months ?? []).map((m: Row) =>
        [
          m.month,
          m.realizedIncomeCents,
          m.realizedExpenseCents,
          m.expectedIncomeCents,
          m.expectedExpenseCents,
        ].join(";"),
      ),
    ].join("\n");
    const url = URL.createObjectURL(
      new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `fisiofit-relatorio-${year}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  function exportXlsx() {
    if (!report) return;
    const rows = (report.months ?? []).map((month: Row) => ({
      Mês: month.month,
      Receitas: month.realizedIncomeCents,
      Despesas: month.realizedExpenseCents,
      "Previsto receitas": month.expectedIncomeCents,
      "Previsto despesas": month.expectedExpenseCents,
    }));
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Relatório anual");
    XLSX.writeFile(workbook, `fisiofit-relatorio-${year}.xlsx`);
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">FECHAMENTO E ANÁLISE</p>
          <h1>Relatório anual</h1>
          <p>Doze meses lado a lado, previsto e realizado.</p>
        </div>
        <div className="title-actions">
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
          <button className="btn secondary" onClick={exportCsv}>
            Exportar planilha
          </button>
          <button className="btn secondary" onClick={exportXlsx}>
            Exportar XLSX
          </button>
          <button className="btn primary" onClick={() => window.print()}>
            Gerar PDF
          </button>
        </div>
      </div>
      {error && <div className="login-error">{error}</div>}
      <div className="metrics">
        <MetricLite
          label="Receitas realizadas"
          value={brl(report?.totals?.realizedIncomeCents ?? 0)}
        />
        <MetricLite
          label="Despesas realizadas"
          value={brl(report?.totals?.realizedExpenseCents ?? 0)}
        />
        <MetricLite
          label="Resultado"
          value={brl(
            (report?.totals?.realizedIncomeCents ?? 0) -
              (report?.totals?.realizedExpenseCents ?? 0),
          )}
        />
        <MetricLite label="Ano" value={year} />
      </div>
      <section className="card annual-table">
        <div className="month-grid">
          <div className="month-row head">
            <strong>Indicador</strong>
            {(report?.months ?? []).map((m: Row) => (
              <span key={m.month}>{m.month.slice(5, 7)}</span>
            ))}
            <strong>Total</strong>
          </div>
          {[
            ["Receitas", "realizedIncomeCents"],
            ["Despesas", "realizedExpenseCents"],
            ["Prev. receitas", "expectedIncomeCents"],
            ["Prev. despesas", "expectedExpenseCents"],
          ].map(([label, key]) => (
            <div className="month-row" key={key}>
              <strong>{label}</strong>
              {(report?.months ?? []).map((m: Row) => (
                <span key={m.month}>{brl(m[key])}</span>
              ))}
              <strong>{brl(report?.totals?.[key] ?? 0)}</strong>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OperationalImports() {
  const { data, loading, error, reload } = useResources(["/units", "/imports"]);
  const [rows, setRows] = useState<Row[]>([]);
  const [filename, setFilename] = useState("");
  const [preview, setPreview] = useState<Row | null>(null);
  const [notice, setNotice] = useState("");
  const [notionBusy, setNotionBusy] = useState(false);
  const [notionValidated, setNotionValidated] = useState(false);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [workbookSheets, setWorkbookSheets] = useState<WorkbookSheet[]>([]);

  function normalizeHeader(header: string) {
    return header.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  async function readWorkbook(file: File, requestedSheet?: string) {
    setFilename(file.name);
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: true, dateNF: "yyyy-mm-dd" });
      setSheetNames(workbook.SheetNames);
      const sheetName = requestedSheet || workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: false });
      const normalizedRows = json.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normalizeHeader(key), String(value).trim() || undefined])));
      setRows(normalizedRows);
      setWorkbookSheets((current) => {
        const existing = current.filter((candidate) => candidate.name !== sheetName);
        const previous = current.find((candidate) => candidate.name === sheetName);
        return [...existing, { name: sheetName, entity: previous?.entity || guessWorkbookEntity(sheetName), rows: normalizedRows }];
      });
      setSelectedSheet(sheetName);
      setPreview(null);
      setNotice(`${json.length} linhas carregadas da aba ${sheetName}.`);
    } catch {
      setRows([]);
      setNotice("Não foi possível ler a planilha. Use um arquivo .xlsx ou .csv válido.");
    }
  }
  function guessWorkbookEntity(name: string) {
    const key = normalizeHeader(name);
    const found = workbookEntityOptions.find(([entity]) => key.includes(entity.replace("_", " ")) || key.includes(entity));
    return found?.[0] ?? "patients";
  }
  function choose(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) void readWorkbook(file);
  }
  async function run(event: FormEvent<HTMLFormElement>, dryRun: boolean) {
    event.preventDefault();
    try {
      const response = await api<Row>("/imports/workbook", {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
        body: JSON.stringify({
          filename,
          dryRun,
          sheets: workbookSheets.map(({ name, entity, rows: sheetRows }) => ({ name, entity, rows: sheetRows })),
        }),
      });
      setPreview(response.data);
      setNotice(dryRun ? "Pré-validação concluída." : "Importação concluída.");
      if (!dryRun) await reload();
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function runNotion(event: FormEvent<HTMLFormElement>, dryRun: boolean) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const unitId = value(f, "unit_id");
    if (!unitId) {
      setNotice("Selecione a unidade de destino antes de conectar o Notion.");
      return;
    }
    setNotionBusy(true);
    setNotice("");
    try {
      const response = await api<Row>("/imports/notion", {
        method: "POST",
        idempotencyKey: crypto.randomUUID(),
        body: JSON.stringify({ unit_id: unitId, dryRun }),
      });
      setPreview(response.data);
      setNotionValidated(dryRun);
      setNotice(dryRun
        ? "Pré-validação do Notion concluída. Nenhum dado foi importado."
        : "Primeira etapa da importação do Notion concluída e registrada no histórico.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setNotionBusy(false);
    }
  }
  async function rollbackBatch(id: string) {
    const reason = window.prompt("Informe o motivo do rollback (mínimo 10 caracteres):");
    if (!reason) return;
    try { await api(`/imports/${id}/rollback`, { method: "POST", body: JSON.stringify({ reason }) }); await reload(); setNotice("Lote revertido."); }
    catch (e) { setNotice(messageOf(e)); }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">MIGRAÇÃO RASTREÁVEL</p>
          <h1>Importações</h1>
          <p>
            Uma aba por tipo de informação, com prévia, validação, deduplicação e lote auditável.
          </p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <form className="card modal-form" onSubmit={(e) => run(e, true)}>
        <div className="form-row">
          <label>
            Origem
            <select name="source">
              <option value="manual">Planilha manual</option>
              <option value="oluma">Oluma</option>
              <option value="notion">Notion</option>
            </select>
          </label>
          <Select
            name="unit_id"
            label="Unidade de destino"
            rows={data["/units"] ?? []}
          />
        </div>
        <section className="notion-import-panel" aria-labelledby="notion-import-title">
          <h2 id="notion-import-title">Importação direta do Notion</h2>
          <p>
            Lê somente o espaço autorizado, confere relações e duplicidades e
            associa a prévia à unidade selecionada. Nada é gravado nesta etapa.
          </p>
          <button
            className="btn secondary"
            type="button"
            disabled={notionBusy}
            onClick={(event) =>
              void runNotion({
                preventDefault: () => {},
                currentTarget: event.currentTarget.closest("form") as HTMLFormElement,
              } as FormEvent<HTMLFormElement>, true)
            }
          >
            {notionBusy ? "Lendo o Notion…" : "Conectar e pré-validar Notion"}
          </button>
          {notionValidated && (
            <button
              className="btn primary"
              type="button"
              disabled={notionBusy}
              onClick={(event) =>
                void runNotion({
                  preventDefault: () => {},
                  currentTarget: event.currentTarget.closest("form") as HTMLFormElement,
                } as FormEvent<HTMLFormElement>, false)
              }
            >
              {notionBusy ? "Importando…" : "Importar válidos do Notion"}
            </button>
          )}
        </section>
        <label>
          Arquivo XLSX ou CSV
          <input
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            onChange={choose}
            required
          />
        </label>
        {sheetNames.length > 1 && (
          <label>Aba da planilha
            <select value={selectedSheet} onChange={(event) => {
              const input = event.currentTarget.form?.querySelector<HTMLInputElement>('input[type="file"]');
              if (input?.files?.[0]) void readWorkbook(input.files[0], event.target.value);
            }}>
              {sheetNames.map((sheet) => <option key={sheet} value={sheet}>{sheet}</option>)}
            </select>
          </label>
        )}
        <p>{rows.length} linhas carregadas{selectedSheet ? ` da aba “${selectedSheet}”` : ""}.</p>
        {workbookSheets.length > 0 && <section className="notion-import-panel" aria-labelledby="workbook-mapping-title">
          <h2 id="workbook-mapping-title">Mapeamento das abas</h2>
          <p>Escolha o tipo de informação correspondente a cada aba. As colunas são identificadas automaticamente pelos nomes dos cabeçalhos.</p>
          {workbookSheets.map((sheet) => <label key={sheet.name}>{sheet.name} ({sheet.rows.length} linhas)
            <select value={sheet.entity} onChange={(event) => setWorkbookSheets((current) => current.map((item) => item.name === sheet.name ? { ...item, entity: event.target.value } : item))}>
              {workbookEntityOptions.map(([entity, label]) => <option key={entity} value={entity}>{label}</option>)}
            </select>
          </label>)}
        </section>}
        <div className="title-actions">
          <button className="btn secondary" type="submit">
            Pré-validar
          </button>
          <button
            className="btn primary"
            type="button"
            disabled={!preview}
            onClick={(e) =>
              run(
                {
                  preventDefault: () => {},
                  currentTarget: e.currentTarget.closest(
                    "form",
                  ) as HTMLFormElement,
                } as any,
                false,
              )
            }
          >
            Importar válidos
          </button>
        </div>
        {preview && (
          <div className="environment-warning">
            {preview.counts ? (
              <>Total encontrado: {preview.total ?? 0} · Pendências: {preview.issues?.length ?? 0}</>
            ) : (
              <>Aceitos: {preview.accepted ?? preview.imported ?? 0} · Rejeitados: {preview.rejected?.length ?? 0}</>
            )}
          </div>
        )}
      </form>
      <OperationalTable
        title="Histórico de lotes"
        rows={data["/imports"] ?? []}
        fields={["filename", "source", "status", "totals", "created_at"]}
        actions={(row) => row.rollback_at ? null : <button type="button" onClick={() => void rollbackBatch(row.id)}>Rollback</button>}
      />
    </div>
  );
}

export function OperationalUsers({ canManageUsers }: { canManageUsers: boolean }) {
  const { data, loading, error, reload } = useResources(["/users", "/units"]);
  const [notice, setNotice] = useState("");
  const [updatingUserId, setUpdatingUserId] = useState("");
  const [editingUserId, setEditingUserId] = useState("");
  const permissionModules = [
    ["dashboard", "Painel"], ["agenda", "Agenda"], ["patients", "Pacientes"], ["enrollments", "Matrículas"], ["records", "Prontuários"],
    ["finance", "Financeiro"], ["reports", "Relatórios"], ["imports", "Importações"], ["users", "Usuários"], ["settings", "Configurações"], ["privacy", "Privacidade"],
  ] as const;
  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    try {
      await api("/users/invite", {
        method: "POST",
        body: JSON.stringify({
          email: value(f, "email"),
          name: value(f, "name"),
          role: value(f, "role"),
          unitIds: f.getAll("unitIds"),
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Convite enviado.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function update(id: string, status: string) {
    setUpdatingUserId(id);
    setNotice("");
    try {
      await api(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await reload();
      setNotice(status === "active" ? "Conta ativada. A colaboradora já pode concluir o primeiro acesso." : "Conta bloqueada.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setUpdatingUserId("");
    }
  }
  async function saveUser(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setUpdatingUserId(id);
    setNotice("");
    try {
      await api(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: value(form, "name"),
          role: value(form, "role"),
          status: value(form, "status"),
          unitIds: form.getAll("unitIds"),
          permissions: Object.fromEntries(permissionModules.map(([module]) => [module, { canView: form.get(`permission-${module}`) === "on", canEdit: form.get(`permission-edit-${module}`) === "on" }])),
        }),
      });
      await reload();
      setEditingUserId("");
      setNotice("Usuária atualizada.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setUpdatingUserId("");
    }
  }
  async function resendAccess(id: string) {
    setUpdatingUserId(id);
    setNotice("");
    try {
      await api(`/users/${id}/resend-access`, { method: "POST" });
      setNotice("Novo link de acesso enviado por e-mail.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setUpdatingUserId("");
    }
  }
  async function removeUser(row: Row) {
    if (!window.confirm(`Excluir o acesso de ${row.name}? O histórico será preservado, mas a conta não poderá mais entrar.`)) return;
    setUpdatingUserId(row.id);
    setNotice("");
    try {
      await api(`/users/${row.id}`, { method: "DELETE" });
      await reload();
      setNotice("Acesso excluído e histórico preservado.");
    } catch (e) {
      setNotice(messageOf(e));
    } finally {
      setUpdatingUserId("");
    }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">ACESSOS E PERMISSÕES</p>
          <h1>Usuários</h1>
          <p>Convites, perfis, unidades, bloqueio e MFA por função.</p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      {!canManageUsers && (
        <div className="environment-warning" role="status">
          Você pode consultar os acessos, mas somente uma administradora pode convidar, ativar ou bloquear contas.
        </div>
      )}
      {canManageUsers && <DrawerForm title="Convidar colaboradora" onSubmit={invite}>
        <h2>Convidar colaboradora</h2>
        <div className="form-row">
          <label>
            Nome
            <input name="name" required />
          </label>
          <label>
            E-mail
            <input name="email" type="email" required />
          </label>
        </div>
        <label>
          Perfil
          <select name="role">
            <option value="reception">Recepção</option>
            <option value="professional">Profissional</option>
            <option value="finance">Financeiro</option>
            <option value="manager">Gestor</option>
            <option value="admin">Administrador</option>
          </select>
        </label>
        <label>
          Unidades
          <div className="weekday-checks">
            {(data["/units"] ?? []).map((u: Unit) => (
              <label key={u.id}>
                <input type="checkbox" name="unitIds" value={u.id} />
                {u.name}
              </label>
            ))}
          </div>
        </label>
        <button className="btn primary">Enviar convite</button>
      </DrawerForm>}
      <section className="card table-card bespoke-table users-list-table">
        <div className="table-toolbar"><h2>Colaboradoras cadastradas</h2><span>{(data["/users"] ?? []).length} registros</span></div>
        <div className="bespoke-table-head" aria-hidden="true"><span>Nome</span><span>Acesso e segurança</span><span>Ações</span></div>
        {(data["/users"] ?? []).map((row: Row) => (
          <div className="user-management-entry" key={row.id}>
          <div className="operational-row">
            <div>
              <strong>
                {row.name}
                {row.is_owner ? " · Proprietário" : ""}
              </strong>
              <small>
                {row.email ? `${row.email} · ` : ""}{row.role} · {row.status} · MFA{" "}
                {row.mfa_required ? "obrigatório" : "opcional"}
              </small>
            </div>
            {row.is_owner ? (
              <span className="status info">Conta protegida</span>
            ) : !canManageUsers ? (
              <span className="status info">Somente leitura</span>
            ) : (
              <div className="row-actions">
                <button type="button" disabled={updatingUserId === row.id} onClick={() => setEditingUserId(editingUserId === row.id ? "" : row.id)}>
                  {editingUserId === row.id ? "Cancelar edição" : "Editar"}
                </button>
                {row.status !== "active" && (
                  <button type="button" disabled={updatingUserId === row.id} onClick={() => update(row.id, "active")}>
                    {updatingUserId === row.id ? "Ativando…" : "Ativar"}
                  </button>
                )}
                {row.status !== "blocked" && (
                  <button type="button" disabled={updatingUserId === row.id} onClick={() => update(row.id, "blocked")}>
                    {updatingUserId === row.id ? "Aguarde…" : "Bloquear"}
                  </button>
                )}
                {row.status !== "blocked" && (
                  <button type="button" disabled={updatingUserId === row.id} onClick={() => resendAccess(row.id)}>
                    Reenviar acesso
                  </button>
                )}
                <button className="action-delete" type="button" disabled={updatingUserId === row.id} onClick={() => removeUser(row)}>
                  Excluir
                </button>
              </div>
            )}
          </div>
          {canManageUsers && editingUserId === row.id && !row.is_owner && (
            <form className="user-edit-form" onSubmit={(event) => saveUser(event, row.id)}>
              <div className="form-row">
                <label>Nome<input name="name" defaultValue={row.name} required minLength={3} /></label>
                <label>Perfil<select name="role" defaultValue={row.role}>
                  <option value="reception">Recepção</option><option value="professional">Profissional</option>
                  <option value="finance">Financeiro</option><option value="manager">Gestor</option><option value="admin">Administrador</option>
                </select></label>
                <label>Situação<select name="status" defaultValue={row.status}>
                  <option value="invited">Convidada</option><option value="active">Ativa</option><option value="blocked">Bloqueada</option>
                </select></label>
              </div>
              <fieldset><legend>Unidades</legend><div className="weekday-checks">
                {(data["/units"] ?? []).map((unit: Unit) => <label key={unit.id}>
                  <input type="checkbox" name="unitIds" value={unit.id} defaultChecked={(row.profile_units ?? []).some((item: Row) => item.unit_id === unit.id)} />{unit.name}
                </label>)}
              </div></fieldset>
              <fieldset><legend>Acesso por módulo</legend><div className="permission-grid"><strong>Módulo</strong><strong>Visualizar</strong><strong>Editar</strong>
                {permissionModules.map(([module, label]) => { const permission = (row.profile_permissions ?? []).find((item: Row) => item.module === module); return <><span key={`${row.id}-${module}-label`}>{label}</span><label key={`${row.id}-${module}-view`}><input type="checkbox" name={`permission-${module}`} defaultChecked={permission?.can_view} /> Pode visualizar</label><label key={`${row.id}-${module}-edit`}><input type="checkbox" name={`permission-edit-${module}`} defaultChecked={permission?.can_edit} /> Pode editar</label></>; })}
              </div><small>Editar inclui visualizar. O administrador mantém o acesso total.</small></fieldset>
              <button className="btn primary" type="submit" disabled={updatingUserId === row.id}>{updatingUserId === row.id ? "Salvando…" : "Salvar alterações"}</button>
            </form>
          )}
          </div>
        ))}
      </section>
    </div>
  );
}

type AdministrationTab = "units" | "rooms" | "services" | "professionals" | "templates";
type AdministrationSectionProps = {
  data: Record<string, any>;
  reload: () => void | Promise<void>;
  setNotice: (message: string) => void;
  submit: (
    event: FormEvent<HTMLFormElement>,
    path: string,
    body: (form: FormData) => Row,
  ) => Promise<void>;
};

function FormularioUnidade({ data, reload, setNotice, submit }: AdministrationSectionProps) {
  return <div className="administration-section">
    <DrawerForm title="Nova unidade" className="administration-form" onSubmit={(event) => submit(event, "/units", (form) => ({
      name: value(form, "name"), phone: value(form, "phone") || undefined,
      address: { street: value(form, "street"), city: value(form, "city"), state: value(form, "state") },
    }))}>
      <h2>Nova unidade</h2>
      <p className="form-instructions">Cadastre os dados de identificação e localização da unidade.</p>
      <label>Nome *<input name="name" required /></label>
      <div className="form-row"><label>Telefone<input name="phone" type="tel" /></label><label>Rua<input name="street" /></label></div>
      <div className="form-row"><label>Cidade<input name="city" /></label><label>Estado<input name="state" maxLength={2} /></label></div>
      <button className="btn primary">Salvar unidade</button>
    </DrawerForm>
    <EditableOperationalTable title="Unidades" resource="units" rows={data["/units"] ?? []} fields={["name", "phone", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "phone", label: "Telefone" }, { name: "street", label: "Rua", value: (row) => row.address?.street }, { name: "city", label: "Cidade", value: (row) => row.address?.city }, { name: "state", label: "Estado", value: (row) => row.address?.state, maxLength: 2 }]}
      buildBody={(form) => ({ name: value(form, "name"), phone: value(form, "phone") || null, address: { street: value(form, "street"), city: value(form, "city"), state: value(form, "state") } })}
      onChanged={reload} onNotice={setNotice} allowDelete />
  </div>;
}

function FormularioSala({ data, reload, setNotice, submit }: AdministrationSectionProps) {
  return <div className="administration-section">
    <DrawerForm title="Nova sala" className="administration-form" onSubmit={(event) => submit(event, "/rooms", (form) => ({ unit_id: value(form, "unit_id"), name: value(form, "name"), capacity: Number(value(form, "capacity")) }))}>
      <h2>Nova sala</h2><p className="form-instructions">Vincule a sala a uma unidade e informe sua capacidade.</p>
      <Select name="unit_id" label="Unidade *" rows={data["/units"] ?? []} />
      <label>Nome *<input name="name" required /></label>
      <label>Capacidade *<input name="capacity" type="number" min="1" max="20" defaultValue="7" required /></label>
      <button className="btn primary">Salvar sala</button>
    </DrawerForm>
    <EditableOperationalTable title="Salas" resource="rooms" rows={data["/rooms"] ?? []} fields={["name", "capacity", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "capacity", label: "Capacidade", type: "number", min: 1, max: 20, required: true }]}
      buildBody={(form) => ({ name: value(form, "name"), capacity: Number(value(form, "capacity")) })} onChanged={reload} onNotice={setNotice} allowDelete />
  </div>;
}

function FormularioServico({ data, reload, setNotice, submit }: AdministrationSectionProps) {
  return <div className="administration-section">
    <DrawerForm title="Novo serviço" className="administration-form" onSubmit={(event) => submit(event, "/services", (form) => ({ name: value(form, "name"), duration_minutes: Number(value(form, "duration")), price_cents: cents(value(form, "price")), active: true }))}>
      <h2>Novo serviço</h2><p className="form-instructions">Defina duração e preço padrão do atendimento.</p>
      <label>Nome *<input name="name" required /></label>
      <div className="form-row"><label>Duração (min) *<input name="duration" type="number" min="5" max="480" required /></label><label>Preço *<input name="price" type="number" step=".01" min="0" required /></label></div>
      <button className="btn primary">Salvar serviço</button>
    </DrawerForm>
    <EditableOperationalTable title="Serviços" resource="services" rows={data["/services"] ?? []} fields={["name", "duration_minutes", "price_cents", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "duration_minutes", label: "Duração (min)", type: "number", min: 5, max: 480, required: true }, { name: "price", label: "Preço", type: "number", min: 0, step: ".01", required: true, value: (row) => Number(row.price_cents ?? 0) / 100 }]}
      buildBody={(form) => ({ name: value(form, "name"), duration_minutes: Number(value(form, "duration_minutes")), price_cents: cents(value(form, "price")) })} onChanged={reload} onNotice={setNotice} allowDelete />
  </div>;
}

function FormularioProfissional({ data, reload, setNotice, submit }: AdministrationSectionProps) {
  return <div className="administration-section">
    <DrawerForm title="Novo profissional" className="administration-form" onSubmit={(event) => submit(event, "/professionals", (form) => ({ name: value(form, "name"), council: value(form, "council") || undefined, specialty: value(form, "specialty") || undefined, unitIds: form.getAll("unitIds"), active: true }))}>
      <h2>Novo profissional</h2><p className="form-instructions">Informe os dados profissionais e selecione ao menos uma unidade.</p>
      <label>Nome *<input name="name" required /></label>
      <div className="form-row"><label>Conselho<input name="council" /></label><label>Especialidade<input name="specialty" /></label></div>
      <fieldset><legend>Unidades *</legend><div className="weekday-checks">{(data["/units"] ?? []).map((unit: Unit) => <label key={unit.id}><input type="checkbox" name="unitIds" value={unit.id} />{unit.name}</label>)}</div></fieldset>
      <button className="btn primary">Salvar profissional</button>
    </DrawerForm>
    <EditableOperationalTable title="Profissionais" resource="professionals" rows={data["/professionals"] ?? []} fields={["name", "council", "specialty", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "council", label: "Conselho" }, { name: "specialty", label: "Especialidade" }]}
      buildBody={(form) => ({ name: value(form, "name"), council: value(form, "council") || null, specialty: value(form, "specialty") || null })} onChanged={reload} onNotice={setNotice} allowDelete />
  </div>;
}

function FormularioModeloClinico({ data, reload, setNotice, submit }: AdministrationSectionProps) {
  return <div className="administration-section">
    <DrawerForm title="Novo modelo clínico" className="administration-form" onSubmit={(event) => submit(event, "/record-templates", (form) => ({ name: value(form, "name"), kind: value(form, "kind"), specialty: value(form, "specialty") || undefined, schema: {}, active: true }))}>
      <h2>Novo modelo clínico</h2><p className="form-instructions">Crie uma base para avaliações ou evoluções clínicas.</p>
      <label>Nome *<input name="name" required minLength={3} /></label>
      <div className="form-row"><label>Tipo *<select name="kind"><option value="assessment">Avaliação</option><option value="evolution">Evolução</option></select></label><label>Especialidade<input name="specialty" /></label></div>
      <button className="btn primary">Salvar modelo</button>
    </DrawerForm>
    <EditableOperationalTable title="Modelos clínicos" resource="record-templates" rows={data["/record-templates"] ?? []} fields={["name", "kind", "specialty", "active"]}
      editFields={[{ name: "name", label: "Nome", required: true }, { name: "specialty", label: "Especialidade" }]}
      buildBody={(form) => ({ name: value(form, "name"), specialty: value(form, "specialty") || null })} onChanged={reload} onNotice={setNotice} allowDelete />
  </div>;
}

const administrationTabs: Array<{ id: AdministrationTab; label: string }> = [
  { id: "units", label: "Unidades" }, { id: "rooms", label: "Salas" },
  { id: "services", label: "Serviços" }, { id: "professionals", label: "Profissionais" },
  { id: "templates", label: "Modelos clínicos" },
];

export function OperationalAdministration() {
  const paths = [
    "/units",
    "/rooms",
    "/professionals",
    "/services",
    "/record-templates",
  ];
  const { data, loading, error, reload } = useResources(paths);
  const [notice, setNotice] = useState("");
  const [activeTab, setActiveTab] = useState<AdministrationTab>("units");
  async function submit(
    event: FormEvent<HTMLFormElement>,
    path: string,
    body: (form: FormData) => Row,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api(path, { method: "POST", body: JSON.stringify(body(form)) });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Cadastro salvo.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">ESTRUTURA DA CLÍNICA</p>
          <h1>Configurações operacionais</h1>
          <p>Unidades, salas, equipe, serviços e modelos clínicos.</p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <nav className="administration-tabs" role="tablist" aria-label="Tipos de configuração">
        {administrationTabs.map((tab, index) => <button key={tab.id} type="button" role="tab"
          id={`administration-tab-${tab.id}`} aria-selected={activeTab === tab.id}
          aria-controls={`administration-panel-${tab.id}`} tabIndex={activeTab === tab.id ? 0 : -1}
          className={activeTab === tab.id ? "active" : ""} onClick={() => setActiveTab(tab.id)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const nextIndex = event.key === "Home" ? 0 : event.key === "End" ? administrationTabs.length - 1
              : (index + (event.key === "ArrowRight" ? 1 : -1) + administrationTabs.length) % administrationTabs.length;
            setActiveTab(administrationTabs[nextIndex].id);
            const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
            buttons?.[nextIndex]?.focus();
          }}>{tab.label}</button>)}
      </nav>
      <ModuleState loading={loading} error={error} retry={reload} />
      {!loading && !error && <section key={activeTab} className="administration-tab-panel" role="tabpanel"
        id={`administration-panel-${activeTab}`} aria-labelledby={`administration-tab-${activeTab}`} tabIndex={0}>
        {activeTab === "units" && <FormularioUnidade data={data} reload={reload} setNotice={setNotice} submit={submit} />}
        {activeTab === "rooms" && <FormularioSala data={data} reload={reload} setNotice={setNotice} submit={submit} />}
        {activeTab === "services" && <FormularioServico data={data} reload={reload} setNotice={setNotice} submit={submit} />}
        {activeTab === "professionals" && <FormularioProfissional data={data} reload={reload} setNotice={setNotice} submit={submit} />}
        {activeTab === "templates" && <FormularioModeloClinico data={data} reload={reload} setNotice={setNotice} submit={submit} />}
      </section>}
    </div>
  );
}

export function OperationalPrivacy() {
  const paths = ["/privacy/requests", "/privacy/incidents", "/audit"];
  const { data, loading, error, reload } = useResources(paths);
  const [notice, setNotice] = useState("");
  async function request(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/privacy/requests", {
        method: "POST",
        body: JSON.stringify({
          requester_name: value(form, "name"),
          requester_email: value(form, "email") || undefined,
          requester_phone: value(form, "phone") || undefined,
          kind: value(form, "kind"),
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Solicitação registrada.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  async function incident(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/privacy/incidents", {
        method: "POST",
        body: JSON.stringify({
          title: value(form, "title"),
          description: value(form, "description"),
          severity: value(form, "severity"),
          discovered_at: new Date(value(form, "discovered_at")).toISOString(),
          data_categories: value(form, "categories")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          mitigation: value(form, "mitigation") || undefined,
        }),
      });
      (event.target as HTMLFormElement).reset();
      await reload();
      setNotice("Incidente registrado.");
    } catch (e) {
      setNotice(messageOf(e));
    }
  }
  return (
    <div className="content">
      <div className="page-title">
        <div>
          <p className="eyebrow">LGPD E PRESTAÇÃO DE CONTAS</p>
          <h1>Privacidade e auditoria</h1>
          <p>Solicitações dos titulares, incidentes e histórico de ações.</p>
        </div>
      </div>
      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}
      <ModuleState loading={loading} error={error} retry={reload} />
      <div className="dashboard-grid">
        <DrawerForm title="Nova solicitação" onSubmit={request}>
          <h2>Nova solicitação</h2>
          <label>
            Solicitante
            <input name="name" required />
          </label>
          <div className="form-row">
            <label>
              E-mail
              <input name="email" type="email" />
            </label>
            <label>
              Telefone
              <input name="phone" />
            </label>
          </div>
          <label>
            Direito solicitado
            <select name="kind">
              <option value="access">Acesso</option>
              <option value="correction">Correção</option>
              <option value="sharing">Compartilhamentos</option>
              <option value="opposition">Oposição</option>
              <option value="portability">Portabilidade</option>
              <option value="revocation">Revogação</option>
              <option value="deletion">Eliminação aplicável</option>
            </select>
          </label>
          <button className="btn primary">Registrar solicitação</button>
        </DrawerForm>
        <DrawerForm title="Novo incidente" onSubmit={incident}>
          <h2>Novo incidente</h2>
          <label>
            Título
            <input name="title" required />
          </label>
          <label>
            Descrição
            <textarea name="description" rows={3} required minLength={10} />
          </label>
          <div className="form-row">
            <label>
              Severidade
              <select name="severity">
                <option value="low">Baixa</option>
                <option value="medium">Média</option>
                <option value="high">Alta</option>
                <option value="critical">Crítica</option>
              </select>
            </label>
            <label>
              Descoberto em
              <input name="discovered_at" type="datetime-local" required />
            </label>
          </div>
          <label>
            Categorias afetadas
            <input
              name="categories"
              placeholder="saúde, financeiro, autenticação"
            />
          </label>
          <label>
            Mitigação
            <textarea name="mitigation" rows={2} />
          </label>
          <button className="btn primary">Registrar incidente</button>
        </DrawerForm>
      </div>
      <OperationalTable
        title="Solicitações de titulares"
        rows={data["/privacy/requests"] ?? []}
        fields={["requester_name", "kind", "status", "due_at"]}
      />
      <OperationalTable
        title="Incidentes"
        rows={data["/privacy/incidents"] ?? []}
        fields={["title", "severity", "status", "discovered_at"]}
      />
      <OperationalTable
        title="Auditoria recente"
        rows={data["/audit"] ?? []}
        fields={["action", "entity_type", "user_id", "occurred_at"]}
      />
    </div>
  );
}

function MetricLite({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="metric-card">
      <div className="metric-copy">
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
    </div>
  );
}

type EditField = {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "email" | "tel" | "datetime-local" | "select" | "textarea";
  required?: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  step?: string;
  value?: (row: Row) => unknown;
  options?: Row[];
};

function EditableOperationalTable({
  title,
  resource,
  rows,
  fields,
  editFields,
  buildBody,
  onChanged,
  onNotice,
  onOpen,
  allowDelete = false,
  showToggle = true,
  total,
  page,
  pageSize,
  onPageChange,
}: {
  title: string;
  resource: string;
  rows: Row[];
  fields: string[];
  editFields: EditField[];
  buildBody: (form: FormData) => Row;
  onChanged: () => void | Promise<void>;
  onNotice: (message: string) => void;
  onOpen?: (row: Row) => void | Promise<void>;
  allowDelete?: boolean;
  showToggle?: boolean;
  total?: number;
  page?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
}) {
  const [editing, setEditing] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editing) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) setEditing(null);
    };
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [editing, saving]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    try {
      await api(`/${resource}/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(buildBody(new FormData(event.currentTarget))),
      });
      await onChanged();
      setEditing(null);
      onNotice(`${title.replace(/s$/, "")} atualizado com sucesso.`);
    } catch (error) {
      onNotice(messageOf(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(row: Row) {
    const activate = row.active === false;
    if (!activate && !window.confirm(
      `Inativar ${row.name}? O histórico será preservado e o cadastro poderá ser reativado.`,
    )) return;
    try {
      await api(`/${resource}/${row.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: activate }),
      });
      await onChanged();
      onNotice(activate ? "Cadastro reativado." : "Cadastro inativado.");
    } catch (error) {
      onNotice(messageOf(error));
    }
  }

  async function remove(row: Row) {
    if (!window.confirm(`Excluir ${row.name}? O cadastro sairá das listagens. O histórico clínico e financeiro será preservado para fins legais.`)) return;
    try {
      await api(`/${resource}/${row.id}`, { method: "DELETE" });
      await onChanged();
      onNotice("Cadastro excluído com segurança.");
    } catch (error) {
      onNotice(messageOf(error));
    }
  }

  return (
    <>
      <section className="card table-card operational-data-table" style={{ "--table-columns": `repeat(${fields.length}, minmax(120px, 1fr)) minmax(230px, auto)` } as CSSProperties}>
        <div className="table-toolbar">
          <h2>{title}</h2>
          <span>{total ?? rows.length} registros</span>
        </div>
        <div className="operational-table-head" aria-hidden="true">
          {fields.map((field) => <span key={field}>{fieldLabel(field)}</span>)}
          <span>Ações</span>
        </div>
        {rows.map((row) => (
          <div className="operational-row" key={row.id}>
            {fields.map((field, index) => <div className="operational-cell" key={field} data-label={fieldLabel(field)}>
              {index === 0 ? <strong>{render(row[field], field)}</strong> : <span>{render(row[field], field)}</span>}
            </div>)}
            <div className="row-actions" aria-label={`Ações de ${row.name}`}>
              {onOpen && <button type="button" onClick={() => void onOpen(row)}>Detalhes</button>}
              <button type="button" onClick={() => setEditing(row)}>Editar</button>
              {showToggle && <button
                  type="button"
                  className={row.active === false ? "action-activate" : "action-inactivate"}
                  onClick={() => void toggle(row)}
                >
                  {row.active === false ? "Reativar" : "Inativar"}
                </button>}
              {allowDelete && <button type="button" className="action-delete" onClick={() => void remove(row)}>Excluir</button>}
            </div>
          </div>
        ))}
        {!rows.length && <div className="empty-state">Nenhum registro cadastrado.</div>}
        {page && pageSize && total !== undefined && total > pageSize && (
          <nav className="table-pagination" aria-label={`Paginação de ${title}`}>
            <button className="btn secondary" type="button" disabled={page === 1} onClick={() => onPageChange?.(page - 1)}>Anterior</button>
            <span>Página {page} de {Math.ceil(total / pageSize)}</span>
            <button className="btn secondary" type="button" disabled={page >= Math.ceil(total / pageSize)} onClick={() => onPageChange?.(page + 1)}>Próxima</button>
          </nav>
        )}
      </section>
      {editing && (
        <div className="edit-dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget && !saving) setEditing(null);
        }}>
          <section className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby={`edit-${resource}-title`}>
            <div className="edit-dialog-header">
              <div>
                <p className="eyebrow">EDIÇÃO DE CADASTRO</p>
                <h2 id={`edit-${resource}-title`}>Editar {editing.name}</h2>
              </div>
              <button type="button" className="dialog-close" aria-label="Fechar edição" onClick={() => setEditing(null)} disabled={saving}>×</button>
            </div>
            <form className="modal-form" onSubmit={save}>
              {editFields.map((field) => (
                <label key={field.name}>
                  {field.label}{field.required ? " *" : ""}
                  {field.type === "select" ? <select name={field.name} required={field.required} defaultValue={String(field.value ? field.value(editing) ?? "" : editing[field.name] ?? "")}>
                    <option value="">Selecione</option>
                    {(field.options ?? []).map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}
                  </select> : field.type === "textarea" ? <textarea name={field.name} rows={4} defaultValue={String(field.value ? field.value(editing) ?? "" : editing[field.name] ?? "")} /> : <input
                    name={field.name}
                    type={field.type ?? "text"}
                    required={field.required}
                    min={field.min}
                    max={field.max}
                    maxLength={field.maxLength}
                    step={field.step}
                    defaultValue={String(field.value ? field.value(editing) ?? "" : editing[field.name] ?? "")}
                  />}
                </label>
              ))}
              <div className="edit-dialog-actions">
                <button type="button" className="btn secondary" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
                <button className="btn primary" disabled={saving}>{saving ? "Salvando…" : "Salvar alterações"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function OperationalTable({
  title,
  rows,
  fields,
  actions,
}: {
  title: string;
  rows: Row[];
  fields: string[];
  actions?: (row: Row) => ReactNode;
}) {
  return (
    <section className="card table-card operational-data-table" style={{ "--table-columns": `repeat(${fields.length}, minmax(135px, 1fr))` } as CSSProperties}>
      <div className="table-toolbar">
        <h2>{title}</h2>
        <span>{rows.length} registros</span>
      </div>
      <div className="operational-table-head" aria-hidden="true">
        {fields.map((field) => <span key={field}>{fieldLabel(field)}</span>)}
      </div>
      {rows.map((row) => (
        <div className="operational-row" key={row.id}>
          {fields.map((field, index) => <div className="operational-cell" key={field} data-label={fieldLabel(field)}>
            {index === 0 ? <strong>{render(row[field], field)}</strong> : <span>{render(row[field], field)}</span>}
          </div>)}
          {actions && <div className="operational-cell row-actions" data-label="Ações">{actions(row)}</div>}
        </div>
      ))}
      {!rows.length && (
        <div className="empty-state">Nenhum registro cadastrado.</div>
      )}
    </section>
  );
}
function fieldLabel(field: string) {
  const labels: Record<string, string> = {
    name: "Nome", phone: "Telefone", email: "E-mail", active: "Status",
    kind: "Tipo", sessions_included: "Sessões", duration_days: "Duração",
    price_cents: "Preço", status: "Status", starts_at: "Início",
    due_day: "Vencimento", sessions_used: "Sessões usadas",
    total_plan_cents: "Valor total do plano",
    allocation: "Alocação de pacientes",
    description: "Descrição", amount_cents: "Valor", paid_cents: "Valor pago",
    due_at: "Vencimento", competence_date: "Competência", category: "Categoria",
    requester_name: "Solicitante", title: "Título", severity: "Severidade",
    discovered_at: "Identificado em", action: "Ação", entity_type: "Recurso",
    user_id: "Usuário", occurred_at: "Data", capacity: "Capacidade",
    duration_minutes: "Duração", council: "Conselho", specialty: "Especialidade",
  };
  return labels[field] ?? field.replaceAll("_", " ");
}
function render(value: any, field: string) {
  if (value == null) return "—";
  if (field.includes("amount") || field.includes("paid_cents") || field === "price_cents")
    return brl(Number(value));
  if (field === "kind") return ({ monthly: "Mensal", package: "Pacote", single: "Avulso" } as Record<string, string>)[String(value)] ?? String(value);
  if (field === "active") return value ? "Ativo" : "Inativo";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
