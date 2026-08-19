import { useMemo, useState } from "react";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextField } from "../components/FormPrimitives";
import { dateKey, messageOf, ModuleState, type Row, useResources } from "./OperationalShared";

type AttendanceResponse = { slots: Row[]; makeups: Row[] };

export function OperationalDailyAttendance({ canEdit = true }: { canEdit?: boolean }) {
  const [selectedUnitId, setSelectedUnitId] = useState(() => window.localStorage.getItem("fisiofit:selected-unit") ?? "");
  const [selectedDate, setSelectedDate] = useState(() => dateKey(new Date()));
  const [selectedSlotId, setSelectedSlotId] = useState("");
  const [notice, setNotice] = useState("");
  const [savingId, setSavingId] = useState("");
  const path = selectedUnitId ? `/attendance/daily?date=${selectedDate}&unitId=${selectedUnitId}` : "";
  const paths = path ? ["/units", path] : ["/units"];
  const { data, loading, error, reload } = useResources(paths);
  const response: AttendanceResponse = data[path] ?? { slots: [], makeups: [] };
  const selectedSlot = response.slots.find((slot) => slot.id === selectedSlotId);
  const members = useMemo<Row[]>(() => selectedSlot ? (selectedSlot.members ?? []).map((member: Row) => ({ ...member, slot: selectedSlot })) : [], [selectedSlot]);
  const present = members.filter((row: Row) => row.attendance?.status === "present").length;
  const absent = members.filter((row: Row) => row.attendance?.status === "absent").length;
  const pending = members.length - present - absent;
  const isFuture = selectedDate > dateKey(new Date());

  function moveDay(offset: number) {
    const next = new Date(`${selectedDate}T12:00:00`);
    next.setDate(next.getDate() + offset);
    setSelectedDate(dateKey(next));
    setSelectedSlotId("");
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
    </div>
    <section className="card attendance-filters" aria-labelledby="attendance-filters-title">
      <div><p className="eyebrow">SELECIONE A TURMA</p><h2 id="attendance-filters-title">Unidade, dia e horário</h2><p>Ao escolher o horário, os pacientes e o fisioterapeuta aparecem automaticamente.</p></div>
      <div className="attendance-filter-grid">
        <SelectField label="1. Unidade" value={selectedUnitId} onChange={(event) => { setSelectedUnitId(event.target.value); setSelectedSlotId(""); setNotice(""); }} required>
          <option value="">Selecione a unidade</option>
          {(data["/units"] ?? []).map((unit: Row) => <option key={unit.id} value={unit.id}>{unit.name}</option>)}
        </SelectField>
        <div className="attendance-date-field">
          <TextField label="2. Dia" type="date" value={selectedDate} onChange={(event) => { setSelectedDate(event.target.value); setSelectedSlotId(""); setNotice(""); }} />
          <div className="daily-date-controls" aria-label="Navegar pelos dias da chamada">
            <button type="button" className="btn secondary" onClick={() => moveDay(-1)} aria-label="Dia anterior">‹</button>
            <button type="button" className="btn secondary" onClick={() => moveDay(1)} aria-label="Próximo dia">›</button>
            <button type="button" className="btn secondary" onClick={() => { setSelectedDate(dateKey(new Date())); setSelectedSlotId(""); }}>Hoje</button>
          </div>
        </div>
        <SelectField label="3. Horário" value={selectedSlotId} disabled={!selectedUnitId || loading || !response.slots.length} onChange={(event) => { setSelectedSlotId(event.target.value); setNotice(""); }} required>
          <option value="">{!selectedUnitId ? "Escolha a unidade primeiro" : loading ? "Carregando horários…" : response.slots.length ? "Selecione o horário" : "Nenhum horário neste dia"}</option>
          {response.slots.map((slot) => <option key={slot.id} value={slot.id}>{String(slot.starts_at).slice(0, 5)} · {slot.professionals?.name ?? "Sem fisioterapeuta"}</option>)}
        </SelectField>
      </div>
    </section>
    {notice && <div className="toast" role="status"><span>✓</span>{notice}</div>}
    <ModuleState loading={loading} error={error} retry={reload} />
    {!loading && !error && <>
      {isFuture && <div className="system-message attendance-future-note" role="status"><span className="message-icon" aria-hidden="true">i</span><div><strong>Chamada futura</strong><p>Você pode conferir a turma, mas a presença só poderá ser marcada no dia da aula.</p></div></div>}
      {selectedSlot && <section className="attendance-summary" aria-label="Resumo da chamada">
        <div><span>Pacientes</span><strong>{members.length}</strong></div><div><span>Presentes</span><strong>{present}</strong></div><div><span>Faltas</span><strong>{absent}</strong></div><div><span>Sem marcar</span><strong>{pending}</strong></div>
      </section>}
      {selectedSlot && <div className="attendance-day-heading"><h2>{formattedDate}</h2><p>Horário e equipe selecionados</p></div>}
      {selectedSlot ? <div className="attendance-slot-list"><section className="card attendance-card" key={selectedSlot.id}>
        {(() => { const slot = selectedSlot; return <>
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
        </>; })()}
      </section></div> : <div className="card attendance-empty"><strong>{selectedUnitId ? response.slots.length ? "Selecione um horário" : "Nenhuma turma fixa nesta data" : "Selecione a unidade"}</strong><p>{selectedUnitId ? response.slots.length ? "Depois da escolha, pacientes e fisioterapeuta serão carregados automaticamente." : "Os pacientes aparecerão conforme os dias e períodos cadastrados na Agenda." : "Comece escolhendo a unidade da clínica para fazer a chamada."}</p></div>}
      {selectedUnitId && <section className="card makeup-card" aria-labelledby="makeup-title">
        <div className="card-head"><div><p className="eyebrow">CONTROLE DE FALTAS</p><h2 id="makeup-title">Reposições pendentes</h2><p>Uma falta permanece aqui até a reposição ser realizada ou dispensada.</p></div><span className="count">{response.makeups.length}</span></div>
        {response.makeups.length ? <div className="makeup-list">{response.makeups.map((item) => <article className="makeup-row" key={item.id}><div><strong>{item.patients?.name ?? "Paciente"}</strong><span>Faltou em {new Intl.DateTimeFormat("pt-BR").format(new Date(`${item.class_date}T12:00:00`))} · Horário {String(item.group_slots?.starts_at ?? "").slice(0, 5)}</span></div>{canEdit && <div className="attendance-actions"><button className="btn primary" type="button" disabled={savingId === item.id} onClick={() => void finishMakeup(item, "completed")}>Reposição realizada</button><button className="btn secondary" type="button" disabled={savingId === item.id} onClick={() => void finishMakeup(item, "waived")}>Dispensar</button></div>}</article>)}</div> : <div className="attendance-empty"><strong>Nenhuma reposição pendente</strong><p>As faltas registradas aparecerão automaticamente aqui.</p></div>}
      </section>}
    </>}
  </div>;
}
