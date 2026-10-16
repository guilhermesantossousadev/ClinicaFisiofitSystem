import { describe, expect, it } from 'vitest';
import { financialOverview } from './financialOverview';

describe('financial presentation: separate due dates, receipt dates and reversals', () => {
  const charges=[{id:'a',patient_id:'patient-a',due_at:'2026-10-10',amount_cents:22000,paid_cents:10000,status:'partial'}, {id:'b',patient_id:'patient-b',due_at:'2026-10-12',amount_cents:18000,paid_cents:18000,status:'paid'}, {id:'c',patient_id:'patient-a',due_at:'2026-09-10',amount_cents:12000,paid_cents:12000,status:'paid'}, {id:'cancelled',patient_id:'patient-a',due_at:'2026-10-12',amount_cents:99999,paid_cents:0,status:'cancelled'}];
  const receipts=[{charge_id:'a',paid_at:'2026-10-05T12:00:00Z',amount_cents:10000}, {charge_id:'b',paid_at:'2026-09-25T12:00:00Z',amount_cents:18000}, {charge_id:'c',paid_at:'2026-10-01T12:00:00Z',amount_cents:12000}, {charge_id:'a',paid_at:'2026-10-01T12:00:00Z',amount_cents:5000,reversed_at:'2026-10-02T12:00:00Z'}];
  it('does not confuse receipts in October with amounts paid on October charges', () => {
    const overview=financialOverview(charges,receipts,'2026-10');
    expect(overview.billed).toBe(40000);expect(overview.paidOnCharges).toBe(28000);expect(overview.outstanding).toBe(12000);expect(overview.received).toBe(22000);
  });
  it('scopes receipts through charge_id without assuming a patient_id in the payment contract', () => {
    const overview=financialOverview(charges,receipts,'2026-10','patient-b');
    expect(overview.billed).toBe(18000);expect(overview.received).toBe(0);expect(overview.outstanding).toBe(0);
  });
  it('excludes deleted charges and never displays negative outstanding balances', () => {
    const overview=financialOverview([{id:'d',due_at:'2026-10-01',amount_cents:1,paid_cents:2},{id:'e',due_at:'2026-10-01',amount_cents:10,paid_cents:0,deleted_at:'2026-10-02'}],[],'2026-10');
    expect(overview.outstanding).toBe(0);expect(overview.billed).toBe(1);
  });
  it('uses the clinic timezone when a payment falls near the UTC month boundary', () => {
    const receipt=[{charge_id:'a',paid_at:'2026-11-01T01:00:00Z',amount_cents:1234}];
    expect(financialOverview(charges,receipt,'2026-10').received).toBe(1234);
    expect(financialOverview(charges,receipt,'2026-11').received).toBe(0);
  });
});
