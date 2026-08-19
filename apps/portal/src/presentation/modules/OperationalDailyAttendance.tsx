import { useMemo, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { dateKey, messageOf, ModuleState, type Row, useResources } from "./OperationalShared";

type AttendanceResponse = { slots: Row[]; makeups: Row[] };

export function OperationalDailyAttendance({ canEdit = true }: { canEdit?: boolean }) {
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState("");
  const path = `/attendance/daily?date=${selectedDate}`;
  const { data, loading, error, reload } = useResources([path]);
  const response: AttendanceResponse = data[path] ?? { slots: [], makeups: [] };
  const members = useMemo(() => response.slots.flatMap((slot) => (slot.members ?? []).map((member: Row) => ({ ...member, slot }))), [response.slots]);
  const present = members.filter((row) => row.attendance?.status === "present").length;
  const absent = members.filter((row) => row.attendance?.status === "absent").length;
  const pending = members.length - present - absent;
  const isFuture = selectedDate > dateKey(new Date());

  function moveDay(offset: number) {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setSelectedDate(dateKey(next));
    setNotice("");
  }

  async function markAttendance(member: Row, status: "present" | "absent") {
    setSavingId(member.id);
    setNotice("");
    try {
      await api("/attendance", { method: "POST", body: JSON.stringify({ membership_id: member.id, class_date: selectedDate, status }) });
      await reload();
      setNotice(`${member.patients?.name ?? "Paciente"}: ${status === "present" ? "presença registrada" : "falta registrada e reposição pendente"}.`);
    } catch (error) {
      setNotice(messageOf(error));
    } finally {
      setSavingId("");
    }
  }

  async function finishMakeup(item: Row, status: "completed" | "waived") {
    setSavingId(item.id);
    setNotice("");
    try {
      await api(`/attendance/${item.id}/makeup`, { method: "PATCH", body: JSON.stringify({ status }) });
      await reload();
      setNotice(status === "completed" ? "Reposição marcada como realizada." : "Reposição dispensada.");
    } catch (error) {
      setNotice(messageOf(error));
    } finally {
      setSavingId("");
    }
  }

  const formattedDate = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(`${selectedDate}T12:00:00`));

  return <div className="content daily-attendance">
    <div className="page-title daily-attendance-title">
      <div><p className="eyebrow">TURMAS E REPOSIÇÕES</p><h1>Chamada diária</h1><p>Confira os pacientes de cada horário e registre quem veio ou faltou.</p></div>
      <div className="daily-date-controls" aria-label="Selecionar dia da chamada">
        <button type="button" className="btn secondary" onClick={() => moveDay(-1)} aria-label="Dia anterior">‹</button>
        <label><span className="sr-only">Data da chamada</span><input type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setNotice(""); }} /></label>
        <button type="button" className="btn secondary" onClick={() => moveDay(1)} aria-label="Próximo dia">›</button>
        <button type="button" className="btn secondary" onClick={() => setSelectedDate(dateKey(new Date()))}>Hoje</button>
      </div>
    </div>
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    <ModuleState loading={loading} error={error} retry={reload} />
    {!loading && !error && <>
      {isFuture && <div className="system-message attendance-future-note" role="status"><span className="message-icon" aria-hidden="true">i</span><div><strong>Chamada futura</strong><p>Você pode conferir a turma, mas a presença só poderá ser marcada no dia da aula.</p></div></div>}
      <section className="attendance-summary" aria-label="Resumo da chamada">
        <div><span>Pacientes</span><strong>{members.length}</strong></div><div><span>Presentes</span><strong>{present}</strong></div><div><span>Faltas</span><strong>{absent}</strong></div><div><span>Sem marcar</span><strong>{pending}</strong></div>
      </section>
      <div className="attendance-day-heading"><h2>{formattedDate}</h2><p>{response.slots.length ? `${response.slots.length} horário${response.slots.length === 1 ? "" : "s"} com turma` : "Nenhuma turma neste dia"}</p></div>
      {response.slots.length ? <div className="attendance-slot-list">{response.slots.map((slot) => <section className="card attendance-card" key={slot.id}>
        <div className="card-head attendance-slot-head"><div><p className="eyebrow">{slot.units?.name ?? "UNIDADE"}</p><h2>Horário {String(slot.starts_at).slice(0, 5)}</h2><p>{slot.professionals?.name ?? "Profissional não informado"} · {slot.services?.name ?? slot.name}</p></div><strong>{slot.members?.length ?? 0}/{slot.capacity ?? 7} pacientes</strong></div>
        {slot.members?.length ? <div className="attendance-list">{slot.members.map((member: Row) => {
          const status = member.attendance?.status as "present" | "absent" | undefined;
          const busy = savingId === member.id;
          return <article className="attendance-row" key={member.id} aria-busy={busy}>
            <div className="attendance-person"><strong>{member.patients?.name ?? "Paciente"}</strong><span>{member.patients?.phone ?? "Telefone não informado"}</span></div>
            <span className={`status ${status === "present" ? "success" : status === "absent" ? "danger" : "neutral"}`}>{status === "present" ? "Presente" : status === "absent" ? "Faltou" : "Sem marcar"}</span>
            {canEdit ? <div className="attendance-actions" aria-label={`Registrar chamada de ${member.patients?.name ?? "paciente"}`}>
              <button type="button" className={status === "present" ? "attendance-action present selected" : "attendance-action present"} disabled={busy || isFuture} onClick={() => void markAttendance(member, "present")} aria-pressed={status === "present"}>Veio</button>
              <button type="button" className={status === "absent" ? "attendance-action missed selected" : "attendance-action missed"} disabled={busy || isFuture} onClick={() => void markAttendance(member, "absent")} aria-pressed={status === "absent"}>Faltou</button>
            </div> : <span className="attendance-readonly">Somente leitura</span>}
          </article>;
        })}</div> : <div className="attendance-empty"><strong>Nenhum paciente neste horário</strong></div>}
      </section>)}</div> : <div className="card attendance-empty"><strong>Nenhuma turma fixa nesta data</strong><p>Os pacientes aparecerão automaticamente conforme os dias e períodos cadastrados na Agenda.</p></div>}
      <section className="card makeup-card" aria-labelledby="makeup-title">
        <div className="card-head"><div><p className="eyebrow">CONTROLE DE FALTAS</p><h2 id="makeup-title">Reposições pendentes</h2><p>Uma falta permanece aqui até a reposição ser realizada ou dispensada.</p></div><span className="count">{response.makeups.length}</span></div>
        {response.makeups.length ? <div className="makeup-list">{response.makeups.map((item) => <article className="makeup-row" key={item.id}><div><strong>{item.patients?.name ?? "Paciente"}</strong><span>Faltou em {new Intl.DateTimeFormat("pt-BR").format(new Date(`${item.class_date}T12:00:00`))} · Horário {String(item.group_slots?.starts_at ?? "").slice(0, 5)}</span></div>{canEdit && <div className="attendance-actions"><button className="btn primary" type="button" disabled={savingId === item.id} onClick={() => void finishMakeup(item, "completed")}>Reposição realizada</button><button className="btn secondary" type="button" disabled={savingId === item.id} onClick={() => void finishMakeup(item, "waived")}>Dispensar</button></div>}</article>)}</div> : <div className="attendance-empty"><strong>Nenhuma reposição pendente</strong><p>As faltas registradas aparecerão automaticamente aqui.</p></div>}
      </section>
    </>}
  </div>;
}
