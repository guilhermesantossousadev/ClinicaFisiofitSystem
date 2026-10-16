// Presentation only: charge totals and receipts are separate measures with explicit date bases.
type Charge = { id?: string; amount_cents: number; paid_cents: number; status?: string; due_at?: string; patient_id?: string; deleted_at?: string | null };
type Receipt = { charge_id?: string; amount_cents: number; paid_at?: string; reversed_at?: string | null; deleted_at?: string | null };
export function financialOverview(charges: Charge[], receipts: Receipt[], month: string, patientId = "") {
  const due = charges.filter(row => !row.deleted_at && row.status !== "cancelled" && row.due_at?.slice(0,7) === month && (!patientId || row.patient_id === patientId));
  const received = receipts.filter(row => !row.deleted_at && !row.reversed_at && receiptMonth(row.paid_at) === month && (!patientId || charges.some(charge => charge.id === row.charge_id && charge.patient_id === patientId)));
  return {
    charges: due,
    receipts: received,
    billed: due.reduce((sum,row) => sum + Number(row.amount_cents), 0),
    paidOnCharges: due.reduce((sum,row) => sum + Number(row.paid_cents), 0),
    outstanding: due.reduce((sum,row) => sum + Math.max(0, Number(row.amount_cents) - Number(row.paid_cents)), 0),
    received: received.reduce((sum,row) => sum + Number(row.amount_cents), 0),
  };
}

function receiptMonth(value?: string) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return '';
  return new Intl.DateTimeFormat('en-CA',{year:'numeric',month:'2-digit',timeZone:'America/Sao_Paulo'}).format(date);
}
