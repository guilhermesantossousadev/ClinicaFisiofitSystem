import { useState, type FormEvent } from "react";
import { api } from "../../infrastructure/http/api";
import { SelectField, TextareaField, TextField } from "../components/FormPrimitives";
import { brl, messageOf, type Row, useDialogFocus } from "./OperationalShared";

type Preview = { token: string; new_plan_name: string; new_amount_cents: number; cancel_charge_ids: string[]; proposed_charges: { coverage_from: string; coverage_to: string; amount_cents: number }[]; charges: { id: string; amount_cents: number; paid_cents: number; coverage_from: string; coverage_to: string; status: string }[] };
export function PlanChangeDialog({ enrollment, plans, onClose, onChanged }: { enrollment: Row; plans: Row[]; onClose: () => void; onChanged: () => Promise<void> }) {
  const [preview, setPreview] = useState<Preview>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ref = useDialogFocus(true, onClose, !saving);
  const next = new Date(); next.setMonth(next.getMonth()+1, 1);
  const month = `${next.getFullYear()}-${String(next.getMonth()+1).padStart(2,"0")}`;
  const currentPlan = plans.find((p) => p.id === enrollment.plan_id);
  const amount = enrollment.contract_amount_cents == null ? null : Number(enrollment.contract_amount_cents)-Number(enrollment.discount_cents ?? 0)+Number(enrollment.surcharge_cents ?? 0);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (saving) return;
    const form = new FormData(event.currentTarget);
    const input = { plan_id: String(form.get("plan_id")), effective_from: `${form.get("month")}-01` };
    setSaving(true); setError("");
    try {
      if (!preview) setPreview((await api<Preview>(`/enrollments/${enrollment.id}/plan-change/preview`, { method: "POST", body: JSON.stringify(input) })).data ?? undefined);
      else {
        await api(`/enrollments/${enrollment.id}/plan-change`, { method: "POST", body: JSON.stringify({ ...input, expected_token: preview.token, reason: String(form.get("reason")) }) });
        await onChanged(); onClose();
      }
    } catch (e) { setError(messageOf(e)); setPreview(undefined); } finally { setSaving(false); }
  }
  return <div className="edit-dialog-backdrop"><section ref={ref} role="dialog" aria-modal="true" aria-labelledby="plan-change-title" className="edit-dialog" tabIndex={-1}><div className="edit-dialog-header"><div><h2 id="plan-change-title">Trocar plano</h2><p>{enrollment.patient?.name ?? "Paciente"} · {currentPlan?.name}</p></div><button className="dialog-close" aria-label="Fechar troca de plano" disabled={saving} onClick={onClose}>×</button></div><form className="modal-form" onSubmit={(e) => void submit(e)} onChange={() => setPreview(undefined)}>{error && <p role="alert">{error}</p>}<p>Valor contratado atual: <strong>{amount === null ? "A confirmar" : brl(amount)}</strong>{enrollment.contract_effective_from ? ` desde ${enrollment.contract_effective_from}` : ""}.</p><SelectField label="Novo plano" name="plan_id" required defaultValue=""><option value="" disabled>Selecione o novo plano</option>{plans.filter((p) => p.active && p.id !== enrollment.plan_id).map((p) => <option key={p.id} value={p.id}>{p.name} · {p.duration_days} dias · {p.sessions_included} aulas · {brl(Number(p.price_cents))}</option>)}</SelectField><TextField label="Vigência da troca" name="month" type="month" min={month} defaultValue={month} required /><TextareaField label="Justificativa" name="reason" minLength={10} maxLength={1000} required /><p>O novo contrato utiliza o preço global selecionado, sem transportar descontos ou adicionais do contrato anterior. As turmas e os horários da agenda são preservados.</p>
    {preview && <div role="status"><h3>Impacto da troca</h3><p>{preview.new_plan_name} · {brl(preview.new_amount_cents)} por período.</p><p>{preview.cancel_charge_ids.length} cobrança(s) futura(s) sem recebimento serão canceladas com auditoria.</p>{preview.proposed_charges.map((c) => <p key={c.coverage_from}>Nova cobrança: {c.coverage_from} até {c.coverage_to} · {brl(c.amount_cents)}</p>)}<p>Matrícula anterior, cobranças anteriores e recebimentos permanecem no histórico.</p>{preview.charges.filter((c) => !preview.cancel_charge_ids.includes(c.id)).map((c) => <p key={c.id}>Preservada: {c.coverage_from} até {c.coverage_to} · devido {brl(c.amount_cents)} · recebido {brl(c.paid_cents)}.</p>)}</div>}
    <div className="edit-dialog-actions"><button type="button" className="btn secondary" disabled={saving} onClick={onClose}>Cancelar</button><button className="btn primary" disabled={saving}>{saving ? "Processando…" : preview ? "Confirmar troca de plano" : "Ver impacto da troca"}</button></div></form></section></div>;
}
