import { useState } from "react";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextField } from "../components/FormPrimitives";
import { dateKey, messageOf, ModuleState, type Row, useResources } from "./OperationalShared";

const labels: Record<string, string> = { review: "Revisão necessária", eligible: "Disponível", reserved: "Reservado", consumed: "Utilizado", waived: "Encerrado" };
export function MakeupBookings({ canManage, initialUnit = "" }: { canManage: boolean; initialUnit?: string }) {
  const [unit, setUnit] = useState(initialUnit);
  const [day, setDay] = useState(() => dateKey(new Date()));
  const [credit, setCredit] = useState<Row | null>(null);
  const [occurrence, setOccurrence] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const start = `${day}T00:00:00-03:00`;
  const next = new Date(`${day}T12:00:00`); next.setDate(next.getDate() + 1);
  const calendarPath = unit ? `/calendar-items?unitId=${unit}&from=${encodeURIComponent(start)}&to=${encodeURIComponent(`${dateKey(next)}T00:00:00-03:00`)}&type=CLASS_OCCURRENCE` : "";
  const paths = ["/makeup-credits", "/units", ...(credit && calendarPath ? [calendarPath] : [])];
  const { data, loading, error, reload } = useResources(paths);
  const credits: Row[] = data["/makeup-credits"] ?? [];
  async function act(item: Row, action: string) {
    if (busy) return;
    const reason = action === "reserve" ? null : window.prompt("Justificativa da decisão (mínimo 3 caracteres):");
    if (action !== "reserve" && (!reason || reason.trim().length < 3)) return;
    setBusy(true); setNotice("");
    try {
      await api(`/makeup-credits/${item.id}`, { method: "POST", body: JSON.stringify({ action, legacy: item.legacy, occurrenceId: action === "reserve" ? occurrence : null, reason }) });
      setCredit(null); setOccurrence(""); await reload(); setNotice("Decisão registrada. O crédito só é consumido após presença na reposição.");
    } catch (e) { setNotice(messageOf(e)); } finally { setBusy(false); }
  }
  return <section className="card makeup-card" aria-labelledby="makeup-title">
    <div className="card-head"><div><h2 id="makeup-title">Reposições e créditos</h2><p>Reserva, comparecimento e cancelamento preservam a origem da falta. Elegibilidade sem política definida exige revisão.</p></div></div>
    <ModuleState loading={loading} error={error} retry={reload} />
    {notice && <p role="status">{notice}</p>}
    {credits.map((item) => <article className="operational-row" key={`${item.legacy}-${item.id}`}><div><strong>{item.patient_name}</strong><small>{item.source_date} · {labels[item.state] ?? item.state}</small>{item.reason && <small>{item.reason}</small>}</div>{canManage && <div className="row-actions">
      {item.state === "eligible" && <button type="button" disabled={busy} onClick={() => { setCredit(item); setOccurrence(""); }}>Reservar reposição</button>}
      {item.state === "review" && <button type="button" disabled={busy} onClick={() => void act(item, "approve")}>Autorizar com justificativa</button>}
      {item.state === "reserved" && <button type="button" disabled={busy} onClick={() => void act(item, "return")}>Cancelar e devolver crédito</button>}
      {["review", "eligible", "reserved"].includes(item.state) && <button type="button" disabled={busy} onClick={() => void act(item, "forfeit")}>Encerrar com justificativa</button>}
    </div>}</article>)}
    {!loading && !credits.length && <p className="empty-state">Nenhum crédito de reposição neste escopo.</p>}
    {credit && <div className="modal-form"><h3>Reposição de {credit.patient_name}</h3><div className="form-row">
      <SelectField label="Unidade da reposição" value={unit} onChange={(e) => { setUnit(e.target.value); setOccurrence(""); }}><option value="">Selecione</option>{(data["/units"] ?? []).map((u: Row) => <option key={u.id} value={u.id}>{u.name}</option>)}</SelectField>
      <TextField label="Dia da reposição" type="date" min={dateKey(new Date())} value={day} onChange={(e) => { setDay(e.target.value); setOccurrence(""); }} />
    </div><SelectField label="Aula da reposição" value={occurrence} onChange={(e) => setOccurrence(e.target.value)}><option value="">Selecione uma aula</option>{(data[calendarPath]?.items ?? []).filter((o: Row) => o.status === "planned").map((o: Row) => <option key={o.id} value={o.id}>{new Date(o.startAt).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })} · {o.title} · {o.professional?.name}</option>)}</SelectField><div className="modal-actions"><button type="button" className="btn secondary" disabled={busy} onClick={() => setCredit(null)}>Voltar</button><button type="button" className="btn primary" disabled={busy || !occurrence} onClick={() => void act(credit, "reserve")}>{busy ? "Reservando…" : "Confirmar reserva"}</button></div></div>}
  </section>;
}
