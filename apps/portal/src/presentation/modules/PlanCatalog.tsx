import { useState, type FormEvent } from "react";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextField } from "../components/FormPrimitives";
import { brl, cents, messageOf, PLAN_PERIODS, type PlanPeriod, type Row, useDialogFocus } from "./OperationalShared";

export function PlanCatalog({ plans, reload, onNotice }: { plans: Row[]; reload: () => Promise<void>; onNotice: (text: string) => void }) {
  const [editing, setEditing] = useState<Row | null>();
  const [period, setPeriod] = useState<PlanPeriod>("monthly");
  const [frequency, setFrequency] = useState(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useDialogFocus(editing !== undefined, () => !saving && setEditing(undefined), !saving);
  function open(plan: Row | null) {
    setEditing(plan); setError("");
    const entry = Object.entries(PLAN_PERIODS).find(([, p]) => p.durationDays === Number(plan?.duration_days));
    const next = (entry?.[0] ?? "monthly") as PlanPeriod;
    setPeriod(next); setFrequency(Number(plan?.sessions_included ?? 8) / (PLAN_PERIODS[next].months * 4));
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    const form = new FormData(event.currentTarget); setSaving(true); setError("");
    try {
      const duration = PLAN_PERIODS[period];
      await api(editing ? `/plans/${editing.id}` : "/plans", { method: editing ? "PATCH" : "POST", body: JSON.stringify({ name: `${duration.label} · ${frequency}x por semana`, kind: period === "monthly" ? "monthly" : "package", duration_days: duration.durationDays, sessions_included: duration.months * frequency * 4, price_cents: cents(String(form.get("price"))), active: form.get("active") === "true" }) });
      await reload(); setEditing(undefined); onNotice("Plano salvo. Contratos e cobranças existentes preservados.");
    } catch (e) { setError(messageOf(e)); } finally { setSaving(false); }
  }
  return <section className="card table-card"><div className="table-toolbar"><div><h2>Gestão de Planos</h2><p>Preços globais do catálogo. Condições particulares são editadas na matrícula.</p></div><button className="btn primary" onClick={() => open(null)}>Criar plano</button></div>
    <div className="plan-catalog-grid">{Object.entries(PLAN_PERIODS).map(([key, duration]) => <section className="card" key={key}><h3>{duration.label}</h3>{[1, 2, 3].map((f) => {
      const matches = plans.filter((p) => Number(p.duration_days) === duration.durationDays && Number(p.sessions_included) === duration.months * f * 4);
      return <div className="catalog-option" key={f}><strong>{f}x por semana · {duration.months * f * 4} aulas</strong>{matches.length ? matches.map((p) => <div key={p.id}><span>{p.name} · {brl(Number(p.price_cents))} · {p.active ? "Ativo" : "Inativo"}</span><button className="btn secondary" onClick={() => open(p)}>Editar plano</button></div>) : <p>Não cadastrado — informe o preço ao criar.</p>}</div>;
    })}</section>)}</div>
    {plans.filter((p) => ![30,90,180].includes(Number(p.duration_days)) || ![1,2,3].includes(Number(p.sessions_included)/(Number(p.duration_days)/30*4))).map((p) => <p key={p.id}>Plano existente: {p.name} · {brl(Number(p.price_cents))}. Revise sua duração e frequência antes de usar na nova gestão.</p>)}
    {editing !== undefined && <div className="edit-dialog-backdrop"><section ref={ref} className="edit-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-title" tabIndex={-1}><div className="edit-dialog-header"><h2 id="catalog-title">{editing ? "Editar plano" : "Criar plano"}</h2><button className="dialog-close" aria-label="Fechar plano" disabled={saving} onClick={() => setEditing(undefined)}>×</button></div><form className="modal-form" onSubmit={(e) => void save(e)}>{error && <p role="alert">{error}</p>}<SelectField label="Duração" value={period} onChange={(e) => setPeriod(e.target.value as PlanPeriod)}>{Object.entries(PLAN_PERIODS).map(([key,p]) => <option key={key} value={key}>{p.label}</option>)}</SelectField><SelectField label="Frequência" value={frequency} onChange={(e) => setFrequency(Number(e.target.value))}>{[1,2,3].map((f) => <option key={f} value={f}>{f}x por semana</option>)}</SelectField><p>{PLAN_PERIODS[period].durationDays} dias · {PLAN_PERIODS[period].months * frequency * 4} aulas</p><TextField label="Preço global do período (R$)" name="price" type="number" min="0.01" step="0.01" defaultValue={editing ? Number(editing.price_cents)/100 : ""} required /><SelectField label="Disponibilidade" name="active" defaultValue={editing?.active === false ? "false" : "true"}><option value="true">Ativo</option><option value="false">Inativo</option></SelectField><p>Alterar o preço vale para novas contratações. Os valores já contratados e recebidos são preservados.</p><div className="edit-dialog-actions"><button className="btn secondary" type="button" disabled={saving} onClick={() => setEditing(undefined)}>Cancelar</button><button className="btn primary" disabled={saving}>{saving ? "Salvando…" : "Salvar plano"}</button></div></form></section></div>}
  </section>;
}
