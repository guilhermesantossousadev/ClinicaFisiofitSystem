import { describe, expect, it } from "vitest";
import { effectiveOccurrenceRoster } from "@fisiofit/contracts";
import type { PersistedOccurrenceParticipant, RosterMembership } from "@fisiofit/contracts";

const patient = (id: string) => ({ id, name: `Paciente ${id}` });
const membership = (id: string, weekdays: string[] | null): RosterMembership => ({
  id: `membership-${id}`, patient_id: id, effective_from: "2026-01-01", effective_to: null, weekdays, patient: patient(id),
});
const participant = (id: string, source: PersistedOccurrenceParticipant["source_type"], status: PersistedOccurrenceParticipant["status"]): PersistedOccurrenceParticipant => ({
  id: `participant-${id}`, patient_id: id, source_type: source, source_id: null, status, patient: patient(id),
});

describe("roster efetivo da occurrence", () => {
  it("inclui membership no weekday correspondente e não inclui em outro dia", () => {
    const monday = effectiveOccurrenceRoster("2026-10-12", ["monday", "wednesday"], [membership("seg", ["monday"])], []);
    const wednesday = effectiveOccurrenceRoster("2026-10-14", ["monday", "wednesday"], [membership("seg", ["monday"])], []);
    expect(monday.map((entry) => entry.patient.id)).toEqual(["seg"]);
    expect(wednesday).toEqual([]);
  });

  it("aplica INCLUDE manualmente em weekday fora da membership", () => {
    const roster = effectiveOccurrenceRoster("2026-10-14", ["monday", "wednesday"], [membership("seg", ["monday"])], [participant("seg", "ad_hoc_admission", "active")]);
    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({ source: "MANUAL", isOverride: true });
  });

  it("usa weekdays do schedule quando membership.weekdays é null", () => {
    const roster = effectiveOccurrenceRoster("2026-10-14", ["monday", "wednesday"], [membership("legacy", null)], []);
    expect(roster.map((entry) => entry.patient.id)).toEqual(["legacy"]);
  });

  it("aplica EXCLUDE e volta a incluir após reativação da participation", () => {
    const base = [membership("segqua", ["monday", "wednesday"])];
    expect(effectiveOccurrenceRoster("2026-10-12", ["monday", "wednesday"], base, [participant("segqua", "membership", "cancelled")])).toEqual([]);
    expect(effectiveOccurrenceRoster("2026-10-12", ["monday", "wednesday"], base, [participant("segqua", "membership", "active")])).toHaveLength(1);
  });

  it("remove inclusão manual mantendo a participação fora e evita duplicidade", () => {
    const duplicate = [membership("same", ["monday"]), { ...membership("same-2", ["monday"]), patient_id: "same", patient: patient("same") }];
    expect(effectiveOccurrenceRoster("2026-10-12", ["monday"], duplicate, [participant("same", "ad_hoc_admission", "active")])).toHaveLength(1);
    expect(effectiveOccurrenceRoster("2026-10-14", ["monday", "wednesday"], [], [participant("manual", "ad_hoc_admission", "cancelled")])).toEqual([]);
  });
});
