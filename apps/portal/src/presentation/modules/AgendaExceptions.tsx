import { useState, type FormEvent } from "react";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextField, TextareaField } from "../components/FormPrimitives";
import { DrawerForm, isoLocal, messageOf, type Row, useResources, value } from "./OperationalShared";
export function AgendaExceptions({ onChanged }: { onChanged: () => Promise<void> }) {
  const { data } = useResources(["/units", "/professionals"]);
  const [kind, setKind] = useState("leave");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget); setBusy(true); setNotice("");
    try {
      const response = await api<{ affected: Row[] }>("/agenda-exceptions", { method: "POST", body: JSON.stringify({ kind, unitId: value(form, "unit"), professionalId: kind === "leave" ? value(form, "professional") : null, from: isoLocal(value(form, "from")), to: isoLocal(value(form, "to")), reason: value(form, "reason") }) });
      await onChanged(); setNotice(kind === "leave" ? `${response.data?.affected.length ?? 0} aulas sinalizadas. Defina substituição ou remarcação nos detalhes de cada aula.` : "Feriado registrado. Aulas canceladas sem gerar créditos automáticos.");
    } catch (e) { setNotice(messageOf(e)); } finally { setBusy(false); }
  }
  return <DrawerForm title="Feriado, férias ou afastamento" onSubmit={save}><h2>Calendário operacional</h2>
    <SelectField label="Tratamento" value={kind} onChange={(e) => setKind(e.target.value)}><option value="leave">Férias ou afastamento profissional</option><option value="holiday">Feriado da clínica, em todas as unidades</option></SelectField>
    <SelectField name="unit" label="Unidade de referência" required><option value="">Selecione</option>{(data["/units"] ?? []).map((u: Row) => <option key={u.id} value={u.id}>{u.name}</option>)}</SelectField>
    {kind === "leave" && <SelectField name="professional" label="Profissional afastado" required><option value="">Selecione</option>{(data["/professionals"] ?? []).map((p: Row) => <option key={p.id} value={p.id}>{p.name}</option>)}</SelectField>}
    <div className="form-row"><TextField name="from" label="Início" type="datetime-local" required /><TextField name="to" label="Fim (exclusivo)" type="datetime-local" required /></div><TextareaField name="reason" label="Motivo" minLength={3} maxLength={1000} required />
    {notice && <p role="status">{notice}</p>}<p className="form-instructions">Afastamentos mantêm as aulas sinalizadas para decisão. Feriados cancelam as aulas do período; chamadas ou reservas existentes exigem revisão prévia.</p><button className="btn primary" disabled={busy}>{busy ? "Salvando…" : "Registrar"}</button>
  </DrawerForm>;
}
