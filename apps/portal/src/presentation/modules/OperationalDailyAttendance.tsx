import { useMemo, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { dateKey, messageOf, ModuleState, type Row, useResources } from "./OperationalShared";

const attendanceStatus = {
  scheduled: { label: "Agendado", className: "neutral" },
  confirmed: { label: "Confirmado", className: "info" },
  attending: { label: "Presente", className: "success" },
  missed: { label: "Faltou", className: "danger" },
  cancelled: { label: "Cancelado", className: "neutral" },
} as const;

function localDayRange(day: string) {
  const from = new Date(`${day}T00:00:00`);
  const to = new Date(from);
  to.setDate(to.getDate() + 1);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function OperationalDailyAttendance({ canEdit = true }: { canEdit?: boolean }) {
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState("");
  const range = useMemo(() => localDayRange(selectedDate), [selectedDate]);
  const path = `/appointments?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`;
  const { data, loading, error, reload } = useResources([path]);
  const appointments: Row[] = data[path] ?? [];
  const activeAppointments = appointments.filter((row) => row.status !== "cancelled");
  const present = activeAppointments.filter((row) => row.status === "attending").length;
  const missed = activeAppointments.filter((row) => row.status === "missed").length;
  const pending = activeAppointments.length - present - missed;

  function moveDay(offset: number) {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setSelectedDate(dateKey(next));
    setNotice("");
  }

  async function markAttendance(row: Row, status: "attending" | "missed") {
    setSavingId(row.id);
    setNotice("");
    try {
      await api(`/appointments/${row.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await reload();
      setNotice(`${row.patients?.name ?? "Paciente"}: ${status === "attending" ? "presença registrada" : "falta registrada"}.`);
    } catch (error) {
      setNotice(messageOf(error));
    } finally {
      setSavingId("");
    }
  }

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${selectedDate}T12:00:00`));

  return (
    <div className="content daily-attendance">
      <div className="page-title daily-attendance-title">
        <div>
          <p className="eyebrow">ROTINA DE ATENDIMENTOS</p>
          <h1>Chamada diária</h1>
          <p>Registre presenças e faltas dos pacientes agendados.</p>
        </div>
        <div className="daily-date-controls" aria-label="Selecionar dia da chamada">
          <button type="button" className="btn secondary" onClick={() => moveDay(-1)} aria-label="Dia anterior">‹</button>
          <label>
            <span className="sr-only">Data da chamada</span>
            <input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setNotice(""); }} />
          </label>
          <button type="button" className="btn secondary" onClick={() => moveDay(1)} aria-label="Próximo dia">›</button>
          <button type="button" className="btn secondary" onClick={() => setSelectedDate(dateKey(new Date()))}>Hoje</button>
        </div>
      </div>

      {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
      <ModuleState loading={loading} error={error} retry={reload} />

      {!loading && !error && <>
        <section className="attendance-summary" aria-label="Resumo da chamada">
          <div><span>Total</span><strong>{activeAppointments.length}</strong></div>
          <div><span>Presentes</span><strong>{present}</strong></div>
          <div><span>Faltas</span><strong>{missed}</strong></div>
          <div><span>Pendentes</span><strong>{pending}</strong></div>
        </section>

        <section className="card attendance-card" aria-labelledby="attendance-day-title">
          <div className="card-head">
            <div>
              <h2 id="attendance-day-title">{formattedDate}</h2>
              <p>{activeAppointments.length ? `${activeAppointments.length} atendimento${activeAppointments.length === 1 ? "" : "s"} no dia` : "Nenhum atendimento agendado"}</p>
            </div>
          </div>
          {activeAppointments.length === 0 ? (
            <div className="attendance-empty"><strong>Agenda livre neste dia</strong><p>Escolha outra data ou cadastre os atendimentos na Agenda.</p></div>
          ) : (
            <div className="attendance-list">
              {activeAppointments.map((row) => {
                const status = attendanceStatus[row.status as keyof typeof attendanceStatus] ?? attendanceStatus.scheduled;
                const busy = savingId === row.id;
                return <article className="attendance-row" key={row.id} aria-busy={busy}>
                  <time dateTime={row.starts_at}>{new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(new Date(row.starts_at))}</time>
                  <div className="attendance-person">
                    <strong>{row.patients?.name ?? "Horário bloqueado"}</strong>
                    <span>{row.services?.name ?? "Atendimento"} · {row.professionals?.name ?? "Profissional não informado"}</span>
                  </div>
                  <span className={`status ${status.className}`}>{status.label}</span>
                  {canEdit && row.patient_id ? <div className="attendance-actions" aria-label={`Registrar chamada de ${row.patients?.name ?? "paciente"}`}>
                    <button type="button" className={row.status === "attending" ? "attendance-action present selected" : "attendance-action present"} disabled={busy} onClick={() => void markAttendance(row, "attending")} aria-pressed={row.status === "attending"}>Presente</button>
                    <button type="button" className={row.status === "missed" ? "attendance-action missed selected" : "attendance-action missed"} disabled={busy} onClick={() => void markAttendance(row, "missed")} aria-pressed={row.status === "missed"}>Faltou</button>
                  </div> : <span className="attendance-readonly">{row.patient_id ? "Somente leitura" : "Sem paciente"}</span>}
                </article>;
              })}
            </div>
          )}
        </section>
      </>}
    </div>
  );
}
